/**
 * Annotation Strategy — Detect watermarks embedded as PDF annotations.
 */
import { PDFName } from 'pdf-lib';

/**
 * Scan for watermark-type annotations and stamp annotations.
 * @param {import('pdf-lib').PDFDocument} pdfLibDoc
 * @returns {Array}
 */
export function detectAnnotationWatermarks(pdfLibDoc) {
  const found = [];
  const pages = pdfLibDoc.getPages();

  for (let pi = 0; pi < pages.length; pi++) {
    try {
      const page = pages[pi];
      const annotsRef = page.node.get(PDFName.of('Annots'));
      if (!annotsRef) continue;

      const annots = pdfLibDoc.context.lookup(annotsRef);
      if (!annots || !annots.asArray) continue;

      for (const annotRef of annots.asArray()) {
        try {
          const annot = pdfLibDoc.context.lookup(annotRef);
          if (!annot || !annot.get) continue;

          const subtype = annot.get(PDFName.of('Subtype'));
          const subtypeStr = subtype ? subtype.toString() : '';

          // Check for /Watermark subtype
          if (subtypeStr === '/Watermark') {
            found.push({
              pageIndex: pi,
              type: 'Watermark Annotation',
              key: 'Annot-Watermark',
              description: `Watermark annotation on page ${pi + 1}`,
              confidence: 'High',
              objRef: { type: 'annotation', pageIndex: pi, ref: annotRef, subtype: 'Watermark' },
            });
          }

          // Check for Stamp annotations that may be watermarks
          if (subtypeStr === '/Stamp') {
            const name = annot.get(PDFName.of('Name'));
            const nameStr = name ? name.toString() : '';
            const contents = annot.get(PDFName.of('Contents'));
            const contentsStr = contents ? contents.toString() : '';

            const wmPatterns = /watermark|draft|confidential|copy|sample|approved|not approved/i;

            if (wmPatterns.test(nameStr) || wmPatterns.test(contentsStr)) {
              found.push({
                pageIndex: pi,
                type: 'Stamp Annotation (Watermark)',
                key: nameStr || 'Stamp',
                description: `Stamp "${nameStr || contentsStr}" on page ${pi + 1} — likely watermark`,
                confidence: 'High',
                objRef: { type: 'annotation', pageIndex: pi, ref: annotRef, subtype: 'Stamp' },
              });
            }
          }
        } catch (e) {}
      }
    } catch (e) {
      console.warn(`[Annotation] Scan error on page ${pi + 1}:`, e);
    }
  }

  return found;
}
