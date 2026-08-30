/**
 * Shared constants for the extension.
 */

/** Namespace prefix for extension-generated element IDs stored in data attributes */
export const PPBA_ID_ATTR = 'data-ppba-id';

/** Maximum number of elements to extract from a single page */
export const MAX_EXTRACTED_ELEMENTS = 1500;

/** Minimum bounding box area (px²) for an element to be considered for extraction */
export const MIN_ELEMENT_AREA = 4;

/** Tags to skip during DOM traversal (non-semantic / dangerous) */
export const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'HEAD', 'META', 'LINK']);

/** Highlight overlay z-index */
export const HIGHLIGHT_Z_INDEX = 2147483647;

/** Highlight overlay class name (for cleanup) */
export const HIGHLIGHT_CLASS = 'ppba-highlight-overlay';

// ─── Sensitivity Colors (Phase 2) ─────────────────────────────────
// Used by highlighter and side panel. Defined here so Phase 3+ can
// reuse the same palette.

export const SENSITIVITY_COLORS: Record<string, string> = {
  PUBLIC:     '#4CAF50',  // green
  CONTEXTUAL: '#FF9800',  // orange
  PERSONAL:   '#F44336',  // red
  SECRET:     '#9C27B0',  // purple
};

/** Default highlight color (Phase 1 blue, used when no sensitivity context) */
export const DEFAULT_HIGHLIGHT_COLOR = '#4A90D9';

// ─── Disclosure Decision Colors (Phase 3) ──────────────────────────
// Used by the Task tab to color-code disclosure decisions.
export const DISCLOSURE_COLORS: Record<string, string> = {
  ALLOW:     '#4CAF50',  // green
  MINIMIZE:  '#FF9800',  // orange
  TRANSFORM: '#2196F3',  // blue
  EXCLUDE:   '#757575',  // gray
  BLOCK:     '#F44336',  // red
};
