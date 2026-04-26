/**
 * DOM Helpers — Safe, concise DOM manipulation utilities.
 */

/**
 * Query a single element.
 * @param {string} selector
 * @param {Element} parent
 * @returns {Element|null}
 */
export function $(selector, parent = document) {
  return parent.querySelector(selector);
}

/**
 * Query all matching elements.
 * @param {string} selector
 * @param {Element} parent
 * @returns {Element[]}
 */
export function $$(selector, parent = document) {
  return [...parent.querySelectorAll(selector)];
}

/**
 * Create an element with attributes and children.
 * @param {string} tag
 * @param {Object} attrs — { class, id, style, data-*, ... }
 * @param {(string|Element)[]} children
 * @returns {Element}
 */
export function createElement(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);

  for (const [key, val] of Object.entries(attrs)) {
    if (key === 'className') {
      el.className = val;
    } else if (key === 'style' && typeof val === 'object') {
      Object.assign(el.style, val);
    } else if (key === 'innerHTML') {
      el.innerHTML = val;
    } else if (key === 'textContent') {
      el.textContent = val;
    } else if (key.startsWith('on') && typeof val === 'function') {
      el.addEventListener(key.slice(2).toLowerCase(), val);
    } else if (key === 'dataset') {
      Object.assign(el.dataset, val);
    } else {
      el.setAttribute(key, val);
    }
  }

  for (const child of children) {
    if (typeof child === 'string') {
      el.appendChild(document.createTextNode(child));
    } else if (child instanceof Element) {
      el.appendChild(child);
    }
  }

  return el;
}

/**
 * Show an element (remove .hidden class).
 * @param {Element|string} el
 */
export function show(el) {
  const element = typeof el === 'string' ? $(el) : el;
  element?.classList.remove('hidden');
}

/**
 * Hide an element (add .hidden class).
 * @param {Element|string} el
 */
export function hide(el) {
  const element = typeof el === 'string' ? $(el) : el;
  element?.classList.add('hidden');
}

/**
 * Toggle visibility.
 * @param {Element|string} el
 * @param {boolean} force
 */
export function toggle(el, force) {
  const element = typeof el === 'string' ? $(el) : el;
  element?.classList.toggle('hidden', !force);
}
