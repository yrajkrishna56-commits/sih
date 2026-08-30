/**
 * Phase 3 — Task-Aware Minimum Disclosure types.
 *
 * Third state layer alongside Phase 1/2's:
 *   pageRepresentation, privacyAnalysis, and now
 *   disclosurePlan / sanitizedContext, joined by elementId.
 *
 * Do not merge into the existing two.
 */

// ─── Task Intent ───────────────────────────────────────────────────

export type TaskIntent =
  | 'FLIGHT_SEARCH'
  | 'FLIGHT_SELECTION'
  | 'FORM_REVIEW'
  | 'FORM_COMPLETION_PREVIEW'
  | 'GENERIC_PAGE_NAVIGATION'
  | 'UNKNOWN';

// ─── Domain Concept ────────────────────────────────────────────────

/**
 * Hackathon-scoped vocabulary for flight booking domain.
 * NOT a general-purpose ontology — this is intentionally domain-specific
 * for the demo and will need extension for other domains.
 */
export type DomainConcept =
  | 'PRICE'
  | 'FLIGHT_NUMBER'
  | 'AIRLINE'
  | 'DEPARTURE_TIME'
  | 'ARRIVAL_TIME'
  | 'DURATION'
  | 'ORIGIN'
  | 'DESTINATION'
  | 'TRAVEL_DATE'
  | 'SELECTION_CONTROL'
  | 'SEARCH_CONTROL'
  | 'PASSENGER_NAME'
  | 'PASSENGER_EMAIL'
  | 'PASSENGER_PHONE'
  | 'PASSPORT'
  | 'PAYMENT_CARD'
  | 'PAYMENT_CVV'
  | 'PAYMENT_EXPIRY'
  | 'UNKNOWN';

// ─── Task Analysis Result ──────────────────────────────────────────

export interface TaskAnalysisResult {
  rawText: string;
  intent: TaskIntent;
  confidence: number;
  entities: { origin?: string; destination?: string };
  requiredConcepts: DomainConcept[];
  explanation: string;
}

// ─── Disclosure Decision ───────────────────────────────────────────

export type DisclosureDecision =
  | 'ALLOW'
  | 'MINIMIZE'
  | 'TRANSFORM'
  | 'EXCLUDE'
  | 'BLOCK';

// ─── Disclosure Reason ─────────────────────────────────────────────

export type DisclosureReason =
  | 'TASK_REQUIRES_CONCEPT'
  | 'NOT_TASK_RELEVANT'
  | 'SECRET_ALWAYS_BLOCKED'
  | 'PERSONAL_DATA_MINIMIZED'
  | 'CONTEXTUAL_DATA_GENERALIZED'
  | 'UNKNOWN_TASK_CONSERVATIVE_EXCLUDE';

// ─── Disclosure Ruling ─────────────────────────────────────────────

export interface DisclosureRuling {
  elementId: string;
  concept: DomainConcept;
  decision: DisclosureDecision;
  reason: DisclosureReason;
  explanation: string;
}

// ─── Disclosure Plan ───────────────────────────────────────────────

export interface DisclosurePlan {
  taskAnalysis: TaskAnalysisResult;
  rulings: DisclosureRuling[];
  summary: {
    allowed: number;
    minimized: number;
    excluded: number;
    blocked: number;
  };
}

// ─── Sanitized Element ─────────────────────────────────────────────

export interface SanitizedElement {
  elementId: string;
  concept: DomainConcept;
  tagName: string;
  /**
   * Safe to include: static, already-publicly-rendered page content.
   * NEVER includes user-entered or identity-bearing field values.
   */
  publicText?: string;
  label?: string;
  boundingBox?: { x: number; y: number; width: number; height: number };
  decision: DisclosureDecision;
}

// ─── Sanitized Context ─────────────────────────────────────────────

/**
 * The final output of Phase 3. Contains only task-relevant elements
 * with ALLOW/MINIMIZE/TRANSFORM decisions. Elements with EXCLUDE or
 * BLOCK never appear here.
 *
 * SECURITY INVARIANT: No raw user-entered or identity-bearing data
 * enters this structure. This is enforced structurally in
 * sanitizedContextBuilder.ts — the builder function does not have
 * access to .value for PERSONAL/SECRET-tagged elements.
 */
export interface SanitizedContext {
  timestamp: number;
  task: string;
  elements: SanitizedElement[];
}
