/**
 * Draggable Mixin — Attach drag behavior to elements with proper cleanup.
 * Fixes the memory leak in the original code where global listeners were never removed.
 */

/**
 * Make an element draggable.
 * @param {Element} el — The element to make draggable
 * @param {Object} opts
 * @param {Function} opts.onMove — (x, y) callback during drag
 * @param {Function} opts.onEnd — (x, y) callback when drag ends
 * @param {string[]} opts.ignoreTags — Tag names to ignore (e.g., 'INPUT')
 * @param {string[]} opts.ignoreClasses — Class names to ignore (e.g., 'del-btn')
 * @returns {Function} Cleanup function to remove all listeners
 */
export function makeDraggable(el, opts = {}) {
  const { onMove, onEnd, ignoreTags = ['INPUT'], ignoreClasses = ['del-btn'] } = opts;

  let isDragging = false;
  let offsetX = 0;
  let offsetY = 0;

  function handleMouseDown(e) {
    // Skip if clicking on ignored elements
    if (ignoreTags.includes(e.target.tagName)) return;
    if (ignoreClasses.some(cls => e.target.classList.contains(cls))) return;

    isDragging = true;
    offsetX = e.clientX - parseInt(el.style.left || 0);
    offsetY = e.clientY - parseInt(el.style.top || 0);
    e.preventDefault();
  }

  function handleMouseMove(e) {
    if (!isDragging) return;
    const x = e.clientX - offsetX;
    const y = e.clientY - offsetY;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    onMove?.(x, y);
  }

  function handleMouseUp() {
    if (!isDragging) return;
    isDragging = false;
    const x = parseInt(el.style.left || 0);
    const y = parseInt(el.style.top || 0);
    onEnd?.(x, y);
  }

  el.addEventListener('mousedown', handleMouseDown);
  document.addEventListener('mousemove', handleMouseMove);
  document.addEventListener('mouseup', handleMouseUp);

  // Return cleanup function — call this to prevent memory leaks
  return () => {
    el.removeEventListener('mousedown', handleMouseDown);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', handleMouseUp);
  };
}
