/**
 * SanitizedContext builder — produces the final SanitizedContext from a DisclosurePlan.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * SECURITY INVARIANT (THE ONE THING THAT MUST NEVER BREAK):
 *
 * RAW USER-ENTERED OR IDENTITY-BEARING DATA NEVER ENTERS SanitizedContext.
 *
 * The dividing line, stated plainly:
 *   - User-entered or identity-bearing field values NEVER enter
 *     SanitizedContext — even if marked ALLOW (which per the decision
 *     matrix shouldn't happen for PERSONAL/SECRET, but this is defense-in-depth).
 *   - Safe to include when ALLOW/TRANSFORM: static, already-publicly-rendered
 *     page content — flight result card text (price, airline, times, flight
 *     number), button labels, headings. This is content the page is already
 *     displaying to everyone who loads it, not something the user typed.
 * ═══════════════════════════════════════════════════════════════════════
 *
 * This builder structurally enforces the invariant:
 * - EXCLUDE and BLOCK entries never appear in SanitizedContext.elements
 * - For MINIMIZE/TRANSFORM: only label, concept, tagName, boundingBox included — no values
 * - For ALLOW: publicText may be included, but only if the concept is PUBLIC/CONTEXTUAL
 */

import type {
  DisclosurePlan,
  SanitizedElement,
  SanitizedContext,
  DisclosureDecision,
  DomainConcept,
} from './taskTypes';
import type { TaggedElement } from './disclosurePolicy';

/**
 * Concepts that represent PUBLIC/CONTEXTUAL page content (safe to include text).
 * These are elements the page already renders to everyone — not user-entered data.
 */
const PUBLIC_CONTENT_CONCEPTS: Set<DomainConcept> = new Set([
  'PRICE',
  'FLIGHT_NUMBER',
  'AIRLINE',
  'DEPARTURE_TIME',
  'ARRIVAL_TIME',
  'DURATION',
  'ORIGIN',
  'DESTINATION',
  'TRAVEL_DATE',
  'SELECTION_CONTROL',
  'SEARCH_CONTROL',
]);

/**
 * Concepts that represent user-entered or identity-bearing data (never include values).
 */
const SENSITIVE_VALUE_CONCEPTS: Set<DomainConcept> = new Set([
  'PASSENGER_NAME',
  'PASSENGER_EMAIL',
  'PASSENGER_PHONE',
  'PASSPORT',
  'PAYMENT_CARD',
  'PAYMENT_CVV',
  'PAYMENT_EXPIRY',
]);

/**
 * Check if a concept is safe to include text content for.
 * This is the structural enforcement — not a "remember not to include it."
 */
function isSafeToIncludeText(concept: DomainConcept, decision: DisclosureDecision): boolean {
  // NEVER include text for sensitive-value concepts, regardless of decision
  if (SENSITIVE_VALUE_CONCEPTS.has(concept)) {
    return false;
  }

  // For ALLOW decisions on public content concepts, text is safe
  if (decision === 'ALLOW' && PUBLIC_CONTENT_CONCEPTS.has(concept)) {
    return true;
  }

  // For TRANSFORM decisions, we include transformed text (not raw values)
  // The transform function in disclosurePolicy.ts handles generalization
  if (decision === 'TRANSFORM' && PUBLIC_CONTENT_CONCEPTS.has(concept)) {
    return true;
  }

  return false;
}

/**
 * Build a SanitizedContext from a DisclosurePlan and tagged elements.
 *
 * Only ALLOW/MINIMIZE/TRANSFORM entries appear in the output.
 * EXCLUDE and BLOCK entries are omitted entirely.
 */
export function buildSanitizedContext(
  plan: DisclosurePlan,
  taggedElements: TaggedElement[],
  taskText: string,
): SanitizedContext {
  // Build lookup from elementId → TaggedElement
  const taggedMap = new Map<string, TaggedElement>();
  for (const t of taggedElements) {
    taggedMap.set(t.elementId, t);
  }

  const sanitizedElements: SanitizedElement[] = [];

  for (const ruling of plan.rulings) {
    // Only include ALLOW/MINIMIZE/TRANSFORM — EXCLUDE and BLOCK never appear
    if (ruling.decision === 'EXCLUDE' || ruling.decision === 'BLOCK') {
      continue;
    }

    const tagged = taggedMap.get(ruling.elementId);
    if (!tagged) continue;

    const element: SanitizedElement = {
      elementId: ruling.elementId,
      concept: ruling.concept,
      tagName: tagged.tagName,
      decision: ruling.decision,
    };

    // Include public text ONLY if the concept is safe
    if (isSafeToIncludeText(ruling.concept, ruling.decision) && tagged.text) {
      element.publicText = tagged.text;
    }

    // Include label for all allowed/minimized/transformed elements (it's metadata, not a value)
    if (tagged.label) {
      element.label = tagged.label;
    }

    // Include bounding box for spatial context
    if (tagged.boundingBox) {
      element.boundingBox = tagged.boundingBox;
    }

    sanitizedElements.push(element);
  }

  return {
    timestamp: Date.now(),
    task: taskText,
    elements: sanitizedElements,
  };
}
