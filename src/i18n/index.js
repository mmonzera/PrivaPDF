/**
 * i18n — Lightweight internationalization engine.
 * Supports interpolation: t('hello', { name: 'World' }) => 'Hello, World'
 */
import en from './en.js';
import id from './id.js';

const locales = { en, id };
let currentLocale = 'en';

/**
 * Set the active locale.
 * @param {'en'|'id'} locale
 */
export function setLocale(locale) {
  if (locales[locale]) {
    currentLocale = locale;
    // Persist preference
    try { localStorage.setItem('privapdf_locale', locale); } catch (e) {}
  }
}

/**
 * Get the current locale.
 * @returns {string}
 */
export function getLocale() {
  return currentLocale;
}

/**
 * Translate a key with optional interpolation.
 * @param {string} key — Dot-separated key
 * @param {Object} params — Interpolation values, e.g. { count: 5 }
 * @returns {string}
 */
export function t(key, params = {}) {
  const strings = locales[currentLocale] || locales.en;
  let value = strings[key] ?? locales.en[key] ?? key;

  // Interpolate {param} placeholders
  for (const [k, v] of Object.entries(params)) {
    value = value.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
  }

  return value;
}

// Initialize from stored preference or browser language
function initLocale() {
  try {
    const stored = localStorage.getItem('privapdf_locale');
    if (stored && locales[stored]) {
      currentLocale = stored;
      return;
    }
  } catch (e) {}

  // Auto-detect from browser
  const browserLang = navigator.language?.slice(0, 2);
  if (browserLang === 'id') {
    currentLocale = 'id';
  }
}

initLocale();

export default t;
