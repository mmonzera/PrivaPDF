/**
 * PDF Object Remover — Removes specific objects from PDF structure.
 * Used by the Edit tool to delete individual text/image/XObject elements.
 */
import { PDFName, rgb, StandardFonts, degrees } from 'pdf-lib';
import pako from 'pako';
import { bus, Events } from '../core/events.js';
import { state } from '../core/state.js';
import { reloadFromBytes } from './loader.js';
import t from '../i18n/index.js';

/**
 * Remove an XObject (image or form) from a specific page.
 * @param {number} pageIndex — 0-indexed page number
 * @param {string} xobjectKey — Resource key of the XObject
 * @returns {Promise<boolean>}
 */
export async function removeXObjectFromPage(pageIndex, xobjectKey) {
  if (!state.pdfLibDoc) return false;

  try {
    const pages = state.pdfLibDoc.getPages();
    if (pageIndex < 0 || pageIndex >= pages.length) return false;

    const page = pages[pageIndex];
    const resourcesRef = page.node.get(PDFName.of('Resources'));
    const resources = state.pdfLibDoc.context.lookup(resourcesRef);
    if (!resources) return false;

    const xObjectsRef = resources.get(PDFName.of('XObject'));
    const xObjects = state.pdfLibDoc.context.lookup(xObjectsRef);
    if (!xObjects) return false;

    // Clean the key (remove leading / if present)
    const cleanKey = xobjectKey.startsWith('/') ? xobjectKey.slice(1) : xobjectKey;

    if (xObjects.delete) {
      xObjects.delete(PDFName.of(cleanKey));
    } else if (xObjects.set) {
      // Some implementations don't have delete, try setting to null
      xObjects.set(PDFName.of(cleanKey), null);
    }

    // Re-serialize and reload
    await resaveAndReload();

    bus.emit(Events.EDIT_OBJECT_DELETED, { type: 'xobject', key: cleanKey, pageIndex });
    bus.emit(Events.TOAST, {
      msg: t('toastObjectDeleted', { type: 'XObject' }),
      type: 'success',
      duration: 2000,
    });

    return true;
  } catch (err) {
    console.error('[ObjectRemover] XObject removal failed:', err);
    bus.emit(Events.TOAST, {
      msg: t('toastObjectDeleteError', { error: err.message }),
      type: 'error',
    });
    return false;
  }
}

/**
 * Attempt to erase text directly from the page's Content Stream.
 * This prevents the background/foreground from being erased by whiteout boxes.
 */
