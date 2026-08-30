/**
 * Context rules — classify elements based on DOM context signals
 * that aren't captured by type/autocomplete/label alone.
 *
 * Example: a bare `type="date"` input with label containing "birth"
 * should be DATE_OF_BIRTH, while one with "travel" should be CONTEXTUAL.
 */

import type { PIIType, DetectionMethod, EvidenceSignal } from '../privacyTypes';
import { WEIGHT_STRONG } from '../confidence';

export interface ContextRule {
  /** Check the element's type attribute */
  typeAttr?: string;
  /** Check if any evidence text (label/name/id) contains this keyword */
  evidenceKeyword?: string;
  piiType: PIIType;
  method: DetectionMethod;
  weight: number;
}

export const CONTEXT_RULES: ContextRule[] = [
  // type="date" + birth-related keyword → DATE_OF_BIRTH
  {
    typeAttr: 'date',
    evidenceKeyword: 'birth',
    piiType: 'DATE_OF_BIRTH',
    method: 'CONTEXT',
    weight: WEIGHT_STRONG,
  },
  {
    typeAttr: 'date',
    evidenceKeyword: 'dob',
    piiType: 'DATE_OF_BIRTH',
    method: 'CONTEXT',
    weight: WEIGHT_STRONG,
  },
  // Location keywords
  {
    evidenceKeyword: 'origin',
    piiType: 'LOCATION',
    method: 'CONTEXT',
    weight: 0.25,
  },
  {
    evidenceKeyword: 'destination',
    piiType: 'LOCATION',
    method: 'CONTEXT',
    weight: 0.25,
  },
];

/**
 * Apply context rules to an element's type attribute and evidence text.
 * Returns signals for any rules that match.
 */
export function applyContextRules(
  typeAttr: string | null,
  evidenceTexts: string[],
): EvidenceSignal[] {
  const signals: EvidenceSignal[] = [];
  const combinedEvidence = evidenceTexts.join(' ').toLowerCase();

  for (const rule of CONTEXT_RULES) {
    // Check type attribute match
    if (rule.typeAttr && typeAttr !== rule.typeAttr) continue;

    // Check evidence keyword match
    if (rule.evidenceKeyword && !combinedEvidence.includes(rule.evidenceKeyword)) continue;

    signals.push({
      method: rule.method,
      matchedValue: rule.evidenceKeyword ?? rule.typeAttr ?? '',
      suggestedType: rule.piiType,
      weight: rule.weight,
    });
  }

  return signals;
}
