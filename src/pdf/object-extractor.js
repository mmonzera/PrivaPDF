/**
 * PDF Object Extractor — Extracts all renderable objects from a PDF page.
 * Used by the Edit tool to create interactive overlays over PDF content.
 * 
 * Similar to Adobe Acrobat's "Edit PDF" mode which shows all text blocks
 * and images as selectable, editable objects.
 */
import { uid } from '../utils/format.js';

/**
 * Extract all text objects from a page.
 * Groups adjacent text items into logical "blocks" like Acrobat does.
 * @param {import('pdfjs-dist').PDFPageProxy} page
 * @param {Object} viewport — pdfjs viewport with scale
 * @returns {Promise<Array>}
 */
export async function extractTextObjects(page, viewport) {
  const textContent = await page.getTextContent();
  const items = textContent.items.filter(item => item.str && item.str.trim());

  if (items.length === 0) return [];

  // Convert each text item into a positioned object
  const textObjects = items.map(item => {
    // Transform matrix: [scaleX, skewY, skewX, scaleY, translateX, translateY]
    const tx = item.transform;
    const fontSize = Math.sqrt(tx[0] * tx[0] + tx[1] * tx[1]);
    const isRotated = Math.abs(tx[1]) > 0.01 || Math.abs(tx[2]) > 0.01;
    const angle = Math.atan2(tx[1], tx[0]);

    // Convert PDF coordinates to viewport coordinates
    const [vpX, vpY] = viewport.convertToViewportPoint(tx[4], tx[5]);

    // Approximate dimensions
    const w = item.width * viewport.scale;
    const h = fontSize * viewport.scale;

    return {
      id: uid('txt'),
      type: 'text',
      str: item.str,
      x: vpX,
      y: vpY - h, // Adjust since PDF text baseline is at bottom
      w: Math.max(w, 20),
      h: Math.max(h, 8),
      fontSize,
      fontName: item.fontName || 'unknown',
      isRotated,
      angle,
      transform: tx,
      // Store original PDF coords for removal
      pdfX: tx[4],
      pdfY: tx[5],
    };
  });

  return groupSmart(textObjects);
}

/**
 * Smart grouping: Groups adjacent words on the same line,
 * especially useful for rotated text watermarks (C O N F I D E N T I A L)
 * which are extracted as separate letters.
 */
function groupSmart(items) {
  if (items.length === 0) return [];
  
  // 1. Group items that share the same baseline line and angle
  const lines = [];
  
  for (const item of items) {
    // Distance from the origin (0,0) to the line passing through item.pdfX, item.pdfY with item.angle
    // Normal vector is (-sin(angle), cos(angle))
    const r = -item.pdfX * Math.sin(item.angle) + item.pdfY * Math.cos(item.angle);
    
    let foundLine = false;
    for (const line of lines) {
      if (Math.abs(line.angle - item.angle) < 0.05 && Math.abs(line.r - r) < item.fontSize * 0.5) {
        line.items.push(item);
        foundLine = true;
        break;
      }
    }
    
    if (!foundLine) {
      lines.push({
        angle: item.angle,
        r: r,
        items: [item]
      });
    }
  }

  // 2. Sort items within each line along the baseline, then merge them
  const blocks = [];

  for (const line of lines) {
    // Sort items along the baseline vector (cos(angle), sin(angle))
    line.items.sort((a, b) => {
      const distA = a.pdfX * Math.cos(line.angle) + a.pdfY * Math.sin(line.angle);
      const distB = b.pdfX * Math.cos(line.angle) + b.pdfY * Math.sin(line.angle);
      return distA - distB;
    });

    let current = null;

    for (const item of line.items) {
      if (!current) {
        current = { ...item, originalItems: [item] };
        continue;
      }

      // Calculate distance along baseline from 'current' to 'item'
      const dx = item.pdfX - current.pdfX;
      const dy = item.pdfY - current.pdfY;
      const distAlongBaseline = dx * Math.cos(line.angle) + dy * Math.sin(line.angle);

      const sameFont = Math.abs(current.fontSize - item.fontSize) < 2;
      const closeX = distAlongBaseline >= -current.fontSize && distAlongBaseline < current.pdfW + (current.fontSize * 15);

      if (sameFont && closeX) {
        // Merge
        const gap = distAlongBaseline - current.pdfW;
        current.str += (gap > current.fontSize * 0.2 ? ' ' : '') + item.str;
        
        // Update viewport bounds
        const right = Math.max(current.x + current.w, item.x + item.w);
        const bottom = Math.max(current.y + current.h, item.y + item.h);
        current.x = Math.min(current.x, item.x);
        current.y = Math.min(current.y, item.y);
        current.w = right - current.x;
        current.h = bottom - current.y;

        // Update exact PDF width
        current.pdfW = distAlongBaseline + item.pdfW;
        current.originalItems.push(item);
      } else {
        blocks.push(current);
        current = { ...item, originalItems: [item] };
      }
    }
    if (current) blocks.push(current);
  }

  return blocks;
}

