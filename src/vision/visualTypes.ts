/**
 * Phase 5 — Visual context types for DOM-backed visual representation.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * DESIGN DECISION:
 *
 * This MVP uses DOM-backed visual regions instead of actual screenshot
 * capture. Element bounding boxes from Phase 1 provide the spatial
 * information that a visual pipeline would use. Sensitive regions are
 * identified by combining Phase 2 privacy analysis with Phase 3
 * disclosure decisions.
 *
 * FUTURE EXTENSIBILITY:
 * - Real screenshot capture via chrome.tabs.captureVisibleTab
 * - Canvas-based local redaction
 * - Vision Transformer / WebGPU / ONNX local inference
 * ═══════════════════════════════════════════════════════════════════════
 *
 * SECURITY INVARIANT:
 * Raw screenshots never leave the browser.
 * Only SanitizedVisualContext may be transmitted.
 * Sensitive regions are redacted locally before any transmission.
 */

import type { DomainConcept } from '../task/taskTypes';

// ─── Visual Region ─────────────────────────────────────────────────

/**
 * A visual region representing a single element's spatial presence.
 * Backed by DOM bounding boxes — no actual pixel data required for MVP.
 */
export interface VisualRegion {
  /** Element ID (ties back to Phase 1 PageElement.id) */
  elementId: string;
  /** Domain concept tag from Phase 3 */
  concept: DomainConcept;
  /** Bounding box in viewport coordinates */
  boundingBox: { x: number; y: number; width: number; height: number };
  /** Whether the element is visible on screen */
  visible: boolean;
  /** Whether this region has been redacted (sensitive content masked) */
  redacted: boolean;
  /** Reason for redaction, if applicable */
  redactionReason?: string;
}

// ─── Visual Context (pre-redaction) ────────────────────────────────

/**
 * Full visual context before redaction.
 * Contains ALL regions including sensitive ones.
 * NEVER transmitted — used only for local processing.
 */
export interface VisualContext {
  /** Page dimensions */
  width: number;
  height: number;
  /** Timestamp of capture */
  timestamp: number;
  /** All visual regions (sensitive + non-sensitive) */
  regions: VisualRegion[];
}

// ─── Sanitized Visual Context (post-redaction) ─────────────────────

/**
 * Sanitized visual context — the ONLY visual data that may leave the browser.
 * Sensitive regions are marked as redacted. No raw values included.
 *
 * SECURITY INVARIANT:
 * - No sensitive field values
 * - No raw HTML
 * - No raw input values
 * - Redacted regions never contain original content
 */
export interface SanitizedVisualContext {
  /** Page dimensions */
  width: number;
  height: number;
  /** Timestamp of sanitization */
  timestamp: number;
  /** Only non-redacted regions with approved metadata */
  regions: SanitizedVisualRegion[];
  /** Summary counts */
  summary: {
    totalRegions: number;
    redactedRegions: number;
    visibleRegions: number;
  };
}

/**
 * A visual region in the sanitized context.
 * Contains only approved metadata — no sensitive values.
 */
export interface SanitizedVisualRegion {
  /** Element ID */
  elementId: string;
  /** Domain concept tag */
  concept: DomainConcept;
  /** Bounding box (position preserved for spatial reasoning) */
  boundingBox: { x: number; y: number; width: number; height: number };
  /** Whether the element is visible */
  visible: boolean;
}

// ─── Redaction Rules ───────────────────────────────────────────────

/**
 * Rules for which regions must be redacted.
 * Matches the Phase 3 disclosure decision semantics.
 */
export interface RedactionRules {
  /** Elements with these decisions are redacted */
  redactDecisions: Set<string>;
  /** Elements with these concepts are always redacted (defense-in-depth) */
  alwaysRedactConcepts: Set<string>;
}

/** Default redaction rules — matches Phase 3 security invariants */
export const DEFAULT_REDACTION_RULES: RedactionRules = {
  redactDecisions: new Set(['EXCLUDE', 'BLOCK']),
  alwaysRedactConcepts: new Set([
    'PASSPORT',
    'PAYMENT_CARD',
    'PAYMENT_CVV',
    'PAYMENT_EXPIRY',
    'PASSENGER_NAME',
    'PASSENGER_EMAIL',
    'PASSENGER_PHONE',
  ]),
};
