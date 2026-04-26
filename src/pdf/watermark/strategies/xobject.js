/**
 * XObject Strategy — Detect watermarks embedded as Form XObjects with transparency.
 */
import { PDFName } from 'pdf-lib';

/**
 * Scan for transparent Form XObjects (common watermark carrier).
 * @param {import('pdf-lib').PDFDocument} pdfLibDoc
 * @returns {Array} Detected watermark items
 */
export function detectXObjectWatermarks(pdfLibDoc) {
  const found = [];
  const pages = pdfLibDoc.getPages();

  for (let pi = 0; pi < pages.length; pi++) {
    try {
      const page = pages[pi];
      const resources = page.node.get(PDFName.of('Resources'));
      if (!resources) continue;

      const xObject = resources.get ? resources.get(PDFName.of('XObject')) : null;
      if (!xObject) continue;

      const keys = xObject.keys ? xObject.keys() : [];
      for (const key of keys) {
        const xobj = xObject.get(key);
        if (!xobj || !xobj.get) continue;

        const subtype = xobj.get(PDFName.of('Subtype'));
        const subtypeStr = subtype ? subtype.toString() : '';

        // Form XObjects are common watermark carriers
        if (subtypeStr === '/Form') {
          const group = xobj.get(PDFName.of('Group'));

          // Transparency group = likely watermark overlay
          if (group) {
            found.push({
              pageIndex: pi,
              type: 'Form XObject (Transparency)',
              key: key.toString(),
              description: `Transparent form object "${key.toString()}" on page ${pi + 1}`,
              confidence: 'High',
              objRef: { type: 'xobject', pageIndex: pi, key: key.toString() },
            });
          }

          // Check for low-opacity form XObjects even without Group
          try {
            const extGState = resources.get(PDFName.of('ExtGState'));
            if (extGState) {
              const gsKeys = extGState.keys ? extGState.keys() : [];
              for (const gsKey of gsKeys) {
                const gs = extGState.get(gsKey);
                if (!gs || !gs.get) continue;
                const ca = gs.get(PDFName.of('CA'));  // Stroke opacity
                const ca2 = gs.get(PDFName.of('ca')); // Fill opacity
                const opacity = ca?.value ?? ca2?.value ?? 1;
                if (typeof opacity === 'number' && opacity < 0.5) {
                  // Low opacity graphics state = potential watermark
                  found.push({
                    pageIndex: pi,
                    type: 'Low Opacity XObject',
                    key: key.toString(),
                    description: `Form object "${key.toString()}" with opacity ${opacity.toFixed(2)} on page ${pi + 1}`,
                    confidence: 'Medium',
                    objRef: { type: 'xobject', pageIndex: pi, key: key.toString() },
                  });
                  break;
                }
              }
            }
          } catch (e) {}
        }
      }
    } catch (e) {
      console.warn('[XObject] Scan error on page', pi + 1, e);
    }
  }

  return found;
}
