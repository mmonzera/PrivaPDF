/**
 * OCG Strategy — Detect watermarks in Optional Content Groups.
 * Acrobat and many PDF generators use OCG layers for watermarks.
 */
import { PDFName } from 'pdf-lib';

/**
 * Scan document-level and page-level OCGs for watermark layers.
 * @param {import('pdf-lib').PDFDocument} pdfLibDoc
 * @returns {Array}
 */
export function detectOCGWatermarks(pdfLibDoc) {
  const found = [];

  // 1. Page-level OC references
  const pages = pdfLibDoc.getPages();
  for (let pi = 0; pi < pages.length; pi++) {
    try {
      const oc = pages[pi].node.get(PDFName.of('OC'));
      if (oc) {
        found.push({
          pageIndex: pi,
          type: 'Optional Content Layer',
          key: 'OC',
          description: `Optional content group on page ${pi + 1} — possible watermark layer`,
          confidence: 'Medium',
          objRef: { type: 'oc', pageIndex: pi },
        });
      }
    } catch (e) {}
  }

  // 2. Document-level OCGs
  try {
    const catalog = pdfLibDoc.catalog;
    const ocProps = catalog.get(PDFName.of('OCProperties'));
    if (!ocProps) return found;

    const ocgs = ocProps.get ? ocProps.get(PDFName.of('OCGs')) : null;
    if (!ocgs || !ocgs.asArray) return found;

    const watermarkPatterns = /watermark|draft|confidential|copy|sample|overlay|do\s*not/i;

    ocgs.asArray().forEach((ocgRef, idx) => {
      try {
        const ocg = pdfLibDoc.context.lookup(ocgRef);
        const name = ocg?.get ? ocg.get(PDFName.of('Name')) : null;
        const nameStr = name ? name.toString().replace(/[()]/g, '') : `OCG ${idx}`;
        const isWatermark = watermarkPatterns.test(nameStr);

        found.push({
          pageIndex: -1, // Document-level
          type: 'Document OCG Layer',
          key: nameStr,
          description: `Document-level layer "${nameStr}"${isWatermark ? ' — LIKELY WATERMARK' : ''}`,
          confidence: isWatermark ? 'High' : 'Low',
          objRef: { type: 'ocg', ref: ocgRef, name: nameStr },
        });
      } catch (e) {}
    });
  } catch (e) {
    console.warn('[OCG] Document scan error:', e);
  }

  return found;
}
