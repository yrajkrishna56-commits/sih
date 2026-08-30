/**
 * Domain concept tagger — maps a PageElement (Phase 1) + PrivacyAssessment (Phase 2)
 * to a DomainConcept (Phase 3).
 *
 * Uses the same evidence-based pattern as Phase 2's classifiers:
 * label/text/attribute keyword rules mapping elements to DomainConcept.
 *
 * HACKATHON-SCOPED: This vocabulary is intentionally flight-booking-specific.
 * A production system would need a general-purpose concept taxonomy.
 *
 * SECURITY INVARIANT: Only reads static page metadata (attribute names,
 * label text, element text). Never reads element.value for evidence.
 */

import type { PageElement } from '../shared/types';
import type { PrivacyAssessment } from '../privacy/privacyTypes';
import type { DomainConcept } from './taskTypes';
import {
  CONCEPT_RULES,
  INPUT_TYPE_CONCEPT_RULES,
  AUTOCOMPLETE_CONCEPT_RULES,
  TAG_CONCEPT_RULES,
} from './conceptRules';

/** Normalize text for keyword matching (same as Phase 2's normalizeText) */
function normalizeText(text: string): string {
  return text
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Tag a single PageElement with a DomainConcept.
 * Returns the best-matching concept, or 'UNKNOWN' if no rule fires.
 *
 * Priority:
 * 1. PrivacyAssessment mapping (PIIType → DomainConcept) — high confidence
 * 2. Input type rules
 * 3. Autocomplete rules
 * 4. Tag + text rules (buttons, selects)
 * 5. Text/label keyword rules
 * 6. Fallback → UNKNOWN
 */
export function tagElement(
  element: PageElement,
  assessment: PrivacyAssessment | undefined,
): DomainConcept {
  // 1. Map from Phase 2 PIIType if available — this is the strongest signal
  if (assessment) {
    const piiConcept = mapPIITypeToConcept(assessment.piiType);
    if (piiConcept !== 'UNKNOWN') {
      return piiConcept;
    }
  }

  // 2. Input type rules
  if (element.type) {
    for (const rule of INPUT_TYPE_CONCEPT_RULES) {
      if (element.type === rule.typePattern) {
        return rule.concept;
      }
    }
  }

  // 3. Build combined text from label, ariaLabel, text for keyword matching
  const combinedText = normalizeText(
    [element.label, element.ariaLabel, element.text]
      .filter(Boolean)
      .join(' ')
  );

  // 4. Tag + text rules (for buttons, selects)
  if (element.tagName) {
    for (const rule of TAG_CONCEPT_RULES) {
      if (rule.tagPatterns.includes(element.tagName)) {
        for (const keyword of rule.textKeywords) {
          if (combinedText.includes(keyword)) {
            return rule.concept;
          }
        }
      }
    }
  }

  // 5. Text/label keyword rules
  for (const rule of CONCEPT_RULES) {
    for (const keyword of rule.keywords) {
      if (combinedText.includes(keyword)) {
        return rule.concept;
      }
    }
  }

  return 'UNKNOWN';
}

/**
 * Map a Phase 2 PIIType to a Phase 3 DomainConcept.
 * These are pass-through aliases where the PII type is already meaningful.
 */
function mapPIITypeToConcept(piiType: string): DomainConcept {
  const map: Record<string, DomainConcept> = {
    'PERSON_NAME':      'PASSENGER_NAME',
    'EMAIL':            'PASSENGER_EMAIL',
    'PHONE':            'PASSENGER_PHONE',
    'PASSPORT_NUMBER':  'PASSPORT',
    'CARD_NUMBER':      'PAYMENT_CARD',
    'CVV':              'PAYMENT_CVV',
    'CARD_EXPIRY':      'PAYMENT_EXPIRY',
    'PASSWORD':         'PAYMENT_CVV',  // password fields in payment context
    'ADDRESS':          'UNKNOWN',      // address doesn't map cleanly to a flight concept
    'BANK_ACCOUNT':     'UNKNOWN',
    'NATIONAL_ID':      'UNKNOWN',
    'TAX_ID':           'UNKNOWN',
    'DATE_OF_BIRTH':    'UNKNOWN',
    'LOCATION':         'UNKNOWN',
    'NONE':             'UNKNOWN',
  };
  return map[piiType] ?? 'UNKNOWN';
}

/**
 * Tag all elements in a PageRepresentation, returning a map from elementId → DomainConcept.
 */
export function tagAllElements(
  elements: PageElement[],
  assessments: PrivacyAssessment[],
): Map<string, DomainConcept> {
  // Build assessment lookup
  const assessmentMap = new Map<string, PrivacyAssessment>();
  for (const a of assessments) {
    assessmentMap.set(a.elementId, a);
  }

  const conceptMap = new Map<string, DomainConcept>();
  for (const element of elements) {
    const assessment = assessmentMap.get(element.id);
    conceptMap.set(element.id, tagElement(element, assessment));
  }

  return conceptMap;
}
