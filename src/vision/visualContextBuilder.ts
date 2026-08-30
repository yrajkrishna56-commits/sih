/**
 * Visual Context Builder — constructs visual context from DOM elements.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * DESIGN DECISION:
 *
 * This module builds a DOM-backed visual context. It does NOT capture
 * actual screenshots. Element bounding boxes from Phase 1 provide
 * spatial information. Sensitivity data from Phase 2 and disclosure
 * decisions from Phase 3 determine which regions must be redacted.
 *
 * The visual context complements the DOM semantic context:
 * - DOM provides: labels, concepts, task relevance, privacy classifications
 * - Visual provides: spatial relationships, rendering state, screen layout
 *
 * FUTURE: Add actual screenshot capture (chrome.tabs.captureVisibleTab),
 * canvas-based redaction, and vision model inference.
 * ═══════════════════════════════════════════════════════════════════════
 *
 * SECURITY INVARIANT:
 * Raw screenshots never leave the browser.
 * Only SanitizedVisualContext may be transmitted.
 */

import type { PageRepresentation, PageElement } from '../shared/types';
import type { PrivacyAnalysis } from '../privacy/privacyTypes';
import type { SanitizedContext, DomainConcept } from '../task/taskTypes';
import type {
  VisualContext,
  VisualRegion,
  SanitizedVisualContext,
  SanitizedVisualRegion,
  RedactionRules,
} from './visualTypes';
import { DEFAULT_REDACTION_RULES } from './visualTypes';

// ─── Public API ────────────────────────────────────────────────────

/**
 * Build a full VisualContext from page data.
 * Contains ALL regions including sensitive ones.
 * Used internally — NEVER transmitted.
 */
export function buildVisualContext(
  pageRepresentation: PageRepresentation,
  privacyAnalysis: PrivacyAnalysis,
): VisualContext {
  const regions: VisualRegion[] = [];

  // Look up privacy assessments by elementId
  const assessmentMap = new Map(
    privacyAnalysis.assessments.map(a => [a.elementId, a])
  );

  for (const element of pageRepresentation.elements) {
    if (!element.boundingBox) continue; // Skip elements without spatial data
    if (!element.visible) continue;    // Skip invisible elements

    const assessment = assessmentMap.get(element.id);
    const concept = inferConcept(element);
    const isRedacted = false; // Full context is not redacted

    regions.push({
      elementId: element.id,
      concept,
      boundingBox: element.boundingBox,
      visible: element.visible,
      redacted: isRedacted,
    });
  }

  return {
    width: typeof document !== 'undefined' ? document.documentElement.clientWidth : 1920,
    height: typeof document !== 'undefined' ? document.documentElement.clientHeight : 1080,
    timestamp: Date.now(),
    regions,
  };
}

/**
 * Infer a DomainConcept from a PageElement's characteristics.
 * Uses heuristics based on tag type, role, and text content.
 */
function inferConcept(element: PageElement): DomainConcept {
  const text = (element.text || '').toLowerCase();
  const label = (element.label || '').toLowerCase();
  const combined = `${text} ${label}`;

  // Check for selection/search controls
  if (element.tagName === 'BUTTON' || element.role === 'button') {
    if (combined.includes('select') || combined.includes('choose')) return 'SELECTION_CONTROL';
    if (combined.includes('search')) return 'SEARCH_CONTROL';
  }

  // Check for input fields
  if (element.tagName === 'INPUT') {
    if (combined.includes('email')) return 'PASSENGER_EMAIL';
    if (combined.includes('phone')) return 'PASSENGER_PHONE';
    if (combined.includes('name')) return 'PASSENGER_NAME';
    if (combined.includes('card') || combined.includes('payment')) return 'PAYMENT_CARD';
    if (combined.includes('cvv') || combined.includes('cvc')) return 'PAYMENT_CVV';
    if (combined.includes('expiry') || combined.includes('exp')) return 'PAYMENT_EXPIRY';
  }

  // Check for price-like content
  if (/[\$\₹\€\£]\s*[\d,]+/.test(text) || combined.includes('price') || combined.includes('fare')) {
    return 'PRICE';
  }

  // Check for time-like content
  if (/\d{1,2}:\d{2}/.test(text)) {
    return 'DEPARTURE_TIME';
  }

  // Check for flight number patterns
  if (/[A-Z]{2}\s*\d{2,4}/.test(text)) {
    return 'FLIGHT_NUMBER';
  }

  // Check for airline names (common patterns)
  if (combined.includes('airline') || combined.includes('airways')) {
    return 'AIRLINE';
  }

  // Check for duration
  if (combined.includes('duration') || /\d+h\s*\d*m/.test(text)) {
    return 'DURATION';
  }

  // Default
  return 'UNKNOWN';
}

/**
 * Build a SanitizedVisualContext from visual context and disclosure decisions.
 * Only approved regions are included. Sensitive/redacted regions are excluded.
 */
export function buildSanitizedVisualContext(
  visualContext: VisualContext,
  sanitizedContext: SanitizedContext,
  rules: RedactionRules = DEFAULT_REDACTION_RULES,
): SanitizedVisualContext {
  const allowedElementIds = new Set(
    sanitizedContext.elements.map(el => el.elementId)
  );

  const sanitizedRegions: SanitizedVisualRegion[] = [];
  let redactedCount = 0;

  for (const region of visualContext.regions) {
    // Check if element is in the sanitized context (disclosed)
    if (!allowedElementIds.has(region.elementId)) {
      redactedCount++;
      continue; // Undisclosed elements are excluded
    }

    // Check redaction rules
    if (shouldRedactRegion(region, rules)) {
      redactedCount++;
      continue; // Redacted regions are excluded from sanitized output
    }

    sanitizedRegions.push({
      elementId: region.elementId,
      concept: region.concept,
      boundingBox: region.boundingBox,
      visible: region.visible,
    });
  }

  const visibleCount = sanitizedRegions.filter(r => r.visible).length;

  return {
    width: visualContext.width,
    height: visualContext.height,
    timestamp: Date.now(),
    regions: sanitizedRegions,
    summary: {
      totalRegions: visualContext.regions.length,
      redactedRegions: redactedCount,
      visibleRegions: visibleCount,
    },
  };
}

/**
 * Determine if a visual region should be redacted.
 * Defense-in-depth: checks both decision-based and concept-based rules.
 */
function shouldRedactRegion(
  region: VisualRegion,
  rules: RedactionRules,
): boolean {
  // Always redact certain concepts (defense-in-depth)
  if (rules.alwaysRedactConcepts.has(region.concept)) {
    return true;
  }

  // Redact regions marked as redacted
  if (region.redacted) {
    return true;
  }

  return false;
}

/**
 * Get a human-readable summary of visual context sanitization.
 */
export function getVisualRedactionSummary(
  original: VisualContext,
  sanitized: SanitizedVisualContext,
): string {
  const redacted = original.regions.length - sanitized.regions.length;
  return `Visual: ${original.regions.length} regions → ${sanitized.regions.length} approved, ${redacted} redacted`;
}
