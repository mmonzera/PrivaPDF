export default {
  // App
  appName: 'PrivaPDF',
  appTagline: '100% LOKAL',
  privacyBadge: 'Data tidak keluar dari browser',

  // Dropzone
  dropTitle: 'Drop PDF di sini',
  dropSub: 'atau klik untuk pilih file',
  dropMax: 'Max 100MB',
  dropNote: '✓ File tidak keluar dari browser kamu',
  dropPrivacy: '100% client-side · Zero upload · Zero server · Zero cloud',

  // Buttons
  btnOpen: 'Buka PDF',
  btnExport: 'Export PDF',
  btnScanWm: 'Scan Watermark',
  btnRemoveWm: 'Hapus Watermark',
  btnUndo: 'Undo',
  btnRedo: 'Redo',

  // Tools
  toolLabel: 'ALAT',
  toolSelect: 'Pilih',
  toolRedact: 'Redact',
  toolText: 'Teks',
  toolSelectHint: 'Pilih / Geser (V)',
  toolRedactHint: 'Redact / Hapus Area (R)',
  toolTextHint: 'Tambah Teks (T)',

  // Sidebar
  sidebarPages: 'Halaman',
  sidebarEmpty: 'Buka file PDF\nuntuk melihat\nhalaman',

  // Inspector
  inspectorTitle: 'WATERMARK INSPECTOR',
  inspectorPrompt: 'Buka PDF lalu klik\n"Scan Watermark"\nuntuk mendeteksi\nwatermark otomatis',
  inspectorResultTitle: 'HASIL SCAN',
  inspectorManualTitle: 'REDACT MANUAL',
  inspectorManualDesc: 'Pilih tool <strong>Redact</strong> lalu drag area yang mau ditutup. Berguna untuk watermark burned-in atau area sensitif.',
  inspectorRedactCount: '{count} area redacted',
  inspectorEdgeCases: 'EDGE CASES',
  inspectorEdgeCaseList: '⚠ Watermark burned-in\n→ pakai Redact manual\n\n⚠ PDF encrypted\n→ tidak bisa dibuka\n\n⚠ Scanned image PDF\n→ scan mungkin tidak mendeteksi\n\n⚠ Font tidak ter-embed\n→ teks mungkin berubah',

  // Watermark results
  wmFound: '⬡ {count} objek terdeteksi',
  wmNoResults: 'Tidak ada watermark\nterstruktur terdeteksi.\n\nGunakan Redact Manual\njika watermark visible\ndi halaman.',
  wmConfidence: 'confidence',
  wmPage: 'hal.',
  wmGlobal: 'global',

  // Modal
  modalRemoveTitle: 'Hapus Watermark',
  modalRemoveBody: 'Tindakan ini akan memodifikasi struktur PDF. Proses ini tidak bisa di-undo setelah export.',
  modalCancel: 'Batal',
  modalConfirm: 'Hapus Sekarang',

  // Toasts
  toastFileReading: 'Membaca file...',
  toastFileLoaded: '✓ {name} berhasil dimuat',
  toastFileTooLarge: 'File terlalu besar (max {max})',
  toastOnlyPdf: 'Hanya file PDF yang didukung',
  toastPdfEncrypted: 'PDF terenkripsi dengan password — tidak bisa dibuka',
  toastPdfError: 'Gagal membaca PDF: {error}',
  toastScanning: 'Scanning watermarks...',
  toastScanResults: '{count} objek watermark terdeteksi',
  toastScanNone: 'Tidak ada watermark struktur terdeteksi',
  toastRemoving: 'Menghapus watermarks...',
  toastRemoved: '✓ {count} watermark dihapus dari struktur PDF',
  toastRemoveError: 'Gagal menghapus watermark: {error}',
  toastExporting: 'Menyiapkan export...',
  toastExported: '✓ File disimpan: {name}',
  toastExportError: 'Export gagal: {error}',
  toastRedactAdded: 'Redact area ditambahkan (hal. {page})',
  toastUndone: '↩ Dibatalkan: {action}',
  toastRedone: '↪ Diulang: {action}',

  // Status
  statusPrivacy: 'Data tidak keluar dari browser',
  statusPage: 'Halaman {current} / {total}',

  // Zoom
  zoomFit: 'FIT',

  // Edit mode
  toolEdit: 'Edit',
  toolEditHint: 'Edit Objek PDF (E)',
  editPanelTitle: 'ELEMEN PDF',
  editObjectsCount: '{count} objek di halaman ini',
  editNoObjects: 'Tidak ada objek\nyang bisa diedit\ndi halaman ini',
  editSelectHint: 'Klik elemen di canvas\nuntuk memilih.\nTekan Delete untuk hapus.',
  editDeleteObject: 'Hapus objek ini',
  editPropsTitle: 'OBJEK TERPILIH',
  editPropsType: 'Tipe',
  editPropsPosition: 'Posisi',
  editPropsSize: 'Ukuran',
  editPropsContent: 'Konten',
  editPropsFont: 'Font',
  editObjText: 'Blok Teks',
  editObjImage: 'Gambar',
  editObjXObject: 'Form Object',
  toastObjectDeleted: '✓ {type} dihapus',
  toastObjectDeleteError: 'Gagal menghapus: {error}',
  toastUndoRequiresReopen: 'Untuk undo, buka kembali file PDF asli',
  toastEditEnter: 'Mode edit — klik elemen untuk memilih, Delete untuk hapus',

  // Per-item watermark
  wmSelectAll: 'Pilih Semua',
  wmSelectNone: 'Batal Pilih',
  wmRemoveSelected: 'Hapus Terpilih ({count})',
  wmDeleteSingle: 'Hapus',
  toastWmItemRemoved: '✓ {type} dihapus',
  toastWmItemFailed: 'Gagal menghapus {type} — coba redact manual',

  // Misc
  pagesCount: '{count} halaman',
  textPlaceholder: 'Ketik teks...',
  closeWarning: 'Ada perubahan yang belum di-export. Yakin mau keluar?',
};

