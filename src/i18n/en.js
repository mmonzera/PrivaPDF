export default {
  // App
  appName: 'PrivaPDF',
  appTagline: '100% LOCAL',
  privacyBadge: 'No data leaves your browser',

  // Dropzone
  dropTitle: 'Drop PDF here',
  dropSub: 'or click to choose a file',
  dropMax: 'Max 100MB',
  dropNote: '✓ Files never leave your browser',
  dropPrivacy: '100% client-side · Zero upload · Zero server · Zero cloud',

  // Buttons
  btnOpen: 'Open PDF',
  btnExport: 'Export PDF',
  btnScanWm: 'Scan Watermark',
  btnRemoveWm: 'Remove Watermark',
  btnUndo: 'Undo',
  btnRedo: 'Redo',

  // Tools
  toolLabel: 'TOOL',
  toolSelect: 'Select',
  toolRedact: 'Redact',
  toolText: 'Text',
  toolSelectHint: 'Select / Pan (V)',
  toolRedactHint: 'Redact / Cover Area (R)',
  toolTextHint: 'Add Text (T)',

  // Sidebar
  sidebarPages: 'Pages',
  sidebarEmpty: 'Open a PDF file\nto view pages',

  // Inspector
  inspectorTitle: 'WATERMARK INSPECTOR',
  inspectorPrompt: 'Open a PDF then click\n"Scan Watermark"\nto auto-detect\nwatermarks',
  inspectorResultTitle: 'SCAN RESULTS',
  inspectorManualTitle: 'MANUAL REDACT',
  inspectorManualDesc: 'Select the <strong>Redact</strong> tool then drag over areas to cover. Useful for burned-in watermarks or sensitive areas.',
  inspectorRedactCount: '{count} area(s) redacted',
  inspectorEdgeCases: 'EDGE CASES',
  inspectorEdgeCaseList: '⚠ Burned-in watermark\n→ use manual Redact\n\n⚠ Encrypted PDF\n→ cannot be opened\n\n⚠ Scanned image PDF\n→ scan may not detect\n\n⚠ Non-embedded fonts\n→ text may change',

  // Watermark results
  wmFound: '{count} object(s) detected',
  wmNoResults: 'No structured watermarks\ndetected.\n\nUse Manual Redact\nif watermark is visible.',
  wmConfidence: 'confidence',
  wmPage: 'pg.',
  wmGlobal: 'global',

  // Modal
  modalRemoveTitle: 'Remove Watermarks',
  modalRemoveBody: 'This action will modify the PDF structure. This process cannot be undone after export.',
  modalCancel: 'Cancel',
  modalConfirm: 'Remove Now',

  // Toasts
  toastFileReading: 'Reading file...',
  toastFileLoaded: '✓ {name} loaded successfully',
  toastFileTooLarge: 'File too large (max {max})',
  toastOnlyPdf: 'Only PDF files are supported',
  toastPdfEncrypted: 'PDF is encrypted with a password — cannot open',
  toastPdfError: 'Failed to read PDF: {error}',
  toastScanning: 'Scanning watermarks...',
  toastScanResults: '{count} watermark object(s) detected',
  toastScanNone: 'No structured watermarks detected',
  toastRemoving: 'Removing watermarks...',
  toastRemoved: '✓ {count} watermark(s) removed from PDF structure',
  toastRemoveError: 'Failed to remove watermark: {error}',
  toastExporting: 'Preparing export...',
  toastExported: '✓ File saved: {name}',
  toastExportError: 'Export failed: {error}',
  toastRedactAdded: 'Redact area added (pg. {page})',
  toastUndone: '↩ Undone: {action}',
  toastRedone: '↪ Redone: {action}',

  // Status
  statusPrivacy: 'No data leaves browser',
  statusPage: 'Page {current} / {total}',

  // Zoom
  zoomFit: 'FIT',

  // Edit mode
  toolEdit: 'Edit',
  toolEditHint: 'Edit PDF Objects (E)',
  editPanelTitle: 'PDF ELEMENTS',
  editObjectsCount: '{count} object(s) on this page',
  editNoObjects: 'No editable objects\nfound on this page',
  editSelectHint: 'Click any element on\nthe canvas to select it.\nPress Delete to remove.',
  editDeleteObject: 'Delete this object',
  editPropsTitle: 'SELECTED OBJECT',
  editPropsType: 'Type',
  editPropsPosition: 'Position',
  editPropsSize: 'Size',
  editPropsContent: 'Content',
  editPropsFont: 'Font',
  editObjText: 'Text Block',
  editObjImage: 'Image',
  editObjXObject: 'Form Object',
  toastObjectDeleted: '✓ {type} deleted',
  toastObjectDeleteError: 'Delete failed: {error}',
  toastUndoRequiresReopen: 'To undo deletion, re-open the original PDF file',
  toastEditEnter: 'Edit mode — click elements to select, Delete to remove',

  // Per-item watermark
  wmSelectAll: 'Select All',
  wmSelectNone: 'Deselect All',
  wmRemoveSelected: 'Remove Selected ({count})',
  wmDeleteSingle: 'Delete',
  toastWmItemRemoved: '✓ {type} removed',
  toastWmItemFailed: 'Could not remove {type} — try manual redact',

  // Misc
  pagesCount: '{count} pages',
  textPlaceholder: 'Type text...',
  closeWarning: 'You have unsaved changes. Are you sure you want to leave?',
};

