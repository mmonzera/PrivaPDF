/**
 * Content Stream Strategy — Parse page content streams for watermark markers.
 * Detects BMC/EMC marked content tagged as /Watermark, diagonal text rendering, etc.
 */
import { PDFName } from 'pdf-lib';

/**
 * Scan content streams for watermark-related operators.
 * @param {import('pdf-lib').PDFDocument} pdfLibDoc
 * @returns {Array}
 */
export function detectContentStreamWatermarks(pdfLibDoc) {
  const found = [];
  const pages = pdfLibDoc.getPages();

  for (let pi = 0; pi < pages.length; pi++) {
    try {
      const page = pages[pi];
      const contentsRef = page.node.get(PDFName.of('Contents'));
      if (!contentsRef) continue;

      // Get content stream(s)
      const contents = resolveContents(pdfLibDoc, contentsRef);

      for (const streamBytes of contents) {
        if (!streamBytes) continue;

        let text;
        try {
          text = typeof streamBytes === 'string'
            ? streamBytes
            : new TextDecoder('latin1').decode(streamBytes);
        } catch (e) { continue; }

        // Method 1: Look for /Watermark marked content
        if (/\/Watermark\s+BMC/i.test(text) || /\/Watermark\s+BDC/i.test(text)) {
          found.push({
            pageIndex: pi,
            type: 'Marked Content (/Watermark)',
            key: 'BMC-Watermark',
            description: `Watermark marked content block on page ${pi + 1}`,
            confidence: 'High',
            objRef: { type: 'content-stream', pageIndex: pi, marker: 'BMC' },
          });
        }

        // Method 2: Look for /Artifact marked content (sometimes used for watermarks)
        if (/\/Artifact\s+BDC/i.test(text)) {
          // Check if the artifact block contains watermark-like text
          const artifactMatch = text.match(/\/Artifact\s+BDC([\s\S]*?)EMC/g);
          if (artifactMatch) {
            for (const block of artifactMatch) {
              if (/watermark|draft|confidential|sample/i.test(block)) {
                found.push({
                  pageIndex: pi,
                  type: 'Artifact (Watermark)',
                  key: 'Artifact-WM',
                  description: `Artifact block with watermark content on page ${pi + 1}`,
                  confidence: 'High',
                  objRef: { type: 'content-stream', pageIndex: pi, marker: 'Artifact' },
                });
              }
            }
          }
        }

        // Method 3: Detect large diagonal text (rotation matrix with text)
        // PDF text matrix: [a b c d e f] where b!=0 or c!=0 indicates rotation
        const tmMatches = text.matchAll(/(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+Tm/g);
        for (const m of tmMatches) {
          const [, a, b, c, d] = m.map(Number);
          // Check for diagonal rotation (45-degree is common for watermarks)
          if (Math.abs(b) > 0.3 && Math.abs(c) > 0.3) {
            const fontSize = Math.sqrt(a * a + b * b);
            if (fontSize > 24) { // Large rotated text = very likely watermark
              found.push({
                pageIndex: pi,
                type: 'Diagonal Large Text',
                key: 'RotatedText',
                description: `Large rotated text (${Math.round(fontSize)}pt) on page ${pi + 1} — typical watermark`,
                confidence: 'High',
                objRef: { type: 'content-stream', pageIndex: pi, marker: 'Tm' },
              });
              break; // One per page is enough
            }
          }
        }
      }
    } catch (e) {
      console.warn(`[ContentStream] Scan error on page ${pi + 1}:`, e);
    }
  }

  return found;
}

/**
 * Resolve content stream references into byte arrays.
 */
function resolveContents(pdfLibDoc, contentsRef) {
  const results = [];

  try {
    // Could be a single stream or an array of streams
    const resolved = pdfLibDoc.context.lookup(contentsRef);

    if (resolved && typeof resolved.decodeContents === 'function') {
      results.push(resolved.decodeContents());
    } else if (resolved && typeof resolved.asArray === 'function') {
      for (const ref of resolved.asArray()) {
        const stream = pdfLibDoc.context.lookup(ref);
        if (stream && typeof stream.decodeContents === 'function') {
          results.push(stream.decodeContents());
        }
      }
    }
  } catch (e) {
    // Silently skip unreadable streams
  }

  return results;
}
