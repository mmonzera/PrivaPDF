/**
 * PDF Loader — Handles file reading and PDF document initialization.
 * Uses both pdfjs-dist (rendering) and pdf-lib (manipulation).
 */
import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';
import { bus, Events } from '../core/events.js';
import { state } from '../core/state.js';
import { history } from '../core/history.js';
import t from '../i18n/index.js';
import { formatBytes, zeroBuffer } from '../utils/format.js';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

/**
 * Load a PDF from a File object.
 * @param {File} file
 */
export async function loadPDF(file) {
  // Validate file
  if (!file || file.type !== 'application/pdf') {
    bus.emit(Events.TOAST, { msg: t('toastOnlyPdf'), type: 'error' });
    return;
  }

  if (file.size > MAX_FILE_SIZE) {
    bus.emit(Events.TOAST, {
      msg: t('toastFileTooLarge', { max: formatBytes(MAX_FILE_SIZE) }),
      type: 'error',
    });
    return;
  }

  bus.emit(Events.PDF_LOADING, { fileName: file.name });
  bus.emit(Events.TOAST, { msg: t('toastFileReading'), type: 'info', duration: 1500 });

  try {
    const arrayBuffer = await file.arrayBuffer();

    // Zero out previous buffer if exists (privacy)
    if (state.pdfBytes) {
      zeroBuffer(state.pdfBytes);
    }

    // Load with pdfjs for rendering
    const pdfjsDoc = await pdfjsLib.getDocument({ data: arrayBuffer.slice(0) }).promise;

    // Load with pdf-lib for manipulation
    const pdfLibDoc = await PDFDocument.load(arrayBuffer.slice(0), {
      ignoreEncryption: false,
    });

    // Generate ID and create Document Record
    const docId = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    const newDoc = {
      id: docId,
      name: file.name,
      size: file.size,
      bytes: new Uint8Array(arrayBuffer.slice(0)),
    };
    
    const newDocuments = [...state.documents, newDoc];

    // Clear history on new document
    history.clear();

    // Update state
    state.$patch({
      pdfDoc: pdfjsDoc,
      pdfLibDoc: pdfLibDoc,
      pdfBytes: newDoc.bytes,
      documents: newDocuments,
      activeDocumentId: docId,
      totalPages: pdfjsDoc.numPages,
      currentPage: 1,
      fileName: file.name,
      fileSize: file.size,
      watermarks: [],
      redactRects: [],
      textAnnotations: [],
      modified: false,
      isPdfLoaded: true,
      isLoading: false,
    });

    bus.emit(Events.PDF_LOADED, {
      fileName: file.name,
      fileSize: file.size,
      totalPages: pdfjsDoc.numPages,
    });

    bus.emit(Events.TOAST, {
      msg: t('toastFileLoaded', { name: file.name }),
      type: 'success',
    });

  } catch (err) {
    console.error('[Loader] PDF load error:', err);
    state.isLoading = false;

    if (err.name === 'PasswordException') {
      bus.emit(Events.TOAST, { msg: t('toastPdfEncrypted'), type: 'error', duration: 5000 });
    } else {
      bus.emit(Events.TOAST, {
        msg: t('toastPdfError', { error: err.message }),
        type: 'error',
        duration: 5000,
      });
    }

    bus.emit(Events.PDF_ERROR, { error: err });
  }
}

/**
 * Reload the PDF from modified bytes (after watermark removal).
 * @param {Uint8Array} newBytes
 */
export async function reloadFromBytes(newBytes) {
  try {
    const oldBytes = state.pdfBytes;

    // Load fresh instances from new bytes (using slice to prevent buffer ownership issues)
    const pdfjsDoc = await pdfjsLib.getDocument({ data: newBytes.slice(0) }).promise;
    const pdfLibDoc = await PDFDocument.load(newBytes.slice(0), {
      ignoreEncryption: false,
    });

    const updatedBytes = new Uint8Array(newBytes.slice(0));

    state.$patch({
      pdfDoc: pdfjsDoc,
      pdfLibDoc: pdfLibDoc,
      pdfBytes: updatedBytes,
      totalPages: pdfjsDoc.numPages,
      modified: true,
    });

    // Update bytes in document library
    if (state.activeDocumentId) {
      const activeDocIndex = state.documents.findIndex(d => d.id === state.activeDocumentId);
      if (activeDocIndex !== -1) {
        state.documents[activeDocIndex].bytes = updatedBytes;
      }
    }

    // Safely zero out old buffer after we have successfully reloaded
    if (oldBytes) {
      zeroBuffer(oldBytes);
    }

    bus.emit(Events.PDF_MODIFIED);

  } catch (err) {
    console.error('[Loader] Reload error:', err);
    bus.emit(Events.TOAST, {
      msg: t('toastPdfError', { error: err.message }),
      type: 'error',
    });
  }
}

/**
 * Switch the active document to a different one from the library.
 * @param {string} id 
 */
export async function switchDocument(id) {
  const doc = state.documents.find(d => d.id === id);
  if (!doc) return;

  bus.emit(Events.TOAST, { msg: `Switching to ${doc.name}...`, type: 'info', duration: 1500 });
  
  // Update state metadata BEFORE reloading so reloadFromBytes knows it's the new active doc
  state.fileName = doc.name;
  state.fileSize = doc.size;
  state.activeDocumentId = doc.id;
  
  // This will reload the UI via PDF_MODIFIED
  await reloadFromBytes(doc.bytes);
  
  // Re-emit loaded to trigger full UI reset
  bus.emit(Events.PDF_LOADED, {
    fileName: doc.name,
    fileSize: doc.size,
    totalPages: state.totalPages,
  });
}

/**
 * Delete a document from the library.
 * @param {string} id 
 */
export function deleteDocument(id) {
  const docIndex = state.documents.findIndex(d => d.id === id);
  if (docIndex === -1) return;
  
  const doc = state.documents[docIndex];
  if (doc.bytes) {
    zeroBuffer(doc.bytes.buffer);
  }
  
  state.documents = state.documents.filter(d => d.id !== id);
  
  // If we deleted the active document
  if (state.activeDocumentId === id) {
    if (state.documents.length > 0) {
      switchDocument(state.documents[0].id);
    } else {
      // Last document deleted, reset app state
      window.location.reload(); 
    }
  }
  
  // Trigger UI update
  bus.emit(Events.DOCUMENTS_CHANGED);
}