async function eraseTextFromStream(page, textObj) {
  const contentsRef = page.node.get(PDFName.of('Contents'));
  if (!contentsRef) return false;

  let arr = state.pdfLibDoc.context.lookup(contentsRef);
  if (!arr) return false;
  if (!arr.asArray) arr = { asArray: () => [contentsRef] };

  let streamModified = false;
  const newStreams = [];
  const itemsToMatch = textObj.originalItems || [textObj];

  for (const ref of arr.asArray()) {
    const stream = state.pdfLibDoc.context.lookup(ref);
    if (!stream) {
      newStreams.push(ref);
      continue;
    }

    let bytes = stream.getContents();
    const filter = stream.dict.get(PDFName.of('Filter'));
    
    if (filter === PDFName.of('FlateDecode') || (filter && filter.asArray && filter.asArray().some(f => f === PDFName.of('FlateDecode')))) {
      try {
        bytes = pako.inflate(bytes);
      } catch (e) { /* ignore */ }
    }

    let contentStr = new TextDecoder('latin1').decode(bytes);
    let newContentStr = '';
    let inBT = false;
    let blockModified = false;

    const blocks = contentStr.split(/(BT|ET)/);
    for (let i = 0; i < blocks.length; i++) {
      let block = blocks[i];
      if (block === 'BT') {
        newContentStr += block;
        inBT = true;
      } else if (block === 'ET') {
        newContentStr += block;
        inBT = false;
      } else if (inBT) {
        let eraseThisBlock = false;
        
        // Match Text Matrix (Tm)
        const tmMatch = block.match(/(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+Tm/);
        if (tmMatch) {
          const blockX = parseFloat(tmMatch[5]);
          const blockY = parseFloat(tmMatch[6]);
          for (const item of itemsToMatch) {
            if (item.pdfX !== undefined && Math.abs(item.pdfX - blockX) < 2 && Math.abs(item.pdfY - blockY) < 2) {
              eraseThisBlock = true;
              break;
            }
          }
        }
        
        // 2. Fallback: check exact hex or literal match
        if (!eraseThisBlock) {
          for (const item of itemsToMatch) {
            if (item.str && item.str.length > 2) {
              // Check hex
              const hex = Array.from(item.str).map(c => c.charCodeAt(0).toString(16).padStart(2,'0').toUpperCase()).join('');
              if (block.includes(`<${hex}>`) || block.includes(`<${hex.toLowerCase()}>`)) {
                eraseThisBlock = true;
                break;
              }
              // Check literal
              const literal = `(${item.str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`;
              if (block.match(new RegExp(literal))) {
                eraseThisBlock = true;
                break;
              }
            }
          }
        }

        if (eraseThisBlock) {
          const originalBlock = block;
          block = block.replace(/<[0-9A-Fa-f\s]*>/g, '<>'); // Empty hex strings (robust)
          block = block.replace(/\([\s\S]*?\)/g, '()'); // Empty literal strings (multiline robust)
          
          if (block !== originalBlock) {
            blockModified = true;
          }
        }
        newContentStr += block;
      } else {
        newContentStr += block;
      }
    }

    if (blockModified) {
      streamModified = true;
      const newBytes = new Uint8Array(newContentStr.length);
      for(let i=0; i<newContentStr.length; i++) newBytes[i] = newContentStr.charCodeAt(i);
      
      const newStream = state.pdfLibDoc.context.flateStream(newBytes);
      const newRef = state.pdfLibDoc.context.register(newStream);
      newStreams.push(newRef);
    } else {
      newStreams.push(ref);
    }
  }

  if (streamModified) {
    const newContentsArray = state.pdfLibDoc.context.obj(newStreams);
    page.node.set(PDFName.of('Contents'), newContentsArray);
    return true;
  }
  return false;
}

/**
 * Remove a text occurrence from a page by redacting it with a white rectangle.
 * Direct content stream text removal is too risky for legal docs,
 * so we use "white-out" approach: draw a white rectangle over the text area.
 * 
 * This is actually what Adobe Acrobat does internally for "delete text" in edit mode.
 * 
 * @param {number} pageIndex — 0-indexed page number
 * @param {Object} textObj — The text object with PDF coordinates
 * @returns {Promise<boolean>}
 */
export async function removeTextFromPage(pageIndex, textObj) {
  if (!state.pdfLibDoc) return false;

  try {
    const pages = state.pdfLibDoc.getPages();
    if (pageIndex < 0 || pageIndex >= pages.length) return false;

    const page = pages[pageIndex];
    const { height } = page.getSize();
    // Use exact PDF coordinates instead of converting from viewport
    // Added fallbacks to prevent NaN errors if Vite HMR preserves old object state
    const pdfX = textObj.pdfX !== undefined ? textObj.pdfX : (textObj.x / state.zoom);
    const pdfW = textObj.pdfW !== undefined ? textObj.pdfW : (textObj.w / state.zoom);
    const pdfH = textObj.pdfH !== undefined ? textObj.pdfH : (textObj.fontSize || textObj.h / state.zoom);
    const pdfY = textObj.pdfY !== undefined ? textObj.pdfY : (height - (textObj.y / state.zoom) - pdfH);

    const angleDegrees = (textObj.angle || 0) * (180 / Math.PI);
    const angleRad = textObj.angle || 0;

    // To cover descenders (e.g., 'g', 'p'), we must expand the box downwards.
    // For rotated text, we shift the origin along the normal vector.
    const descenderShift = pdfH * 0.25;
    const shiftX = descenderShift * Math.sin(angleRad);
    const shiftY = -descenderShift * Math.cos(angleRad);

    // First try true content stream deletion so we don't erase background text!
    const erased = await eraseTextFromStream(page, textObj);

    if (!erased) {
      // Fallback: Draw a white rectangle over the text area (whiteout)
      // Rotate around the new shifted bottom-left origin
      page.drawRectangle({
        x: pdfX + shiftX,
        y: pdfY + shiftY,
        width: pdfW,
        height: pdfH * 1.25,
        color: rgb(1, 1, 1),
        opacity: 1,
        rotate: degrees(angleDegrees),
      });
    }

    await resaveAndReload();

    // Track so extractor ignores it
    state.hiddenTextBlocks.push({
      pdfX: textObj.pdfX,
      pdfY: textObj.pdfY,
      str: textObj.str,
    });

    bus.emit(Events.EDIT_OBJECT_DELETED, { type: 'text', pageIndex });
    bus.emit(Events.TOAST, {
      msg: t('toastObjectDeleted', { type: 'Text' }),
      type: 'success',
      duration: 2000,
    });

    return true;
  } catch (err) {
    console.error('[ObjectRemover] Text removal failed:', err);
    bus.emit(Events.TOAST, {
      msg: t('toastObjectDeleteError', { error: err.message }),
      type: 'error',
    });
    return false;
  }
}

/**
 * Replace text in a page by white-outing the old text and writing new text.
 * @param {number} pageIndex 
 * @param {Object} textObj 
 * @param {string} newText 
 * @returns {Promise<boolean>}
 */
export async function replaceTextInPage(pageIndex, textObj, newText) {
  if (!state.pdfLibDoc) return false;

  try {
    const pages = state.pdfLibDoc.getPages();
    if (pageIndex < 0 || pageIndex >= pages.length) return false;

    const page = pages[pageIndex];
    const { height } = page.getSize();

    // Use exact PDF coordinates instead of converting from viewport
    // Added fallbacks to prevent NaN errors if Vite HMR preserves old object state
    const pdfX = textObj.pdfX !== undefined ? textObj.pdfX : (textObj.x / state.zoom);
    const pdfW = textObj.pdfW !== undefined ? textObj.pdfW : (textObj.w / state.zoom);
    const pdfH = textObj.pdfH !== undefined ? textObj.pdfH : (textObj.fontSize || textObj.h / state.zoom);
    const pdfY = textObj.pdfY !== undefined ? textObj.pdfY : (height - (textObj.y / state.zoom) - pdfH);

    const angleDegrees = (textObj.angle || 0) * (180 / Math.PI);
    const angleRad = textObj.angle || 0;

    // Shift origin down relative to the text rotation to cover descenders
    const descenderShift = pdfH * 0.25;
    const shiftX = descenderShift * Math.sin(angleRad);
    const shiftY = -descenderShift * Math.cos(angleRad);

    // First try true content stream deletion so we don't erase background text!
    const erased = await eraseTextFromStream(page, textObj);

    if (!erased) {
      // Fallback: Draw a white rectangle over the old text
      page.drawRectangle({
        x: pdfX + shiftX,
        y: pdfY + shiftY,
        width: pdfW,
        height: pdfH * 1.25,
        color: rgb(1, 1, 1),
        opacity: 1,
        rotate: degrees(angleDegrees),
      });
    }

    // 2. Draw the new text
    const font = await state.pdfLibDoc.embedFont(StandardFonts.Helvetica);
    
    page.drawText(newText, {
      x: pdfX,
      y: pdfY, // Text is drawn exactly at the baseline origin
      size: textObj.fontSize,
      font: font,
      color: rgb(0, 0, 0),
      rotate: degrees(angleDegrees),
    });

    await resaveAndReload();

    // Track old text so extractor ignores it
    state.hiddenTextBlocks.push({
      pdfX: textObj.pdfX,
      pdfY: textObj.pdfY,
      str: textObj.str,
    });

    bus.emit(Events.EDIT_OBJECT_DELETED, { type: 'text', pageIndex }); // Trigger re-render
    bus.emit(Events.TOAST, {
      msg: t('toastObjectDeleted', { type: 'Text Updated' }),
      type: 'success',
      duration: 2000,
    });

    return true;
  } catch (err) {
    console.error('[ObjectRemover] Text replace failed:', err);
    bus.emit(Events.TOAST, {
      msg: t('toastObjectDeleteError', { error: err.message }),
      type: 'error',
    });
    return false;
  }
}

/**
 * Generic object removal dispatcher.
 * @param {Object} obj — The extracted PDF object
 * @param {number} pageIndex — 0-indexed
 * @returns {Promise<boolean>}
 */
export async function removeObject(obj, pageIndex) {
  switch (obj.type) {
    case 'image':
    case 'xobject':
      return removeXObjectFromPage(pageIndex, obj.xobjectKey);

    case 'text':
      return removeTextFromPage(pageIndex, obj);

    default:
      console.warn('[ObjectRemover] Unknown object type:', obj.type);
      return false;
  }
}

/**
 * Re-serialize PDF and reload the rendering engine.
 */
async function resaveAndReload() {
  const newBytes = await state.pdfLibDoc.save();
  await reloadFromBytes(newBytes);
}

/**
 * Move any object (Text, Image, XObject) perfectly in the PDF stream.
 */
export async function moveObject(obj, pageIndex, dxPdf, dyPdf) {
  if (!state.pdfLibDoc) return false;

  try {
    const pages = state.pdfLibDoc.getPages();
    if (pageIndex < 0 || pageIndex >= pages.length) return false;

    const page = pages[pageIndex];
    const contentsRef = page.node.get(PDFName.of('Contents'));
    if (!contentsRef) return false;

    let arr = state.pdfLibDoc.context.lookup(contentsRef);
    if (!arr) return false;
    if (!arr.asArray) arr = { asArray: () => [contentsRef] };

    let streamModified = false;
    const newStreams = [];

    // For images/xobjects
    const isImage = obj.type === 'image' || obj.type === 'xobject';
    const key = isImage ? (obj.xobjectKey.startsWith('/') ? obj.xobjectKey : `/${obj.xobjectKey}`) : null;
    
    // Inverse transform delta for XObjects to maintain absolute drag precision
    let localDx = dxPdf;
    let localDy = dyPdf;
    if (isImage && obj.transform) {
      const [a, b, c, d] = obj.transform;
      const det = a * d - b * c;
      if (Math.abs(det) > 0.00001) {
        localDx = (d * dxPdf - c * dyPdf) / det;
        localDy = (a * dyPdf - b * dxPdf) / det;
      }
    }

    const itemsToMatch = obj.type === 'text' ? (obj.originalItems || [obj]) : [];

    for (const ref of arr.asArray()) {
      const stream = state.pdfLibDoc.context.lookup(ref);
      if (!stream) { newStreams.push(ref); continue; }

      let bytes = stream.getContents();
      const filter = stream.dict.get(PDFName.of('Filter'));
      if (filter === PDFName.of('FlateDecode') || (filter && filter.asArray && filter.asArray().some(f => f === PDFName.of('FlateDecode')))) {
        try { bytes = pako.inflate(bytes); } catch (e) {}
      }

      let contentStr = new TextDecoder('latin1').decode(bytes);
      let newContentStr = '';
      let blockModified = false;

      if (isImage) {
        // Inject translation matrix strictly before the /Do instruction
        // We use $1 to preserve any whitespace exactly as matched
        const regex = new RegExp(`(${key}\\s+Do\\b)`, 'g');
        if (regex.test(contentStr)) {
          const cmStr = `q 1 0 0 1 ${localDx.toFixed(4)} ${localDy.toFixed(4)} cm $1 Q`;
          contentStr = contentStr.replace(regex, cmStr);
          blockModified = true;
        }
        newContentStr = contentStr;
      } else {
        // Text moving by shifting the Text Matrix (Tm)
        let inBT = false;
        const blocks = contentStr.split(/(BT|ET)/);
        for (let i = 0; i < blocks.length; i++) {
          let block = blocks[i];
          if (block === 'BT') {
            newContentStr += block;
            inBT = true;
          } else if (block === 'ET') {
            newContentStr += block;
            inBT = false;
          } else if (inBT) {
            let moveThisBlock = false;
            
            const tmMatch = block.match(/(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+Tm/);
            if (tmMatch) {
              const blockX = parseFloat(tmMatch[5]);
              const blockY = parseFloat(tmMatch[6]);
              for (const item of itemsToMatch) {
                if (item.pdfX !== undefined && Math.abs(item.pdfX - blockX) < 2 && Math.abs(item.pdfY - blockY) < 2) {
                  moveThisBlock = true;
                  break;
                }
              }
            }
            
            if (moveThisBlock && tmMatch) {
              const originalBlock = block;
              const newE = (parseFloat(tmMatch[5]) + dxPdf).toFixed(4);
              const newF = (parseFloat(tmMatch[6]) + dyPdf).toFixed(4);
              const newTm = `${tmMatch[1]} ${tmMatch[2]} ${tmMatch[3]} ${tmMatch[4]} ${newE} ${newF} Tm`;
              block = block.replace(tmMatch[0], newTm);
              
              if (block !== originalBlock) blockModified = true;
            }
            newContentStr += block;
          } else {
            newContentStr += block;
          }
        }
      }

      if (blockModified) {
        streamModified = true;
        const newBytes = new Uint8Array(newContentStr.length);
        for(let i=0; i<newContentStr.length; i++) newBytes[i] = newContentStr.charCodeAt(i);
        const newStream = state.pdfLibDoc.context.flateStream(newBytes);
        newStreams.push(state.pdfLibDoc.context.register(newStream));
      } else {
        newStreams.push(ref);
      }
    }

    if (streamModified) {
      page.node.set(PDFName.of('Contents'), state.pdfLibDoc.context.obj(newStreams));
      await resaveAndReload();
      bus.emit(Events.TOAST, { msg: t('toastObjectDeleted', { type: 'Moved' }), type: 'success', duration: 1500 });
      return true;
    }

    return false;
  } catch (err) {
    console.error('[ObjectMover] Move failed:', err);
    return false;
  }
}
