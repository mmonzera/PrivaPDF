/**
 * Merge and Split PDF — Client-side document manipulation
 */
import { PDFDocument } from 'pdf-lib';
import { bus, Events } from '../core/events.js';
import { state } from '../core/state.js';
import { history } from '../core/history.js';
import { reloadFromBytes } from './loader.js';
import { downloadPDF } from './exporter.js';
import t from '../i18n/index.js';

/**
 * Prompt user to select PDFs and merge them into the current document.
 */
export function mergePDF() {
  if (!state.pdfLibDoc) return;

  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.pdf';
  input.multiple = true;
  input.onchange = async (e) => {
    if (e.target.files.length > 0) {
      await performMerge(Array.from(e.target.files));
    }
  };
  input.click();
}

/**
 * Perform the actual merge operation.
 * @param {File[]} files 
 */
async function performMerge(files) {
  bus.emit(Events.TOAST, { msg: 'Merging PDFs...', type: 'info', duration: 3000 });

  try {
    const beforeBytes = state.pdfBytes ? state.pdfBytes.slice() : null;
    let afterBytes = null;

    history.execute({
      description: `Merge ${files.length} PDFs`,
      execute: async () => {
        if (afterBytes) {
          await reloadFromBytes(afterBytes);
        } else {
          for (const file of files) {
            const arrayBuffer = await file.arrayBuffer();
            const donorDoc = await PDFDocument.load(arrayBuffer);
            const copiedPages = await state.pdfLibDoc.copyPages(donorDoc, donorDoc.getPageIndices());
            copiedPages.forEach((page) => state.pdfLibDoc.addPage(page));
          }
          const newBytes = await state.pdfLibDoc.save();
          await reloadFromBytes(newBytes);
          afterBytes = state.pdfBytes ? state.pdfBytes.slice() : null;
        }
      },
      undo: async () => {
        if (beforeBytes) {
          await reloadFromBytes(beforeBytes);
        }
      }
    });

    bus.emit(Events.TOAST, { msg: 'PDFs merged successfully!', type: 'success' });
  } catch (err) {
    console.error('Merge error:', err);
    bus.emit(Events.TOAST, { msg: 'Failed to merge PDFs', type: 'error' });
  }
}

/**
 * Prompt user for a page range and split the PDF.
 */
export function splitPDF() {
  if (!state.pdfLibDoc) return;

  // Simple browser prompt for now, can be upgraded to a modal later
  const rangeStr = prompt(`Enter page range to extract (e.g. 1-3, 5). Total pages: ${state.totalPages}`);
  if (!rangeStr) return;

  performSplit(rangeStr);
}

/**
 * Perform the actual split/extract operation.
 * @param {string} rangeStr 
 */
async function performSplit(rangeStr) {
  try {
    bus.emit(Events.TOAST, { msg: 'Splitting PDF...', type: 'info' });

    const indicesToExtract = parsePageRange(rangeStr, state.totalPages);
    if (indicesToExtract.length === 0) {
      bus.emit(Events.TOAST, { msg: 'Invalid page range', type: 'error' });
      return;
    }

    const newDoc = await PDFDocument.create();
    const copiedPages = await newDoc.copyPages(state.pdfLibDoc, indicesToExtract);
    copiedPages.forEach((page) => newDoc.addPage(page));

    const bytes = await newDoc.save();
    downloadPDF(bytes, `${state.fileName.replace(/\.pdf$/i, '')}_split.pdf`);

  } catch (err) {
    console.error('Split error:', err);
    bus.emit(Events.TOAST, { msg: 'Failed to split PDF', type: 'error' });
  }
}

/**
 * Parse a string like "1-3, 5" into an array of 0-based indices [0, 1, 2, 4].
 */
function parsePageRange(str, maxPages) {
  const indices = new Set();
  const parts = str.split(',').map(s => s.trim());

  for (const part of parts) {
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-');
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (!isNaN(start) && !isNaN(end) && start > 0 && end >= start) {
        for (let i = start; i <= end; i++) {
          if (i <= maxPages) indices.add(i - 1);
        }
      }
    } else {
      const num = parseInt(part, 10);
      if (!isNaN(num) && num > 0 && num <= maxPages) {
        indices.add(num - 1);
      }
    }
  }

  return Array.from(indices).sort((a, b) => a - b);
}

/**
 * Delete the currently active page.
 */
export async function deleteCurrentPage() {
  if (!state.pdfLibDoc || state.totalPages <= 1) {
    bus.emit(Events.TOAST, { msg: 'Cannot delete the last page', type: 'error' });
    return;
  }

  const pageIndex = state.currentPage - 1;
  const beforeBytes = state.pdfBytes ? state.pdfBytes.slice() : null;
  let afterBytes = null;

  history.execute({
    description: `Delete Page ${state.currentPage}`,
    execute: async () => {
      if (afterBytes) {
        await reloadFromBytes(afterBytes);
      } else {
        state.pdfLibDoc.removePage(pageIndex);
        const newBytes = await state.pdfLibDoc.save();
        
        // If we deleted the last page, move back one page
        let nextCurrentPage = state.currentPage;
        if (state.currentPage > state.totalPages - 1) {
          nextCurrentPage = state.totalPages - 1;
        }

        await reloadFromBytes(newBytes);
        state.currentPage = nextCurrentPage;
        afterBytes = state.pdfBytes ? state.pdfBytes.slice() : null;
      }
    },
    undo: async () => {
      if (beforeBytes) {
        await reloadFromBytes(beforeBytes);
      }
    }
  });

  bus.emit(Events.TOAST, { msg: `Page ${pageIndex + 1} deleted`, type: 'success' });
}
