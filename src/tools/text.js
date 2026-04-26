/**
 * Text Tool — Handles placing text annotations on the canvas.
 */
import { bus, Events } from '../core/events.js';
import { state } from '../core/state.js';
import { history } from '../core/history.js';
import { makeDraggable } from '../utils/draggable.js';
import { uid } from '../utils/format.js';
import t from '../i18n/index.js';

/** @type {Map<string, Function>} Cleanup functions for draggable instances */
const cleanupMap = new Map();

/**
 * Initialize text tool click handling.
 * @param {Element} layer — Interaction layer
 * @returns {Function} Cleanup
 */
export function initTextTool(layer) {
  function onClick(e) {
    if (state.activeTool !== 'text' || !state.pdfDoc) return;

    const rect = layer.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    addTextAnnotation(x, y);
  }

  layer.addEventListener('mousedown', onClick);
  return () => layer.removeEventListener('mousedown', onClick);
}

/**
 * Add a text annotation at the specified position.
 * @param {number} x
 * @param {number} y
 */
export function addTextAnnotation(x, y) {
  const annotLayer = document.getElementById('annotation-layer');
  if (!annotLayer) return;

  const id = uid('text');
  const el = document.createElement('div');
  el.className = 'text-overlay';
  el.style.cssText = `left:${x}px;top:${y}px;pointer-events:auto;`;
  el.dataset.id = id;

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = t('textPlaceholder');
  input.style.fontFamily = 'sans-serif';

  const del = document.createElement('div');
  del.className = 'del-btn';
  del.innerHTML = '×';

  el.appendChild(input);
  el.appendChild(del);

  const annotation = {
    id,
    page: state.currentPage,
    x, y,
    pdfX: x / state.zoom,
    pdfY: y / state.zoom,
    text: '',
    el,
  };

  // Track input changes
  input.addEventListener('input', () => {
    annotation.text = input.value;
    state.modified = true;
  });

  // Delete button
  del.addEventListener('click', (e) => {
    e.stopPropagation();
    removeTextAnnotation(annotation);
  });

  // Make draggable with cleanup
  const dragCleanup = makeDraggable(el, {
    onMove: (newX, newY) => {
      annotation.x = newX;
      annotation.y = newY;
      annotation.pdfX = newX / state.zoom;
      annotation.pdfY = newY / state.zoom;
    },
  });
  cleanupMap.set(id, dragCleanup);

  // Execute via history for undo support
  history.execute({
    description: `Add text on page ${state.currentPage}`,
    execute: () => {
      state.textAnnotations = [...state.textAnnotations, annotation];
      state.modified = true;
      annotLayer.appendChild(el);
      input.focus();
      bus.emit(Events.TEXT_ADDED, { annotation });
    },
    undo: () => {
      state.textAnnotations = state.textAnnotations.filter(a => a.id !== id);
      el.remove();
      bus.emit(Events.TEXT_REMOVED, { annotation });
    },
  });
}

/**
 * Remove a text annotation.
 * @param {Object} annotation
 */
export function removeTextAnnotation(annotation) {
  history.execute({
    description: `Remove text from page ${annotation.page}`,
    execute: () => {
      state.textAnnotations = state.textAnnotations.filter(a => a.id !== annotation.id);
      annotation.el.remove();

      // Cleanup draggable listeners
      const cleanup = cleanupMap.get(annotation.id);
      if (cleanup) {
        cleanup();
        cleanupMap.delete(annotation.id);
      }

      bus.emit(Events.TEXT_REMOVED, { annotation });
    },
    undo: () => {
      state.textAnnotations = [...state.textAnnotations, annotation];
      state.modified = true;
      const annotLayer = document.getElementById('annotation-layer');
      annotLayer?.appendChild(annotation.el);
      bus.emit(Events.TEXT_ADDED, { annotation });
    },
  });
}

/**
 * Render text annotations for the current page.
 * @param {Element} annotLayer
 */
export function renderTextAnnotations(annotLayer) {
  if (!annotLayer) return;

  state.textAnnotations
    .filter(a => a.page === state.currentPage)
    .forEach(a => {
      if (!a.el.parentElement) {
        annotLayer.appendChild(a.el);
      }
    });
}
