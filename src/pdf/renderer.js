/**
 * PDF Renderer — Handles canvas rendering and thumbnail generation.
 */
import { bus, Events } from '../core/events.js';
import { state } from '../core/state.js';
import { $ } from '../utils/dom.js';

/**
 * Render a specific page to the main canvas.
 * @param {number} pageNum — 1-indexed page number
 */
export async function renderPage(pageNum) {
  if (!state.pdfDoc) return;

  state.currentPage = pageNum;

  const page = await state.pdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale: state.zoom });

  const canvas = $('#pdf-canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  // Resize overlay layers to match canvas
  const il = $('#interaction-layer');
  const al = $('#annotation-layer');
  if (il) {
    il.style.width = viewport.width + 'px';
    il.style.height = viewport.height + 'px';
  }
  if (al) {
    al.style.width = viewport.width + 'px';
    al.style.height = viewport.height + 'px';
  }

  await page.render({ canvasContext: ctx, viewport }).promise;

  bus.emit(Events.PAGE_RENDERED, { pageNum, viewport });
  bus.emit(Events.PAGE_CHANGED, { pageNum, totalPages: state.totalPages });
}

/**
 * Build all page thumbnails in the sidebar.
 * @param {Element} container — The thumbnail list container
 */
export async function buildThumbnails(container) {
  if (!state.pdfDoc || !container) return;

  container.innerHTML = '';

  for (let i = 1; i <= state.totalPages; i++) {
    const wrapper = document.createElement('div');
    wrapper.className = 'page-thumb' + (i === state.currentPage ? ' active' : '');
    wrapper.dataset.page = i;

    const thumbCanvas = document.createElement('canvas');
    const numEl = document.createElement('div');
    numEl.className = 'page-thumb-num';
    numEl.textContent = i;

    wrapper.appendChild(thumbCanvas);
    wrapper.appendChild(numEl);

    wrapper.addEventListener('click', () => {
      renderPage(i);
    });

    container.appendChild(wrapper);

    // Render thumbnail asynchronously
    renderThumbnail(i, thumbCanvas);
  }
}

/**
 * Render a single page thumbnail.
 * @param {number} pageNum
 * @param {HTMLCanvasElement} canvas
 */
async function renderThumbnail(pageNum, canvas) {
  try {
    const page = await state.pdfDoc.getPage(pageNum);
    const vp = page.getViewport({ scale: 0.2 });
    canvas.width = vp.width;
    canvas.height = vp.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
  } catch (err) {
    console.warn(`[Renderer] Thumb render error for page ${pageNum}:`, err);
  }
}

/**
 * Update active thumbnail highlight.
 * @param {number} pageNum
 */
export function updateActiveThumbnail(pageNum) {
  const thumbs = document.querySelectorAll('.page-thumb');
  thumbs.forEach(th => {
    const pg = parseInt(th.dataset.page);
    th.classList.toggle('active', pg === pageNum);
  });
}

/**
 * Calculate the zoom level needed to fit the page in the viewport.
 * @param {Element} container — The canvas area container
 * @returns {number}
 */
export async function calculateFitZoom(container) {
  if (!state.pdfDoc || !container) return 1.0;

  const page = await state.pdfDoc.getPage(state.currentPage);
  const viewport = page.getViewport({ scale: 1.0 });

  const containerWidth = container.clientWidth - 48; // padding
  const containerHeight = container.clientHeight - 48;

  const scaleX = containerWidth / viewport.width;
  const scaleY = containerHeight / viewport.height;

  return Math.min(scaleX, scaleY, 2.0); // Cap at 200%
}
