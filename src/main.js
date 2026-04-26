/**
 * PrivaPDF — Main Application Entry Point
 * 100% client-side PDF editor for watermark removal.
 * Zero uploads, zero cloud, fully confidential.
 */
import './styles/index.css';
import { bus, Events } from './core/events.js';
import { state } from './core/state.js';
import { history } from './core/history.js';
import { loadPDF, switchDocument, deleteDocument } from './pdf/loader.js';
import { renderPage, buildThumbnails, updateActiveThumbnail, calculateFitZoom } from './pdf/renderer.js';
import { generateExportBytes, downloadPDF } from './pdf/exporter.js';
import { mergePDF, splitPDF, deleteCurrentPage } from './pdf/merge-split.js';
import { enterEditMode, exitEditMode, handleEditKeyboard, getCurrentObjects, getSelectedObject, deleteSelectedObject } from './tools/edit.js';
import { setTool, getToolCursor, getToolName, TOOLS } from './tools/manager.js';
import { initRedactTool, removeRedactRect } from './tools/redact.js';
import { initTextTool, renderTextAnnotations } from './tools/text.js';
import t, { setLocale, getLocale } from './i18n/index.js';
import { formatBytes, clamp } from './utils/format.js';
import { $ } from './utils/dom.js';

// ─── SVG Icons ────────────────────────────────────────────────────────────────
const ICONS = {
  folder: `<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M1 3.5A1.5 1.5 0 012.5 2h2.764c.958 0 1.76.56 2.311 1.184C7.985 3.648 8.48 4 9 4h4.5A1.5 1.5 0 0115 5.5v7a1.5 1.5 0 01-1.5 1.5h-11A1.5 1.5 0 011 12.5v-9z"/></svg>`,
  download: `<svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor"><path d="M.5 9.9a.5.5 0 01.5.5v2.5a1 1 0 001 1h12a1 1 0 001-1v-2.5a.5.5 0 011 0v2.5a2 2 0 01-2 2H2a2 2 0 01-2-2v-2.5a.5.5 0 01.5-.5z"/><path d="M7.646 11.854a.5.5 0 00.708 0l3-3a.5.5 0 00-.708-.708L8.5 10.293V1.5a.5.5 0 00-1 0v8.793L5.354 8.146a.5.5 0 10-.708.708l3 3z"/></svg>`,
  cursor: `<svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M14.082 2.182a.5.5 0 01.103.557L8.528 15.467a.5.5 0 01-.917-.007L5.57 10.694.803 8.652a.5.5 0 01-.006-.916l12.728-5.657a.5.5 0 01.556.103z"/></svg>`,
  redact: `<svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="1" width="14" height="14" rx="2" opacity=".6"/><rect x="3" y="6" width="10" height="4" fill="currentColor"/></svg>`,
  textIcon: `<svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M2.5 3a.5.5 0 000 1h11a.5.5 0 000-1h-11zM7.5 6a.5.5 0 01.5.5v6.5a.5.5 0 01-1 0V6.5a.5.5 0 01.5-.5z"/><path d="M5 6.5a.5.5 0 01.5-.5h5a.5.5 0 010 1h-5a.5.5 0 01-.5-.5z"/></svg>`,
  trash: `<svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor"><path d="M5.5 5.5A.5.5 0 016 6v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm2.5 0a.5.5 0 01.5.5v6a.5.5 0 01-1 0V6a.5.5 0 01.5-.5zm3 .5a.5.5 0 00-1 0v6a.5.5 0 001 0V6z"/><path fill-rule="evenodd" d="M14.5 3a1 1 0 01-1 1H13v9a2 2 0 01-2 2H5a2 2 0 01-2-2V4h-.5a1 1 0 01-1-1V2a1 1 0 011-1H6a1 1 0 011-1h2a1 1 0 011 1h3.5a1 1 0 011 1v1z"/></svg>`,
  lock: `<svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" style="color:var(--success)"><path d="M8 1a2 2 0 012 2v4H6V3a2 2 0 012-2zm3 6V3a3 3 0 00-6 0v4a2 2 0 00-2 2v5a2 2 0 002 2h6a2 2 0 002-2V9a2 2 0 00-2-2z"/></svg>`,
  undo: `<svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" d="M8 3a5 5 0 11-4.546 2.914.5.5 0 00-.908-.418A6 6 0 108 2v1z"/><path d="M8 4.466V.534a.25.25 0 00-.41-.192L5.23 2.308a.25.25 0 000 .384l2.36 1.966A.25.25 0 008 4.466z"/></svg>`,
  redo: `<svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path fill-rule="evenodd" d="M8 3a5 5 0 104.546 2.914.5.5 0 01.908-.418A6 6 0 118 2v1z"/><path d="M8 4.466V.534a.25.25 0 01.41-.192l2.36 1.966a.25.25 0 010 .384L8.41 4.658A.25.25 0 018 4.466z"/></svg>`,
  edit: `<svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><path d="M12.146.146a.5.5 0 01.708 0l3 3a.5.5 0 010 .708l-10 10a.5.5 0 01-.168.11l-5 2a.5.5 0 01-.65-.65l2-5a.5.5 0 01.11-.168l10-10zM11.207 2.5L13.5 4.793 14.793 3.5 12.5 1.207 11.207 2.5zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 01.5.5v.5h.5a.5.5 0 01.5.5v.5h.293l6.5-6.5z"/></svg>`,
};

