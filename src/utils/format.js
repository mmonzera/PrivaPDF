/**
 * Utility functions — formatting, validation, etc.
 */

/**
 * Format bytes into human-readable string.
 * @param {number} bytes
 * @returns {string}
 */
export function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

/**
 * Clamp a number between min and max.
 * @param {number} val
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

/**
 * Debounce a function call.
 * @param {Function} fn
 * @param {number} delay — ms
 * @returns {Function}
 */
export function debounce(fn, delay = 150) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/**
 * Generate a unique ID.
 * @param {string} prefix
 * @returns {string}
 */
export function uid(prefix = 'id') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Safely zero out an ArrayBuffer (for privacy).
 * @param {ArrayBuffer} buffer
 */
export function zeroBuffer(buffer) {
  if (!buffer) return;
  try {
    const view = new Uint8Array(buffer);
    crypto.getRandomValues(view); // Overwrite with random bytes first
    view.fill(0);                 // Then zero out
  } catch (e) {
    // Fallback: just fill with zeros
    new Uint8Array(buffer).fill(0);
  }
}
