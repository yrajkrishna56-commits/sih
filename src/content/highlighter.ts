/**
 * Element highlighting module — draws a non-destructive overlay on a
 * selected element. The overlay is injected as a sibling (absolutely-positioned
 * div), NOT as a style mutation on the target element. This guarantees zero
 * risk of corrupting the host page's layout or CSS.
 *
 * Phase 2 extension: supports sensitivity color-coding via the optional
 * `color` parameter. Falls back to default blue if no color provided.
 *
 * SECURITY INVARIANT: No data leaves window context except via extension messaging.
 * The overlay is fully reversible — it can be removed at any time.
 */

import { HIGHLIGHT_Z_INDEX, HIGHLIGHT_CLASS, DEFAULT_HIGHLIGHT_COLOR } from '../shared/constants';

let currentOverlay: HTMLDivElement | null = null;

/**
 * Removes any existing highlight overlay from the page.
 */
export function clearHighlight(): void {
  if (currentOverlay) {
    currentOverlay.remove();
    currentOverlay = null;
  }
}

/**
 * Highlights an element by its extension-generated ID.
 *
 * @param elementId - The stable ID (from getStableId / WeakMap)
 * @param color - Optional color override (e.g. sensitivity tier color).
 *                Falls back to DEFAULT_HIGHLIGHT_COLOR.
 * @returns true if the element was found and highlighted, false otherwise
 */
export function highlightElement(elementId: string, color?: string): boolean {
  // Clear any previous highlight
  clearHighlight();

  const highlightColor = color || DEFAULT_HIGHLIGHT_COLOR;

  // Find the element by checking the data-ppba-id attribute
  const element = document.querySelector(`[${CSS.escape('data-ppba-id')}="${CSS.escape(elementId)}"]`);
  if (!element) {
    console.warn(`[PPBA] Could not find element with ID: ${elementId}`);
    return false;
  }

  const rect = element.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    console.warn(`[PPBA] Element ${elementId} has zero-size bounding box, cannot highlight.`);
    return false;
  }

  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = HIGHLIGHT_CLASS;
  overlay.style.cssText = `
    position: fixed;
    left: ${rect.x}px;
    top: ${rect.y}px;
    width: ${rect.width}px;
    height: ${rect.height}px;
    z-index: ${HIGHLIGHT_Z_INDEX};
    pointer-events: none;
    border: 3px solid ${highlightColor};
    background-color: ${highlightColor}26;
    border-radius: 4px;
    box-shadow: 0 0 0 2px ${highlightColor}4D;
    transition: opacity 0.2s ease;
  `;

  // Add a small label showing the element ID
  const label = document.createElement('div');
  label.style.cssText = `
    position: absolute;
    top: -24px;
    left: 0;
    background: ${highlightColor};
    color: white;
    font-size: 11px;
    font-family: monospace;
    padding: 2px 6px;
    border-radius: 3px;
    white-space: nowrap;
    pointer-events: none;
  `;
  label.textContent = elementId;
  overlay.appendChild(label);

  // Inject as a sibling of the target element (not a child)
  if (element.parentElement) {
    element.parentElement.appendChild(overlay);
  } else {
    document.body.appendChild(overlay);
  }

  currentOverlay = overlay;
  return true;
}