/**
 * Extract image/XObject references from a page.
 * Uses the operator list to find paintImageXObject calls and their positions.
 * @param {import('pdfjs-dist').PDFPageProxy} page
 * @param {Object} viewport
 * @returns {Promise<Array>}
 */
export async function extractImageObjects(page, viewport) {
  const ops = await page.getOperatorList();
  const images = [];

  // Track current transformation matrix as we walk operators
  const matrixStack = [];
  let currentMatrix = [1, 0, 0, 1, 0, 0]; // Identity

  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i];
    const args = ops.argsArray[i];

    // OPS constants from pdfjs
    switch (fn) {
      case 13: // save (q)
        matrixStack.push([...currentMatrix]);
        break;
      case 14: // restore (Q)
        if (matrixStack.length > 0) currentMatrix = matrixStack.pop();
        break;
      case 12: // transform (cm)
        if (args && args.length >= 6) {
          currentMatrix = multiplyMatrix(currentMatrix, args);
        }
        break;
      case 85: // paintImageXObject
      case 86: // paintImageXObjectRepeat
        if (args && args[0]) {
          const name = args[0];
          // Use current matrix to determine position and size
          const [a, b, c, d, e, f] = currentMatrix;
          const w = Math.sqrt(a * a + b * b);
          const h = Math.sqrt(c * c + d * d);

          const [vpX, vpY] = viewport.convertToViewportPoint(e, f);
          const vpW = w * viewport.scale;
          const vpH = h * viewport.scale;

          images.push({
            id: uid('img'),
            type: 'image',
            xobjectKey: name,
            x: vpX,
            y: vpY - vpH,
            w: Math.max(vpW, 10),
            h: Math.max(vpH, 10),
            transform: [...currentMatrix],
          });
        }
        break;
      case 83: // paintFormXObjectBegin
        if (args && args[0]) {
          const [a, b, c, d, e, f] = currentMatrix;
          const [vpX, vpY] = viewport.convertToViewportPoint(e, f);
          const w = Math.abs(a) * viewport.scale || 100;
          const h = Math.abs(d) * viewport.scale || 100;

          images.push({
            id: uid('xobj'),
            type: 'xobject',
            xobjectKey: typeof args[0] === 'string' ? args[0] : `form_${i}`,
            x: vpX,
            y: vpY - h,
            w: Math.max(w, 10),
            h: Math.max(h, 10),
            transform: [...currentMatrix],
          });
        }
        break;
    }
  }

  return images;
}

/**
 * Extract all objects from a page.
 * @param {import('pdfjs-dist').PDFPageProxy} page
 * @param {Object} viewport
 * @returns {Promise<Array>}
 */
export async function extractAllObjects(page, viewport) {
  const [texts, images] = await Promise.all([
    extractTextObjects(page, viewport),
    extractImageObjects(page, viewport),
  ]);

  // Combine and sort by visual position (top-to-bottom, left-to-right)
  const all = [...texts, ...images].sort((a, b) => {
    const yDiff = a.y - b.y;
    if (Math.abs(yDiff) > 10) return yDiff;
    return a.x - b.x;
  });

  return all;
}

/**
 * Multiply two 2D transformation matrices [a, b, c, d, e, f].
 */
function multiplyMatrix(m1, m2) {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ];
}
