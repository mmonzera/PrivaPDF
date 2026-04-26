/**
 * Watermark Remover — Removes detected watermarks from PDF structure.
 * Supports both batch removal and per-item selective removal.
 */
import { PDFName } from 'pdf-lib';
import { bus, Events } from '../../core/events.js';
import { state } from '../../core/state.js';
import { reloadFromBytes } from '../loader.js';
import t from '../../i18n/index.js';

/**
 * Remove a SINGLE watermark from the PDF.
 * Each removal is independent — failure doesn't block other removals.
 * @param {Object} wm — The watermark to remove
 * @returns {Promise<boolean>}
 */
export async function removeSingleWatermark(wm) {
  if (!state.pdfLibDoc) return false;

  try {
    const pages = state.pdfLibDoc.getPages();
    const success = removeWatermark(wm, pages);

    if (success) {
      // Re-serialize and reload
      const newBytes = await state.pdfLibDoc.save();
      await reloadFromBytes(newBytes);

      // Remove this item from the watermarks list
      state.watermarks = state.watermarks.filter(w => w !== wm);
      state.modified = true;

      bus.emit(Events.WM_ITEM_REMOVED, { wm, remaining: state.watermarks.length });
      bus.emit(Events.TOAST, {
        msg: t('toastWmItemRemoved', { type: wm.type }),
        type: 'success',
        duration: 2000,
      });

      return true;
    } else {
      bus.emit(Events.TOAST, {
        msg: t('toastWmItemFailed', { type: wm.type }),
        type: 'error',
        duration: 3000,
      });
      return false;
    }
  } catch (err) {
    console.error('[Remover] Single removal error:', err);
    bus.emit(Events.TOAST, {
      msg: t('toastRemoveError', { error: err.message }),
      type: 'error',
    });
    return false;
  }
}

/**
 * Remove selected watermarks from the PDF.
 * @param {Array} selectedWatermarks — Array of watermarks to remove
 * @returns {Promise<number>} Count of successfully removed
 */
export async function removeSelectedWatermarks(selectedWatermarks) {
  if (!state.pdfLibDoc || selectedWatermarks.length === 0) return 0;

  bus.emit(Events.WM_REMOVE_START);
  bus.emit(Events.TOAST, { msg: t('toastRemoving'), type: 'info', duration: 3000 });

  let removed = 0;
  const pages = state.pdfLibDoc.getPages();

  // Try each one independently
  for (const wm of selectedWatermarks) {
    try {
      if (removeWatermark(wm, pages)) {
        removed++;
      }
    } catch (e) {
      console.warn('[Remover] Error removing watermark:', wm.type, e);
    }
  }

  if (removed > 0) {
    // Re-serialize and reload ONCE after all removals
    try {
      const newBytes = await state.pdfLibDoc.save();
      await reloadFromBytes(newBytes);

      // Remove successful items from list
      const removedSet = new Set(selectedWatermarks.filter((_, i) => i < removed));
      state.watermarks = state.watermarks.filter(w => !removedSet.has(w));
      state.modified = true;
    } catch (err) {
      console.error('[Remover] Re-serialize error:', err);
    }
  }

  bus.emit(Events.WM_REMOVE_COMPLETE, { removed });
  bus.emit(Events.TOAST, {
    msg: t('toastRemoved', { count: removed }),
    type: removed > 0 ? 'success' : 'error',
    duration: 4000,
  });

  return removed;
}

/**
 * Legacy: Remove ALL detected watermarks.
 * @returns {Promise<number>}
 */
export async function removeWatermarks() {
  return removeSelectedWatermarks([...state.watermarks]);
}

// ─── Internal removal functions ───────────────────────────────────────────────

function removeWatermark(wm, pages) {
  const ref = wm.objRef;
  switch (ref.type) {
    case 'xobject': return removeXObject(wm, pages);
    case 'ocg': return removeOCG(wm);
    case 'annotation': return removeAnnotation(wm, pages);
    case 'content-stream': return removeContentStreamMarker(wm, pages);
    case 'text': return false; // Use manual redact
    default: return false;
  }
}

function removeXObject(wm, pages) {
  if (wm.pageIndex < 0 || wm.pageIndex >= pages.length) return false;
  const page = pages[wm.pageIndex];
  
  const resourcesRef = page.node.get(PDFName.of('Resources'));
  const resources = state.pdfLibDoc.context.lookup(resourcesRef);
  if (!resources) return false;

  const xObjectsRef = resources.get(PDFName.of('XObject'));
  const xObjects = state.pdfLibDoc.context.lookup(xObjectsRef);
  if (!xObjects || !xObjects.delete) return false;

  const keyName = wm.objRef.key.startsWith('/') ? wm.objRef.key.slice(1) : wm.objRef.key;
  xObjects.delete(PDFName.of(keyName));
  return true;
}

function removeOCG(wm) {
  try {
    const catalog = state.pdfLibDoc.catalog;
    const ocProps = catalog.get(PDFName.of('OCProperties'));
    if (!ocProps) return false;
    const d = ocProps.get(PDFName.of('D'));
    if (d && wm.objRef.ref) {
      d.set(PDFName.of('BaseState'), PDFName.of('OFF'));
      try {
        const onArray = d.get(PDFName.of('ON'));
        if (onArray && onArray.asArray) {
          const arr = onArray.asArray();
          const idx = arr.indexOf(wm.objRef.ref);
          if (idx >= 0) arr.splice(idx, 1);
        }
      } catch (e) {}
      return true;
    }
    return false;
  } catch (e) {
    console.warn('[Remover] OCG removal error:', e);
    return false;
  }
}

function removeAnnotation(wm, pages) {
  if (wm.pageIndex < 0 || wm.pageIndex >= pages.length) return false;
  try {
    const page = pages[wm.pageIndex];
    const annotsRef = page.node.get(PDFName.of('Annots'));
    if (!annotsRef) return false;
    const annots = state.pdfLibDoc.context.lookup(annotsRef);
    if (!annots || !annots.asArray) return false;
    const arr = annots.asArray();
    const idx = arr.indexOf(wm.objRef.ref);
    if (idx >= 0) { arr.splice(idx, 1); return true; }
  } catch (e) {
    console.warn('[Remover] Annotation removal error:', e);
  }
  return false;
}

function removeContentStreamMarker(wm, pages) {
  console.info('[Remover] Content stream watermark — recommend manual redact.');
  return false;
}
