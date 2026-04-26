/**
 * Redact Tool — Handles drawing redaction rectangles on the canvas.
 */
import { bus, Events } from '../core/events.js';
import { state } from '../core/state.js';
import { history } from '../core/history.js';
import t from '../i18n/index.js';

let drawState = {
  isDrawing: false,
  startX: 0,
  startY: 0,
  tempRect: null,
};

/**
 * Initialize the redact tool on a given interaction layer.
 * @param {Element} layer — The interaction layer element
 * @returns {Function} Cleanup function
 */
export function initRedactTool(layer) {
  function onMouseDown(e) {
    if (state.activeTool !== 'redact' || !state.pdfDoc) return;

    const rect = layer.getBoundingClientRect();
    drawState.isDrawing = true;
    drawState.startX = e.clientX - rect.left;
    drawState.startY = e.clientY - rect.top;

    // Create temporary visual rect
    const dr = document.createElement('div');
    dr.style.cssText = `position:absolute;left:${drawState.startX}px;top:${drawState.startY}px;width:0;height:0;background:rgba(0,0,0,0.5);border:1px dashed #c0513a;pointer-events:none;z-index:10;`;
    layer.appendChild(dr);
    drawState.tempRect = dr;
  }

  function onMouseMove(e) {
    if (!drawState.isDrawing || !drawState.tempRect) return;

    const rect = layer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const w = x - drawState.startX;
    const h = y - drawState.startY;

    const left = w < 0 ? x : drawState.startX;
    const top = h < 0 ? y : drawState.startY;

    drawState.tempRect.style.left = left + 'px';
    drawState.tempRect.style.top = top + 'px';
    drawState.tempRect.style.width = Math.abs(w) + 'px';
    drawState.tempRect.style.height = Math.abs(h) + 'px';
  }

  function onMouseUp(e) {
    if (!drawState.isDrawing) return;
    drawState.isDrawing = false;

    const rect = layer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const rw = Math.abs(x - drawState.startX);
    const rh = Math.abs(y - drawState.startY);

    // Clean up temp rect
    if (drawState.tempRect) {
      drawState.tempRect.remove();
      drawState.tempRect = null;
    }

    // Minimum size threshold
    if (rw > 5 && rh > 5) {
      const rx = Math.min(x, drawState.startX);
      const ry = Math.min(y, drawState.startY);

      const redactRect = {
        page: state.currentPage,
        x: rx, y: ry, w: rw, h: rh,
        // Store in PDF coordinates (unscaled)
        pdfX: rx / state.zoom,
        pdfY: ry / state.zoom,
        pdfW: rw / state.zoom,
        pdfH: rh / state.zoom,
      };

      // Use history for undo support
      history.execute({
        description: `Redact area on page ${state.currentPage}`,
        execute: () => {
          state.redactRects = [...state.redactRects, redactRect];
          state.modified = true;
          bus.emit(Events.REDACT_ADDED, { rect: redactRect });
        },
        undo: () => {
          state.redactRects = state.redactRects.filter(r => r !== redactRect);
          bus.emit(Events.REDACT_REMOVED, { rect: redactRect });
        },
      });

      bus.emit(Events.TOAST, {
        msg: t('toastRedactAdded', { page: state.currentPage }),
        type: 'success',
        duration: 2000,
      });
    }
  }

  layer.addEventListener('mousedown', onMouseDown);
  layer.addEventListener('mousemove', onMouseMove);
  layer.addEventListener('mouseup', onMouseUp);

  // Return cleanup
  return () => {
    layer.removeEventListener('mousedown', onMouseDown);
    layer.removeEventListener('mousemove', onMouseMove);
    layer.removeEventListener('mouseup', onMouseUp);
  };
}

/**
 * Remove a specific redact rect.
 * @param {Object} rect
 */
export function removeRedactRect(rect) {
  history.execute({
    description: `Remove redact area from page ${rect.page}`,
    execute: () => {
      state.redactRects = state.redactRects.filter(r => r !== rect);
      bus.emit(Events.REDACT_REMOVED, { rect });
    },
    undo: () => {
      state.redactRects = [...state.redactRects, rect];
      state.modified = true;
      bus.emit(Events.REDACT_ADDED, { rect });
    },
  });
}
