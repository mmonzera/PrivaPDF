/**
 * Reactive State — Proxy-based observable state management.
 * Emits events on state changes without any framework dependency.
 */
import { bus, Events } from './events.js';

const initialState = {
  // PDF documents
  pdfDoc: null,       // pdfjs document (for rendering)
  pdfLibDoc: null,    // pdf-lib document (for manipulation)
  pdfBytes: null,     // Current ArrayBuffer
  
  // Document Library
  documents: [],      // Array of loaded documents: { id, name, size, bytes }
  activeDocumentId: null,

  // Navigation
  currentPage: 1,
  totalPages: 0,

  // View
  zoom: 1.0,
  activeTool: 'select',

  // File info
  fileName: '',
  fileSize: 0,

  // Annotations (per-page arrays)
  watermarks: [],      // Detected watermarks
  redactRects: [],     // Manual redaction areas
  textAnnotations: [], // Text overlay annotations
  hiddenTextBlocks: [], // Blocks removed via white-out

  // Drawing state (transient, not persisted)
  isDrawing: false,
  drawStart: null,

  // Flags
  modified: false,
  isLoading: false,
  isPdfLoaded: false,
};

/**
 * Creates a reactive state object that emits events on changes.
 */
function createState() {
  const _state = { ...initialState };
  const _watchers = new Map();

  const handler = {
    get(target, prop) {
      return target[prop];
    },

    set(target, prop, value) {
      const oldValue = target[prop];
      if (oldValue === value) return true;

      target[prop] = value;

      // Fire property-specific watchers
      const watchers = _watchers.get(prop);
      if (watchers) {
        for (const fn of watchers) {
          try {
            fn(value, oldValue, prop);
          } catch (err) {
            console.error(`[State] Watcher error for "${prop}":`, err);
          }
        }
      }

      return true;
    },
  };

  const proxy = new Proxy(_state, handler);

  /**
   * Watch a specific property for changes.
   * @param {string} prop
   * @param {Function} callback — (newVal, oldVal, prop)
   * @returns {Function} Unwatch function
   */
  proxy.$watch = (prop, callback) => {
    if (!_watchers.has(prop)) {
      _watchers.set(prop, new Set());
    }
    _watchers.get(prop).add(callback);
    return () => _watchers.get(prop)?.delete(callback);
  };

  /**
   * Reset state to initial values (keeps proxy alive).
   */
  proxy.$reset = () => {
    for (const [key, val] of Object.entries(initialState)) {
      proxy[key] = val;
    }
  };

  /**
   * Batch update multiple properties.
   * @param {Object} updates
   */
  proxy.$patch = (updates) => {
    for (const [key, val] of Object.entries(updates)) {
      proxy[key] = val;
    }
  };

  return proxy;
}

export const state = createState();
export default state;
