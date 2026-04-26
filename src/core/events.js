/**
 * EventBus — Lightweight pub/sub for decoupled component communication.
 * No framework dependency, pure ES module.
 */
export class EventBus {
  constructor() {
    /** @type {Map<string, Set<Function>>} */
    this._listeners = new Map();
  }

  /**
   * Subscribe to an event.
   * @param {string} event
   * @param {Function} handler
   * @returns {Function} Unsubscribe function
   */
  on(event, handler) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event).add(handler);

    // Return unsubscribe function for cleanup
    return () => this.off(event, handler);
  }

  /**
   * Subscribe to an event, but only fire once.
   * @param {string} event
   * @param {Function} handler
   */
  once(event, handler) {
    const wrapper = (...args) => {
      this.off(event, wrapper);
      handler(...args);
    };
    this.on(event, wrapper);
  }

  /**
   * Unsubscribe from an event.
   * @param {string} event
   * @param {Function} handler
   */
  off(event, handler) {
    const handlers = this._listeners.get(event);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) this._listeners.delete(event);
    }
  }

  /**
   * Emit an event with payload.
   * @param {string} event
   * @param {*} payload
   */
  emit(event, payload) {
    const handlers = this._listeners.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(payload);
        } catch (err) {
          console.error(`[EventBus] Error in handler for "${event}":`, err);
        }
      }
    }
  }

  /** Remove all listeners. */
  clear() {
    this._listeners.clear();
  }
}

// Singleton instance
export const bus = new EventBus();

// ─── Event Name Constants ────────────────────────────────────────────────────
export const Events = {
  // PDF lifecycle
  PDF_LOADING: 'pdf:loading',
  PDF_LOADED: 'pdf:loaded',
  PDF_ERROR: 'pdf:error',
  PDF_MODIFIED: 'pdf:modified',
  DOCUMENTS_CHANGED: 'docs:changed',

  // Page navigation
  PAGE_CHANGED: 'page:changed',
  PAGE_RENDERED: 'page:rendered',

  // Tools
  TOOL_CHANGED: 'tool:changed',

  // Zoom
  ZOOM_CHANGED: 'zoom:changed',

  // Annotations
  REDACT_ADDED: 'redact:added',
  REDACT_REMOVED: 'redact:removed',
  TEXT_ADDED: 'text:added',
  TEXT_REMOVED: 'text:removed',

  // Watermark
  WM_SCAN_START: 'wm:scan:start',
  WM_SCAN_COMPLETE: 'wm:scan:complete',
  WM_REMOVE_START: 'wm:remove:start',
  WM_REMOVE_COMPLETE: 'wm:remove:complete',
  WM_ITEM_REMOVED: 'wm:item:removed',

  // Edit mode
  EDIT_MODE_ENTER: 'edit:enter',
  EDIT_MODE_EXIT: 'edit:exit',
  EDIT_OBJECTS_EXTRACTED: 'edit:objects:extracted',
  EDIT_OBJECT_SELECTED: 'edit:object:selected',
  EDIT_OBJECT_DESELECTED: 'edit:object:deselected',
  EDIT_OBJECT_DELETED: 'edit:object:deleted',

  // UI
  TOAST: 'ui:toast',
  MODAL_OPEN: 'ui:modal:open',
  MODAL_CLOSE: 'ui:modal:close',

  // History
  HISTORY_CHANGED: 'history:changed',
};
