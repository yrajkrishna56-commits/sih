/**
 * Element utility functions for visibility detection, clickability checks,
 * and stable ID assignment. These are pure DOM utility functions — no Chrome
 * API calls, no network calls, no data leaves the page context.
 */

import { PPBA_ID_ATTR, MIN_ELEMENT_AREA } from '../shared/constants';

/** Source of truth for extension-generated element IDs within this page session */
const idMap = new WeakMap<Element, string>();

/** Counter for generating unique IDs when the element has no native id */
let idCounter = 0;

/**
 * Tags that are considered interactive for clickability purposes.
 */
const INTERACTIVE_TAGS = new Set([
  'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'A',
]);

/**
 * Tags to skip during traversal entirely.
 */
const SKIP_TAGS = new Set([
  'SCRIPT', 'STYLE', 'NOSCRIPT', 'HEAD', 'META', 'LINK',
]);

/**
 * Assigns or retrieves a stable ID for an element.
 *
 * Strategy (per §5):
 * 1. If the element has a native `id` attribute AND that id is unique in the
 *    document, use it.
 * 2. Otherwise, check for an existing `data-ppba-id` attribute (persisted from
 *    a prior extraction).
 * 3. Otherwise, generate a new `data-ppba-id`, store it in the WeakMap, and
 *    set the attribute on the element.
 */
export function getStableId(element: Element): string {
  // Check WeakMap first (fast path for re-extraction)
  const cached = idMap.get(element);
  if (cached) return cached;

  // Check if we already set a data-ppba-id attribute
  const existingAttr = element.getAttribute(PPBA_ID_ATTR);
  if (existingAttr) {
    idMap.set(element, existingAttr);
    return existingAttr;
  }

  // Check for native id — use only if unique
  const nativeId = element.id;
  if (nativeId) {
    const matches = document.querySelectorAll(`#${CSS.escape(nativeId)}`);
    if (matches.length === 1) {
      idMap.set(element, nativeId);
      return nativeId;
    }
  }

  // Generate a new stable ID
  idCounter++;
  const generatedId = `ppba-${idCounter}`;
  idMap.set(element, generatedId);
  element.setAttribute(PPBA_ID_ATTR, generatedId);
  return generatedId;
}

/**
 * Returns the WeakMap for external lookup (highlighter needs this).
 */
export function getIdMap(): WeakMap<Element, string> {
  return idMap;
}

/**
 * Determines if an element should be skipped during traversal.
 */
export function shouldSkipElement(element: Element): boolean {
  const tag = element.tagName;
  return SKIP_TAGS.has(tag);
}

/**
 * Checks if an element is visible in the viewport.
 *
 * Combines:
 * - getBoundingClientRect (non-zero size)
 * - computed style: display, visibility, opacity
 * - ancestor visibility (walks up to check for display:none/visibility:hidden)
 */
export function isVisible(element: Element): boolean {
  // Check ancestors for display:none / visibility:hidden
  let current: Element | null = element;
  while (current && current !== document.documentElement) {
    const style = window.getComputedStyle(current);
    if (style.display === 'none') return false;
    if (style.visibility === 'hidden') return false;
    current = current.parentElement;
  }

  // Check the element's own bounding rect
  const rect = element.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;

  // Check opacity (0 opacity = effectively invisible)
  const style = window.getComputedStyle(element);
  if (parseFloat(style.opacity) === 0) return false;

  return true;
}

/**
 * Checks if an element has a minimum bounding box size (filters out
 * 1x1 tracking pixels and similar noise).
 */
export function hasMinimumSize(element: Element): boolean {
  const rect = element.getBoundingClientRect();
  return rect.width * rect.height >= MIN_ELEMENT_AREA;
}

/**
 * Checks if an element is enabled (not disabled).
 */
export function isEnabled(element: Element): boolean {
  if (element.hasAttribute('disabled')) return false;
  if (element.getAttribute('aria-disabled') === 'true') return false;

  // For form elements, also check the .disabled property
  const htmlEl = element as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
  if ('disabled' in htmlEl && htmlEl.disabled) return false;

  return true;
}

/**
 * Checks if an element is clickable: enabled + visible + (interactive tag or
 * has click handler or has button/link role).
 */
export function isClickable(element: Element): boolean {
  if (!isEnabled(element)) return false;
  if (!isVisible(element)) return false;

  const tag = element.tagName;
  const role = element.getAttribute('role');

  // Interactive tags
  if (INTERACTIVE_TAGS.has(tag)) return true;

  // ARIA roles
  if (role === 'button' || role === 'link') return true;

  // Check for onclick handler (attribute-based)
  if (element.hasAttribute('onclick')) return true;

  // Check for tabindex (makes non-interactive elements focusable/clickable)
  const tabindex = element.getAttribute('tabindex');
  if (tabindex !== null && parseInt(tabindex, 10) >= 0) return true;

  return false;
}

/**
 * Gets the bounding box in viewport coordinates.
 * Used by the highlighter to position overlays correctly.
 */
export function getBoundingBox(element: Element): { x: number; y: number; width: number; height: number } {
  const rect = element.getBoundingClientRect();
  return {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  };
}

/**
 * Gets the accessible label for an element, checking:
 * 1. Associated <label> via for= attribute
 * 2. Wrapping <label> element
 * 3. aria-label
 */
export function getElementLabel(element: Element): string | undefined {
  const htmlEl = element as HTMLInputElement;

  // Check for associated label via for= attribute
  if (htmlEl.id) {
    const label = document.querySelector(`label[for="${CSS.escape(htmlEl.id)}"]`);
    if (label) return label.textContent?.trim() || undefined;
  }

  // Check for wrapping label
  const parentLabel = element.closest('label');
  if (parentLabel) {
    // Get text content excluding the element itself
    const clone = parentLabel.cloneNode(true) as HTMLLabelElement;
    const inputs = clone.querySelectorAll('input, select, textarea, button');
    inputs.forEach(input => input.remove());
    const text = clone.textContent?.trim();
    if (text) return text;
  }

  // Check aria-label
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) return ariaLabel;

  return undefined;
}