// ─── Theme Helper ─────────────────────────────────────────────────────────────
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('privapdf-theme', theme);
  const btn = document.getElementById('btn-theme-toggle');
  if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
  if (btn) btn.title = theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode';
}



// ─── Render App Shell ─────────────────────────────────────────────────────────
function renderApp() {
  const app = $('#app');
  app.innerHTML = `
    <!-- TOPBAR -->
    <div class="topbar">
      <div class="logo">
        <div class="logo-dot"></div>
        PrivaPDF
      </div>
      <div class="topbar-sep"></div>
      <div class="badge badge-outline">${t('appTagline')}</div>
      <div class="file-name-display hidden" id="file-name-display"></div>
      <div class="topbar-right">
        <button class="lang-toggle" id="lang-toggle">${getLocale() === 'en' ? 'ID' : 'EN'}</button>
        <button class="theme-toggle" id="btn-theme-toggle" title="Toggle Light/Dark Mode">☀️</button>
        <button class="btn" id="btn-manage-docs" style="display:none;">📄 Docs</button>
        <button class="btn" id="btn-open-file">${ICONS.folder} ${t('btnOpen')}</button>
        <button class="btn btn-primary hidden" id="btn-export" disabled>${ICONS.download} ${t('btnExport')}</button>
        <input type="file" id="file-input" accept=".pdf" class="hidden">
      </div>
    </div>

    <!-- MAIN LAYOUT -->
    <div class="layout">
      <!-- SIDEBAR -->
      <div class="sidebar" id="sidebar">
        <div class="sidebar-section">
          <div class="sidebar-label">${t('sidebarPages')}</div>
          <div id="page-info-sidebar" class="page-info" style="color:var(--text3)">—</div>
        </div>
        <div class="page-thumb-list" id="thumb-list" style="flex:1;">
          <div class="empty-state">${t('sidebarEmpty')}</div>
        </div>
        <div class="sidebar-actions hidden" id="sidebar-actions" style="padding: 12px; display: flex; gap: 8px; flex-direction: column; border-top: 1px solid var(--border);">
          <button class="btn" id="btn-merge-pdf" style="width: 100%; justify-content: center;">+ Merge PDF</button>
          <button class="btn" id="btn-split-pdf" style="width: 100%; justify-content: center;">✂ Split PDF</button>
        </div>
      </div>

      <!-- EDITOR -->
      <div class="editor-main">
        <!-- TOOLBAR -->
        <div class="toolbar">
          <span class="tool-label">${t('toolLabel')}</span>
          <div class="toolbar-sep"></div>

          <button class="tool-btn active" id="tool-select" title="${t('toolSelectHint')}">${ICONS.cursor}</button>
          <button class="tool-btn" id="tool-edit" title="${t('toolEditHint')}">${ICONS.edit}</button>
          <button class="tool-btn" id="tool-redact" title="${t('toolRedactHint')}">${ICONS.redact}</button>
          <button class="tool-btn" id="tool-text" title="${t('toolTextHint')}">${ICONS.textIcon}</button>

          <div class="toolbar-sep"></div>

          <button class="tool-btn history-btn" id="btn-undo" title="${t('btnUndo')} (Ctrl+Z)" disabled>${ICONS.undo}</button>
          <button class="tool-btn history-btn" id="btn-redo" title="${t('btnRedo')} (Ctrl+Shift+Z)" disabled>${ICONS.redo}</button>

          <div class="toolbar-sep"></div>



          <div class="zoom-control">
            <button class="tool-btn" id="zoom-out" title="Zoom Out">−</button>
            <span class="zoom-val" id="zoom-val">100%</span>
            <button class="tool-btn" id="zoom-in" title="Zoom In">+</button>
            <button class="tool-btn" id="zoom-fit" title="Fit" style="font-size:10px;font-family:var(--font-mono);width:auto;padding:0 8px;">${t('zoomFit')}</button>
          </div>
        </div>

        <!-- CANVAS -->
        <div class="canvas-area" id="canvas-area">
          <div class="dropzone" id="dropzone">
            <div class="dropzone-box" id="dropzone-box">
              <div class="dropzone-icon">⬡</div>
              <div class="dropzone-title">${t('dropTitle')}</div>
              <div class="dropzone-sub">${t('dropSub')}<br>${t('dropMax')}</div>
              <div class="dropzone-note">${t('dropNote')}</div>
            </div>
            <div class="privacy-note">${ICONS.lock} ${t('dropPrivacy')}</div>
          </div>

          <div class="hidden" id="page-viewer" style="position:relative;">
            <div class="page-container tool-select" id="page-container">
              <canvas id="pdf-canvas"></canvas>
              <div id="annotation-layer" style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;"></div>
              <div id="interaction-layer" style="position:absolute;top:0;left:0;width:100%;height:100%;"></div>
            </div>
          </div>
        </div>

        <!-- STATUS BAR -->
        <div class="statusbar">
          <div class="status-item">
            <div class="dot"></div>
            <span id="status-privacy">${t('statusPrivacy')}</span>
          </div>
          <div class="status-item" id="status-page" style="display:none; align-items: center; gap: 8px;">
            ${t('statusPage', { current: '<span id="current-page">1</span>', total: '<span id="total-pages">1</span>' })}
            <button class="status-btn-danger" id="btn-delete-page" title="Delete Current Page" style="margin-left: 4px; padding: 2px; border: none; background: none; cursor: pointer; color: var(--text3); display: flex; align-items: center; transition: color 0.2s;">
              ${ICONS.trash}
            </button>
          </div>
          <div class="status-item" id="status-filesize" style="display:none">
            <span id="file-size-text">—</span>
          </div>
          <div class="status-item" id="status-tool">
            <span id="active-tool-name">Select</span>
          </div>
        </div>
      </div>

      <!-- RIGHT PANEL -->
      <div class="right-panel">
        <div class="panel-header" id="panel-header">${t('inspectorTitle')}</div>
        <div class="panel-body">
          <!-- EDIT MODE PANEL (hidden by default) -->
          <div class="hidden" id="panel-edit-mode">
            <div class="panel-section" id="panel-edit-hint">
              <p class="empty-state">${t('editSelectHint')}</p>
              <div class="panel-section-title" style="margin-top:12px">${t('editPanelTitle')}</div>
              <div id="edit-objects-count" class="redact-counter"></div>
              <div id="edit-objects-list" style="margin-top:8px;max-height:300px;overflow-y:auto;"></div>
            </div>
            <div class="panel-section hidden" id="panel-edit-props">
              <div class="panel-section-title">${t('editPropsTitle')}</div>
              <div id="edit-props-content"></div>
            </div>
          </div>

          <!-- WATERMARK INSPECTOR (default) -->
          <div id="panel-wm-mode">


            <div class="panel-section" id="panel-manual-section">
              <div class="panel-section-title">${t('inspectorManualTitle')}</div>
              <p class="manual-redact-desc">${t('inspectorManualDesc')}</p>
              <div class="redact-counter" id="redact-count">${t('inspectorRedactCount', { count: 0 })}</div>
            </div>

            <div class="panel-section">
              <div class="panel-section-title">${t('inspectorEdgeCases')}</div>
              <div class="edge-cases-text">${t('inspectorEdgeCaseList')}</div>
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>

    <!-- MODAL -->


    <!-- PREVIEW MODAL -->
    <div class="modal-backdrop" id="preview-modal">
      <div class="modal" style="width: 80vw; height: 85vh; max-width: 1200px; display: flex; flex-direction: column;">
        <h3 style="margin-top:0">Export Preview</h3>
        <p style="margin-top:0; color:var(--text3)">Review your final document before downloading.</p>
        <div style="flex:1; background:var(--bg1); border-radius:4px; overflow:hidden; position:relative; margin-bottom: 15px;">
          <iframe id="preview-iframe" style="width:100%; height:100%; border:none; background:white;"></iframe>
        </div>
        <div class="modal-actions">
          <button class="btn" id="preview-cancel">${t('modalCancel')}</button>
          <button class="btn btn-primary" id="preview-confirm">${ICONS.download} Download Final PDF</button>
        </div>
      </div>
    </div>

    <!-- DOCUMENT MANAGER MODAL -->
    <div class="modal-backdrop" id="doc-manager-modal">
      <div class="modal" style="width: 600px; max-width: 90vw;">
        <h3 style="margin-top:0">Document Management</h3>
        <p style="margin-top:0; color:var(--text3)">Switch between open documents or upload new ones.</p>
        <div id="doc-list" style="max-height: 400px; overflow-y: auto; margin-bottom: 15px; display: flex; flex-direction: column; gap: 8px;">
        </div>
        <div class="modal-actions" style="justify-content: space-between;">
          <button class="btn" id="btn-doc-manager-upload">+ Upload New Document</button>
          <button class="btn btn-primary" id="doc-manager-close">Close</button>
        </div>
      </div>
    </div>

    <!-- TOAST -->
    <div class="toast-container" id="toast-container"></div>
  `;
}

