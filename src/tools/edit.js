/**
 * Edit Tool — Adobe Acrobat-style PDF element editing.
 * Shows all text blocks, images, and XObjects as interactive overlays.
 * User can select and delete individual elements.
 */
import { bus, Events } from '../core/events.js';
import { state } from '../core/state.js';
import { history } from '../core/history.js';
import { extractAllObjects } from '../pdf/object-extractor.js';
import { removeObject, replaceTextInPage, moveObject } from '../pdf/object-remover.js';
import { renderPage } from '../pdf/renderer.js';
import { reloadFromBytes } from '../pdf/loader.js';
import { $ } from '../utils/dom.js';
import t from '../i18n/index.js';

/** Currently extracted objects for the active page */
let currentObjects = [];
/** Currently selected object */
let selectedObject = null;
/** Overlay container element */
let overlayContainer = null;

/**
 * Enter edit mode — extract objects and create overlays.
 */
export async function enterEditMode() {
  if (!state.pdfDoc) return;

  const page = await state.pdfDoc.getPage(state.currentPage);
  const viewport = page.getViewport({ scale: state.zoom });

  // Extract all objects
  currentObjects = await extractAllObjects(page, viewport);
  selectedObject = null;

  // Create overlay container
  createOverlayContainer();

  // Render object overlays
  renderObjectOverlays();

  bus.emit(Events.EDIT_OBJECTS_EXTRACTED, {
    objects: currentObjects,
    pageNum: state.currentPage,
  });
}

/**
 * Exit edit mode — remove all overlays.
 */
export function exitEditMode() {
  if (overlayContainer) {
    overlayContainer.innerHTML = '';
    overlayContainer.classList.add('hidden');
  }
  currentObjects = [];
  selectedObject = null;
  bus.emit(Events.EDIT_OBJECT_DESELECTED);
}

/**
 * Create the overlay container if it doesn't exist.
 */
function createOverlayContainer() {
  overlayContainer = $('#edit-overlay-layer');
  if (!overlayContainer) {
    const pageContainer = $('#page-container');
    overlayContainer = document.createElement('div');
    overlayContainer.id = 'edit-overlay-layer';
    overlayContainer.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;z-index:5;pointer-events:none;';
    pageContainer.appendChild(overlayContainer);
  }
  overlayContainer.innerHTML = '';
  overlayContainer.classList.remove('hidden');
}

/**
 * Render all object overlays on the canvas.
 */
