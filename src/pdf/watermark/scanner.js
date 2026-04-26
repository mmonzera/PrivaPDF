/**
 * Watermark Scanner — Orchestrates all detection strategies.
 * Uses Strategy pattern for extensibility.
 */
import { bus, Events } from '../../core/events.js';
import { state } from '../../core/state.js';
import t from '../../i18n/index.js';

import { detectXObjectWatermarks } from './strategies/xobject.js';
import { detectOCGWatermarks } from './strategies/ocg.js';
import { detectTextWatermarks } from './strategies/text.js';
import { detectContentStreamWatermarks } from './strategies/content-stream.js';
import { detectAnnotationWatermarks } from './strategies/annotation.js';

/**
 * Run all watermark detection strategies.
 * @returns {Promise<Array>} Array of detected watermark objects
 */
export async function scanWatermarks() {
  if (!state.pdfLibDoc || !state.pdfDoc) return [];

  bus.emit(Events.WM_SCAN_START);
  bus.emit(Events.TOAST, { msg: t('toastScanning'), type: 'info', duration: 2000 });

  const allResults = [];

  // Strategy 1: XObject detection (synchronous)
  try {
    const xobjectResults = detectXObjectWatermarks(state.pdfLibDoc);
    allResults.push(...xobjectResults);
  } catch (e) {
    console.warn('[Scanner] XObject strategy error:', e);
  }

  // Strategy 2: OCG detection (synchronous)
  try {
    const ocgResults = detectOCGWatermarks(state.pdfLibDoc);
    allResults.push(...ocgResults);
  } catch (e) {
    console.warn('[Scanner] OCG strategy error:', e);
  }

  // Strategy 3: Text pattern detection (async — needs pdfjs)
  try {
    const textResults = await detectTextWatermarks(state.pdfDoc);
    allResults.push(...textResults);
  } catch (e) {
    console.warn('[Scanner] Text strategy error:', e);
  }

  // Strategy 4: Content stream analysis (synchronous)
  try {
    const csResults = detectContentStreamWatermarks(state.pdfLibDoc);
    allResults.push(...csResults);
  } catch (e) {
    console.warn('[Scanner] ContentStream strategy error:', e);
  }

  // Strategy 5: Annotation detection (synchronous)
  try {
    const annotResults = detectAnnotationWatermarks(state.pdfLibDoc);
    allResults.push(...annotResults);
  } catch (e) {
    console.warn('[Scanner] Annotation strategy error:', e);
  }

  // Deduplicate by combining same-page, same-type results
  const deduped = deduplicateResults(allResults);

  // Sort by confidence (High first) then by page
  deduped.sort((a, b) => {
    const confOrder = { High: 0, Medium: 1, Low: 2 };
    const confDiff = (confOrder[a.confidence] ?? 2) - (confOrder[b.confidence] ?? 2);
    if (confDiff !== 0) return confDiff;
    return a.pageIndex - b.pageIndex;
  });

  state.watermarks = deduped;

  bus.emit(Events.WM_SCAN_COMPLETE, { results: deduped });

  if (deduped.length > 0) {
    bus.emit(Events.TOAST, {
      msg: t('toastScanResults', { count: deduped.length }),
      type: 'success',
    });
  } else {
    bus.emit(Events.TOAST, { msg: t('toastScanNone'), type: 'info' });
  }

  return deduped;
}

/**
 * Remove duplicate detections.
 */
function deduplicateResults(results) {
  const seen = new Set();
  return results.filter(r => {
    const key = `${r.type}:${r.pageIndex}:${r.key}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