// ─── Wire Events ──────────────────────────────────────────────────────────────
function wireEvents() {
  // File open
  $('#btn-open-file').onclick = () => $('#file-input').click();
  $('#file-input').onchange = (e) => {
    if (e.target.files[0]) loadPDF(e.target.files[0]);
    e.target.value = '';
  };

  // Theme toggle
  const savedTheme = localStorage.getItem('privapdf-theme') || 'dark';
  applyTheme(savedTheme);
  $('#btn-theme-toggle').onclick = () => {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    applyTheme(current === 'dark' ? 'light' : 'dark');
  };

  // Dropzone
  const dzBox = $('#dropzone-box');
  dzBox.onclick = () => $('#file-input').click();
  dzBox.addEventListener('dragenter', () => dzBox.classList.add('dragover'));
  dzBox.addEventListener('dragleave', () => dzBox.classList.remove('dragover'));

  document.addEventListener('dragover', e => e.preventDefault());
  document.addEventListener('drop', e => {
    e.preventDefault();
    dzBox.classList.remove('dragover');
    if (e.dataTransfer.files[0]) loadPDF(e.dataTransfer.files[0]);
  });

  // Export & Preview
  let currentExportBytes = null;
  let previewUrl = null;

  $('#btn-export').onclick = async () => {
    $('#btn-export').disabled = true;
    bus.emit(Events.TOAST, { msg: t('toastExporting'), type: 'info', duration: 1500 });
    
    currentExportBytes = await generateExportBytes();
    if (currentExportBytes) {
      const blob = new Blob([currentExportBytes], { type: 'application/pdf' });
      previewUrl = URL.createObjectURL(blob);
      $('#preview-iframe').src = previewUrl + '#toolbar=0';
      $('#preview-modal').classList.add('open');
    }
    $('#btn-export').disabled = false;
  };

  // Merge & Split
  $('#btn-merge-pdf').onclick = mergePDF;
  $('#btn-split-pdf').onclick = splitPDF;

  $('#preview-cancel').onclick = () => {
    $('#preview-modal').classList.remove('open');
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      previewUrl = null;
    }
    currentExportBytes = null;
  };

  $('#preview-confirm').onclick = () => {
    $('#preview-modal').classList.remove('open');
    if (currentExportBytes) {
      downloadPDF(currentExportBytes, state.fileName);
    }
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      previewUrl = null;
    }
    currentExportBytes = null;
  };

  // Tools
  $('#tool-select').onclick = () => setTool(TOOLS.SELECT);
  $('#tool-edit').onclick = () => setTool(TOOLS.EDIT);
  $('#tool-redact').onclick = () => setTool(TOOLS.REDACT);
  $('#tool-text').onclick = () => setTool(TOOLS.TEXT);



  // Zoom
  $('#zoom-in').onclick = () => changeZoom(state.zoom + 0.25);
  $('#zoom-out').onclick = () => changeZoom(state.zoom - 0.25);
  $('#zoom-fit').onclick = async () => {
    const fitZoom = await calculateFitZoom($('#canvas-area'));
    changeZoom(fitZoom);
  };

  $('#btn-delete-page').onclick = deleteCurrentPage;

  // Undo / Redo
  $('#btn-undo').onclick = () => {
    if (history.undo()) {
      bus.emit(Events.TOAST, { msg: t('toastUndone', { action: history.status.lastAction || '' }), type: 'info', duration: 1500 });
      renderAnnotations();
    }
  };
  $('#btn-redo').onclick = () => {
    if (history.redo()) {
      bus.emit(Events.TOAST, { msg: t('toastRedone', { action: history.status.lastAction || '' }), type: 'info', duration: 1500 });
      renderAnnotations();
    }
  };

  // Language toggle
  $('#lang-toggle').onclick = () => {
    const next = getLocale() === 'en' ? 'id' : 'en';
    setLocale(next);
    renderApp();
    wireEvents();
    wireEventBus();
    if (state.isPdfLoaded) restoreAfterRerender();
  };

  // Init tools on interaction layer
  const il = $('#interaction-layer');
  initRedactTool(il);
  initTextTool(il);

  // Keyboard shortcuts
  document.addEventListener('keydown', handleKeyboard);
  document.addEventListener('keydown', handleEditKeyboard);

  // Close warning
  window.addEventListener('beforeunload', e => {
    if (state.modified) {
      e.preventDefault();
      return (e.returnValue = t('closeWarning'));
    }
  });
}