function renderObjectOverlays() {
  if (!overlayContainer) return;

  currentObjects.forEach(obj => {
    const el = document.createElement('div');
    el.className = `pdf-object-overlay pdf-object-${obj.type}`;
    el.dataset.objectId = obj.id;
    el.style.cssText = `
      left: ${obj.x}px;
      top: ${obj.y}px;
      width: ${obj.w}px;
      height: ${obj.h}px;
      transform: rotate(${- (obj.angle || 0)}rad);
      transform-origin: left bottom;
      pointer-events: auto;
    `;

    // Type label
    const label = document.createElement('span');
    label.className = 'object-label';
    label.textContent = getTypeLabel(obj.type);
    el.appendChild(label);

    // Click to select AND drag to move
    let isDragging = false;
    let startX = 0, startY = 0;
    let initialLeft = 0, initialTop = 0;
    let moved = false;

    el.addEventListener('mousedown', (e) => {
      // Ignore if clicking on inline text editor or delete button
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.target.classList.contains('object-delete-btn')) return;
      e.stopPropagation();
      e.preventDefault();

      selectObject(obj, el);
      
      isDragging = true;
      moved = false;
      startX = e.clientX;
      startY = e.clientY;
      initialLeft = parseFloat(el.style.left) || obj.x;
      initialTop = parseFloat(el.style.top) || obj.y;
      
      el.style.cursor = 'grabbing';
      
      const onMouseMove = (moveEvent) => {
        if (!isDragging) return;
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved = true;
        
        if (moved) {
          el.style.left = `${initialLeft + dx}px`;
          el.style.top = `${initialTop + dy}px`;
        }
      };
      
      const onMouseUp = async (upEvent) => {
        isDragging = false;
        el.style.cursor = 'grab';
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        
        if (moved) {
          const dx = upEvent.clientX - startX;
          const dy = upEvent.clientY - startY;
          
          // Execute move mathematically
          const dxPdf = dx / state.zoom;
          const dyPdf = -dy / state.zoom; // In PDF, Y goes up!

          const pageIndex = state.currentPage - 1;
          
          const beforeBytes = state.pdfBytes ? state.pdfBytes.slice() : null;
          const pageBefore = state.currentPage;
          let afterBytes = null;

          history.execute({
            description: `Move object on page ${state.currentPage}`,
            execute: async () => {
              if (afterBytes) {
                await reloadFromBytes(afterBytes);
                await renderPage(pageBefore);
                if (state.activeTool === 'edit') await enterEditMode();
              } else {
                const success = await moveObject(obj, pageIndex, dxPdf, dyPdf);
                if (success) {
                  afterBytes = state.pdfBytes ? state.pdfBytes.slice() : null;
                  await renderPage(state.currentPage);
                  if (state.activeTool === 'edit') await enterEditMode();
                } else {
                  // snap back on fail
                  el.style.left = `${initialLeft}px`;
                  el.style.top = `${initialTop}px`;
                  bus.emit(Events.TOAST, { msg: t('toastObjectDeleteError', { error: 'Not Supported' }), type: 'error' });
                }
              }
            },
            undo: async () => {
              if (beforeBytes) {
                await reloadFromBytes(beforeBytes);
                await renderPage(pageBefore);
                if (state.activeTool === 'edit') await enterEditMode();
              }
            }
          });
        }
      };
      
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });

    el.style.cursor = 'grab';

    // Hover preview (show content snippet)
    if (obj.type === 'text' && obj.str) {
      el.title = obj.str.length > 100 ? obj.str.slice(0, 100) + '...' : obj.str;
      
      // Double click to edit text inline
      el.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        startTextEdit(obj, el);
      });
    }

    overlayContainer.appendChild(el);
  });
}

/**
 * Start inline text editing.
 * @param {Object} obj 
 * @param {Element} el 
 */
function startTextEdit(obj, el) {
  if (el.querySelector('.edit-textarea')) return;

  const textarea = document.createElement('textarea');
  textarea.className = 'edit-textarea';
  textarea.value = obj.str;
  textarea.style.cssText = `
    position: absolute;
    top: 0; left: 0;
    width: 100%; height: 100%;
    min-width: 150px; min-height: 24px;
    font-size: ${Math.max(obj.fontSize * state.zoom, 12)}px;
    font-family: sans-serif;
    background: white;
    color: black;
    border: 2px solid var(--accent);
    outline: none;
    resize: both;
    z-index: 10;
    padding: 2px;
  `;

  el.appendChild(textarea);
  textarea.focus();

  const label = el.querySelector('.object-label');
  if (label) label.style.display = 'none';

  const saveEdit = async () => {
    if (!el.contains(textarea)) return; // already saved/removed
    const newText = textarea.value.trim();
    
    if (newText && newText !== obj.str) {
      textarea.disabled = true; // prevent double submit
      const pageIndex = state.currentPage - 1;
      
      const beforeBytes = state.pdfBytes ? state.pdfBytes.slice() : null;
      const pageBefore = state.currentPage;
      let afterBytes = null;

      history.execute({
        description: `Edit text on page ${state.currentPage}`,
        execute: async () => {
          if (afterBytes) {
            // Redo
            await reloadFromBytes(afterBytes);
            await renderPage(pageBefore);
            if (state.activeTool === 'edit') await enterEditMode();
          } else {
            // First time
            const success = await replaceTextInPage(pageIndex, obj, newText);
            if (success) {
              afterBytes = state.pdfBytes ? state.pdfBytes.slice() : null;
              await renderPage(state.currentPage);
              if (state.activeTool === 'edit') {
                await enterEditMode();
              }
            } else {
              textarea.disabled = false;
            }
          }
        },
        undo: async () => {
          if (beforeBytes) {
            await reloadFromBytes(beforeBytes);
            await renderPage(pageBefore);
            if (state.activeTool === 'edit') await enterEditMode();
          }
        }
      });
    } else {
      textarea.remove();
      if (label) label.style.display = 'block';
    }
  };

  textarea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      saveEdit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      textarea.remove();
      if (label) label.style.display = 'block';
    }
  });

  textarea.addEventListener('blur', () => {
    saveEdit();
  });
}

