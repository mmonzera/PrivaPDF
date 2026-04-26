/**
 * Text Pattern Strategy — Detect watermark text via pdfjs text extraction.
 */

const WATERMARK_PATTERNS = [
  /\bDRAFT\b/i,
  /\bCONFIDENTIAL\b/i,
  /\bWATERMARK\b/i,
  /\bSAMPLE\b/i,
  /\bCOPY\b/i,
  /\bNOT FOR DISTRIBUTION\b/i,
  /\bPROPRIETARY\b/i,
  /\bDO NOT COPY\b/i,
  /COPY\s*RIGHT/i,
  /\bSECRET\b/i,
  /\bUNOFFICIAL\b/i,
  /\bFOR REVIEW ONLY\b/i,
  /\bPRELIMINARY\b/i,
  /\bVOID\b/i,
  /\bCANCELLED\b/i,
  /\bOBSOLETE\b/i,
  /\bFOR INTERNAL USE\b/i,
];

/**
 * Scan text content for common watermark patterns.
 * @param {import('pdfjs-dist').PDFDocumentProxy} pdfjsDoc
 * @param {number} maxPages — Max pages to scan (performance limit)
 * @returns {Promise<Array>}
 */
export async function detectTextWatermarks(pdfjsDoc, maxPages = 10) {
  const found = [];
  const pagesToScan = Math.min(pdfjsDoc.numPages, maxPages);

  for (let pi = 1; pi <= pagesToScan; pi++) {
    try {
      const page = await pdfjsDoc.getPage(pi);
      const textContent = await page.getTextContent();

      // Check individual text items for watermark-like properties
      for (const item of textContent.items) {
        if (!item.str?.trim()) continue;

        for (const pattern of WATERMARK_PATTERNS) {
          if (pattern.test(item.str)) {
            // Check if the text has watermark-like properties:
            // Large font, rotated, or repeated across pages
            const isLargeText = item.height > 20;
            const isRotated = item.transform && (
              item.transform[1] !== 0 || item.transform[2] !== 0
            );

            found.push({
              pageIndex: pi - 1,
              type: 'Text Pattern',
              key: pattern.source,
              description: `Text "${item.str.trim()}" detected on page ${pi}${isRotated ? ' (rotated)' : ''}${isLargeText ? ' (large)' : ''}`,
              confidence: (isRotated || isLargeText) ? 'High' : 'Medium',
              objRef: {
                type: 'text',
                pattern: pattern.source,
                text: item.str.trim(),
                pageIndex: pi - 1,
              },
            });
            break; // Only match first pattern per text item
          }
        }
      }
    } catch (e) {
      console.warn(`[TextPattern] Scan error on page ${pi}:`, e);
    }
  }

  return found;
}