// ─── Event Bus Subscriptions ──────────────────────────────────────────────────
function wireEventBus() {
  // Toast handler
  bus.on(Events.TOAST, ({ msg, type = 'info', duration = 3000 }) => {
    showToast(msg, type, duration);
  });

  // PDF loaded
  bus.on(Events.PDF_LOADED, async ({ fileName, fileSize, totalPages }) => {
    $('#dropzone').classList.add('hidden');
    $('#page-viewer').classList.remove('hidden');
    $('#btn-export').disabled = false;
    $('#btn-export').classList.remove('hidden');
    $('#btn-manage-docs').style.display = 'block';
    $('#file-name-display').textContent = fileName;
    $('#file-name-display').classList.remove('hidden');
    $('#status-page').style.display = 'flex';
    $('#status-filesize').style.display = 'flex';
    $('#sidebar-actions').classList.remove('hidden');
    $('#file-size-text').textContent = formatBytes(fileSize);
    $('#total-pages').textContent = totalPages;
    $('#page-info-sidebar').textContent = t('pagesCount', { count: totalPages });

    await renderPage(1);
    await buildThumbnails($('#thumb-list'));
    renderDocumentManager();
  });

  // Page changed
  bus.on(Events.PAGE_CHANGED, ({ pageNum }) => {
    $('#current-page').textContent = pageNum;
    updateActiveThumbnail(pageNum);
    renderAnnotations();
  });

  // PDF modified (e.g. Merge PDF)
  bus.on(Events.PDF_MODIFIED, async () => {
    await renderPage(state.currentPage);
    await buildThumbnails($('#thumb-list'));
    $('#total-pages').textContent = state.totalPages;
    $('#page-info-sidebar').textContent = t('pagesCount', { count: state.totalPages });
  });

  // Document list changed
  bus.on(Events.DOCUMENTS_CHANGED, renderDocumentManager);

  // Tool changed
  bus.on(Events.TOOL_CHANGED, ({ tool }) => {
    [TOOLS.SELECT, TOOLS.EDIT, TOOLS.REDACT, TOOLS.TEXT].forEach(tid => {
      $(`#tool-${tid}`)?.classList.toggle('active', tid === tool);
    });
    const pc = $('#page-container');
    if (pc) pc.className = 'page-container ' + getToolCursor(tool);
    $('#active-tool-name').textContent = getToolName(tool);

    // Toggle panel mode
    const isEdit = tool === TOOLS.EDIT;
    $('#panel-edit-mode')?.classList.toggle('hidden', !isEdit);
    $('#panel-wm-mode')?.classList.toggle('hidden', isEdit);
    const header = $('#panel-header');
    if (header) header.textContent = isEdit ? t('editPanelTitle') : t('inspectorTitle');
  });

  // Redact changes
  bus.on(Events.REDACT_ADDED, renderAnnotations);
  bus.on(Events.REDACT_REMOVED, renderAnnotations);
  bus.on(Events.TEXT_ADDED, () => {});
  bus.on(Events.TEXT_REMOVED, renderAnnotations);

  // History
  bus.on(Events.HISTORY_CHANGED, ({ canUndo, canRedo }) => {
    $('#btn-undo').disabled = !canUndo;
    $('#btn-redo').disabled = !canRedo;
  });



  // Edit mode
  bus.on(Events.EDIT_MODE_ENTER, () => {
    if (state.pdfDoc) {
      enterEditMode();
      bus.emit(Events.TOAST, { msg: t('toastEditEnter'), type: 'info', duration: 2500 });
    }
  });

  bus.on(Events.EDIT_MODE_EXIT, () => {
    exitEditMode();
  });

  bus.on(Events.EDIT_OBJECTS_EXTRACTED, ({ objects, pageNum }) => {
    const countEl = $('#edit-objects-count');
    const listEl = $('#edit-objects-list');
    if (countEl) countEl.textContent = t('editObjectsCount', { count: objects.length });
    if (listEl) renderObjectList(objects, listEl);
  });

  bus.on(Events.EDIT_OBJECT_SELECTED, ({ object }) => {
    renderObjectProperties(object);
  });

  bus.on(Events.EDIT_OBJECT_DESELECTED, () => {
    $('#panel-edit-props')?.classList.add('hidden');
  });

  // Re-enter edit mode on page change if edit tool active
  bus.on(Events.PAGE_RENDERED, () => {
    if (state.activeTool === TOOLS.EDIT) {
      enterEditMode();
    }
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function showToast(msg, type = 'info', duration = 3000) {
  const container = $('#toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

function changeZoom(z) {
  state.zoom = clamp(z, 0.25, 4.0);
  $('#zoom-val').textContent = Math.round(state.zoom * 100) + '%';
  renderPage(state.currentPage);
}

function renderAnnotations() {
  const al = $('#annotation-layer');
  if (!al) return;

  // Clear old redact elements
  al.querySelectorAll('.redact-rect').forEach(e => e.remove());

  // Render redact rects for current page
  state.redactRects
    .filter(r => r.page === state.currentPage)
    .forEach(r => {
      const el = document.createElement('div');
      el.className = 'redact-rect';
      el.style.cssText = `left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px;pointer-events:auto;`;

      const del = document.createElement('div');
      del.className = 'del-btn';
      del.innerHTML = '×';
      del.onclick = (e) => {
        e.stopPropagation();
        removeRedactRect(r);
      };
      el.appendChild(del);
      al.appendChild(el);
    });

  // Render text annotations
  renderTextAnnotations(al);

  // Update counter
  const counter = $('#redact-count');
  if (counter) counter.textContent = t('inspectorRedactCount', { count: state.redactRects.length });
}





function renderDocumentManager() {
  const container = $('#doc-list');
  if (!container) return;

  container.innerHTML = '';
  
  if (state.documents.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text3)">No documents loaded.</div>`;
    return;
  }

  state.documents.forEach(doc => {
    const isActive = doc.id === state.activeDocumentId;
    const div = document.createElement('div');
    div.className = 'doc-list-item';
    div.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 15px;
      margin-bottom: 8px;
      background: ${isActive ? 'var(--primary-light)' : 'var(--bg-layer1)'};
      border: 1px solid ${isActive ? 'var(--primary)' : 'var(--border)'};
      border-radius: 8px;
    `;

    const left = document.createElement('div');
    left.innerHTML = `
      <div style="font-weight: 500; font-size: 14px; color: var(--text1); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 300px;">
        ${doc.name} ${isActive ? '<span class="badge" style="margin-left:8px;">Active</span>' : ''}
      </div>
      <div style="font-size: 12px; color: var(--text3); margin-top: 4px;">
        ${formatBytes(doc.size)}
      </div>
    `;

    const right = document.createElement('div');
    right.style.display = 'flex';
    right.style.gap = '8px';

    if (!isActive) {
      const btnSwitch = document.createElement('button');
      btnSwitch.className = 'btn';
      btnSwitch.textContent = 'Switch';
      btnSwitch.onclick = () => {
        $('#doc-manager-modal').classList.remove('open');
        switchDocument(doc.id);
      };
      right.appendChild(btnSwitch);
    }

    const btnDel = document.createElement('button');
    btnDel.className = 'btn btn-danger';
    btnDel.textContent = 'Delete';
    btnDel.onclick = () => deleteDocument(doc.id);
    right.appendChild(btnDel);

    div.appendChild(left);
    div.appendChild(right);
    container.appendChild(div);
  });
}

function handleKeyboard(e) {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

  // Tool shortcuts
  if (e.key === 'v' || e.key === 'V') setTool(TOOLS.SELECT);
  if (e.key === 'e' || e.key === 'E') setTool(TOOLS.EDIT);
  if (e.key === 'r' || e.key === 'R') setTool(TOOLS.REDACT);
  if (e.key === 't' || e.key === 'T') setTool(TOOLS.TEXT);

  // Page navigation
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
    const next = state.currentPage + 1;
    if (next <= state.totalPages) renderPage(next);
  }
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    const prev = state.currentPage - 1;
    if (prev >= 1) renderPage(prev);
  }

  // Undo/Redo
  if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
    e.preventDefault();
    if (history.undo()) renderAnnotations();
  }
  if ((e.ctrlKey || e.metaKey) && ((e.key === 'z' && e.shiftKey) || e.key === 'y')) {
    e.preventDefault();
    if (history.redo()) renderAnnotations();
  }

  // Zoom
  if ((e.ctrlKey || e.metaKey) && e.key === '=') {
    e.preventDefault();
    changeZoom(state.zoom + 0.25);
  }
  if ((e.ctrlKey || e.metaKey) && e.key === '-') {
    e.preventDefault();
    changeZoom(state.zoom - 0.25);
  }
}

function restoreAfterRerender() {
  // Re-show PDF viewer state after language change
  if (state.isPdfLoaded) {
    $('#dropzone').classList.add('hidden');
    $('#page-viewer').classList.remove('hidden');
    $('#btn-scan-wm').disabled = false;
    $('#btn-export').disabled = false;
    $('#btn-export').classList.remove('hidden');
    $('#file-name-display').textContent = state.fileName;
    $('#file-name-display').classList.remove('hidden');
    $('#status-page').style.display = 'flex';
    $('#status-filesize').style.display = 'flex';
    $('#file-size-text').textContent = formatBytes(state.fileSize);
    $('#total-pages').textContent = state.totalPages;
    $('#page-info-sidebar').textContent = t('pagesCount', { count: state.totalPages });

    renderPage(state.currentPage);
    buildThumbnails($('#thumb-list'));
  }
}

// ─── Edit Mode Helpers ────────────────────────────────────────────────────────
function renderObjectList(objects, container) {
  container.innerHTML = '';
  if (objects.length === 0) {
    container.innerHTML = `<div class="empty-state">${t('editNoObjects')}</div>`;
    return;
  }
  objects.forEach(obj => {
    const item = document.createElement('div');
    item.className = 'object-list-item';
    item.dataset.objectId = obj.id;
    const dotClass = `dot-${obj.type}`;
    const label = obj.type === 'text' ? (obj.str || '').slice(0, 40) : obj.type === 'image' ? t('editObjImage') : t('editObjXObject');
    item.innerHTML = `<div class="obj-type-dot ${dotClass}"></div><span class="obj-text">${label}</span>`;
    item.onclick = () => {
      // Scroll to and select the overlay on canvas
      const overlay = document.querySelector(`[data-object-id="${obj.id}"]`);
      if (overlay) overlay.click();
    };
    container.appendChild(item);
  });
}

function renderObjectProperties(obj) {
  const panel = $('#panel-edit-props');
  const content = $('#edit-props-content');
  if (!panel || !content) return;
  panel.classList.remove('hidden');
  const typeLabel = obj.type === 'text' ? t('editObjText') : obj.type === 'image' ? t('editObjImage') : t('editObjXObject');
  const typeClass = `type-${obj.type}`;
  content.innerHTML = `
    <div class="object-props">
      <div class="object-props-type ${typeClass}">${typeLabel}</div>
      ${obj.type === 'text' ? `<div class="object-props-content">${obj.str || ''}</div>` : ''}
      ${obj.fontName ? `<div class="object-props-meta">${t('editPropsFont')}: ${obj.fontName}</div>` : ''}
      <div class="object-props-meta">${t('editPropsPosition')}: ${Math.round(obj.x)}, ${Math.round(obj.y)}</div>
      <div class="object-props-meta">${t('editPropsSize')}: ${Math.round(obj.w)} × ${Math.round(obj.h)}</div>
      <div class="object-props-actions">
        <button class="btn btn-danger" id="btn-delete-object" style="font-size:11px;padding:4px 12px;">${ICONS.trash} ${t('editDeleteObject')}</button>
      </div>
    </div>
  `;
  $('#btn-delete-object').onclick = () => deleteSelectedObject();
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────
renderApp();
wireEvents();
wireEventBus();

console.log('%c⬡ PrivaPDF', 'color:#d4a853;font-size:16px;font-weight:bold;', '— 100% client-side, zero cloud');