/**
 * Select an object — highlight it and show properties.
 * @param {Object} obj
 * @param {Element} el
 */
export function selectObject(obj, el) {
  // Deselect previous
  if (selectedObject) {
    const prevEl = overlayContainer?.querySelector(`.pdf-object-selected`);
    if (prevEl) {
      prevEl.classList.remove('pdf-object-selected');
      const oldDeleteBtn = prevEl.querySelector('.object-delete-btn');
      if (oldDeleteBtn) oldDeleteBtn.remove();
    }
  }

  selectedObject = obj;
  el.classList.add('pdf-object-selected');

  // Add delete button
  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'object-delete-btn';
  deleteBtn.innerHTML = '×';
  deleteBtn.title = t('editDeleteObject');
  deleteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    deleteSelectedObject();
  });
  el.appendChild(deleteBtn);

  bus.emit(Events.EDIT_OBJECT_SELECTED, { object: obj });
}

/**
 * Deselect current object.
 */
export function deselectObject() {
  if (!selectedObject || !overlayContainer) return;

  const el = overlayContainer.querySelector('.pdf-object-selected');
  if (el) {
    el.classList.remove('pdf-object-selected');
    const deleteBtn = el.querySelector('.object-delete-btn');
    if (deleteBtn) deleteBtn.remove();
  }

  selectedObject = null;
  bus.emit(Events.EDIT_OBJECT_DESELECTED);
}

/**
 * Delete the currently selected object.
 */
export async function deleteSelectedObject() {
  if (!selectedObject) return;

  const obj = selectedObject;
  const pageIndex = state.currentPage - 1;

  // Store for undo
  const objCopy = { ...obj };
  const beforeBytes = state.pdfBytes ? state.pdfBytes.slice() : null;
  const pageBefore = state.currentPage;
  let afterBytes = null;

  history.execute({
    description: `Delete ${obj.type} from page ${state.currentPage}`,
    execute: async () => {
      if (afterBytes) {
        await reloadFromBytes(afterBytes);
        currentObjects = currentObjects.filter(o => o.id !== obj.id);
        selectedObject = null;
        await renderPage(pageBefore);
        if (state.activeTool === 'edit') await enterEditMode();
      } else {
        const success = await removeObject(obj, pageIndex);
        if (success) {
          afterBytes = state.pdfBytes ? state.pdfBytes.slice() : null;
          currentObjects = currentObjects.filter(o => o.id !== obj.id);
          selectedObject = null;
          await renderPage(state.currentPage);
          if (state.activeTool === 'edit') {
            await enterEditMode();
          }
        }
      }
    },
    undo: async () => {
      if (beforeBytes) {
        await reloadFromBytes(beforeBytes);
        // We don't restore `currentObjects` directly, it will be re-extracted on re-enter edit mode!
        selectedObject = null;
        await renderPage(pageBefore);
        if (state.activeTool === 'edit') await enterEditMode();
      }
    },
  });
}

/**
 * Get a display label for an object type.
 */
function getTypeLabel(type) {
  return {
    text: 'TXT',
    image: 'IMG',
    xobject: 'OBJ',
  }[type] || type.toUpperCase();
}

/**
 * Get the currently selected object.
 * @returns {Object|null}
 */
export function getSelectedObject() {
  return selectedObject;
}

/**
 * Get all extracted objects for the current page.
 * @returns {Array}
 */
export function getCurrentObjects() {
  return currentObjects;
}

/**
 * Handle keyboard events in edit mode.
 * @param {KeyboardEvent} e
 */
export function handleEditKeyboard(e) {
  if (state.activeTool !== 'edit') return;

  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (selectedObject && e.target.tagName !== 'INPUT') {
      e.preventDefault();
      deleteSelectedObject();
    }
  }

  if (e.key === 'Escape') {
    deselectObject();
  }
}
