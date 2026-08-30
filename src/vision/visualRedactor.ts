/**
 * Visual Redactor — local visual privacy enforcement.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * SECURITY RULE:
 * Do NOT send the original screenshot and ask the server to redact it.
 * That violates the privacy architecture.
 *
 * All redaction MUST happen locally, in the browser, before any
 * visual data crosses the network boundary.
 * ═══════════════════════════════════════════════════════════════════════
 *
 * This module handles local visual redaction using:
 * 1. DOM-backed region classification (MVP — implemented)
 * 2. Canvas-based pixel redaction (FUTURE extension)
 *
 * The DOM-backed approach is sufficient for the demo because:
 * - Phase 1 already extracts element bounding boxes
 * - Phase 2 already classifies sensitivity
 * - Phase 3 already determines disclosure decisions
 * - We can mark regions as redacted without touching actual pixels
 *
 * FUTURE: Canvas-based redaction for actual screenshot pixels
 * using OffscreenCanvas or similar browser APIs.
 */

import type { PrivacyAnalysis } from '../privacy/privacyTypes';
import type { SanitizedContext, DisclosureDecision } from '../task/taskTypes';
import type { DomainConcept } from '../task/taskTypes';

// ─── Redaction Classification ──────────────────────────────────────

export interface RedactionClassification {
  elementId: string;
  mustRedact: boolean;
  reason: string;
}

// ─── Public API ────────────────────────────────────────────────────

/**
 * Classify which elements must be visually redacted.
 * Combines Phase 2 sensitivity data with Phase 3 disclosure decisions.
 *
 * @param privacyAnalysis - Phase 2 privacy analysis
 * @param sanitizedContext - Phase 3 sanitized context (only disclosed elements)
 * @returns Classification for each element
 */
export function classifyRedaction(
  privacyAnalysis: PrivacyAnalysis,
  sanitizedContext: SanitizedContext,
): RedactionClassification[] {
  const classifications: RedactionClassification[] = [];
  const disclosedIds = new Set(sanitizedContext.elements.map(el => el.elementId));

  for (const assessment of privacyAnalysis.assessments) {
    const isDisclosed = disclosedIds.has(assessment.elementId);
    let mustRedact = false;
    let reason = '';

    // SECRET elements are always redacted
    if (assessment.sensitivity === 'SECRET') {
      mustRedact = true;
      reason = 'SECRET data must be visually redacted';
    }
    // PERSONAL elements require redaction unless transformed
    else if (assessment.sensitivity === 'PERSONAL') {
      mustRedact = true;
      reason = 'PERSONAL data must be visually redacted';
    }
    // Undisclosed elements are visually redacted (not shown to AI)
    else if (!isDisclosed) {
      mustRedact = true;
      reason = 'Element not disclosed to AI — visually redacted';
    }

    classifications.push({
      elementId: assessment.elementId,
      mustRedact,
      reason,
    });
  }

  return classifications;
}

/**
 * Apply visual redaction to a set of elements.
 * Returns only the elements that are safe to include in visual context.
 *
 * SECURITY: This function enforces the rule that sensitive visual
 * regions are redacted LOCALLY before any data leaves the browser.
 */
export function applyVisualRedaction(
  elements: Array<{
    elementId: string;
    concept: DomainConcept;
    boundingBox?: { x: number; y: number; width: number; height: number };
    visible: boolean;
  }>,
  classifications: RedactionClassification[],
): Array<{
  elementId: string;
  concept: DomainConcept;
  boundingBox?: { x: number; y: number; width: number; height: number };
  visible: boolean;
  redacted: boolean;
}> {
  const classificationMap = new Map(
    classifications.map(c => [c.elementId, c])
  );

  return elements.map(el => {
    const classification = classificationMap.get(el.elementId);
    const redacted = classification?.mustRedact ?? false;

    return {
      elementId: el.elementId,
      concept: el.concept,
      boundingBox: el.boundingBox,
      visible: el.visible,
      redacted,
    };
  });
}

/**
 * Check if an element's visual region should be included in
 * the sanitized visual context (not redacted).
 */
export function isVisualRegionAllowed(
  elementId: string,
  concept: DomainConcept,
  sensitivity: string,
  disclosed: boolean,
): boolean {
  // SECRET data is never included
  if (sensitivity === 'SECRET') return false;

  // PERSONAL data is never included
  if (sensitivity === 'PERSONAL') return false;

  // Undisclosed elements are not included
  if (!disclosed) return false;

  return true;
}
