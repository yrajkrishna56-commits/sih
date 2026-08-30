/**
 * Phase 2 — Privacy classification types.
 *
 * These are additive to Phase 1's types. Phase 1's PageElement/PageRepresentation
 * remain untouched. PrivacyAssessment is stored separately, joined by elementId.
 */

// ─── PII Taxonomy ──────────────────────────────────────────────────

export type PIIType =
  | 'NONE'
  | 'PERSON_NAME'
  | 'EMAIL'
  | 'PHONE'
  | 'ADDRESS'
  | 'PASSWORD'
  | 'CARD_NUMBER'
  | 'CARD_EXPIRY'
  | 'CVV'
  | 'BANK_ACCOUNT'
  | 'PASSPORT_NUMBER'
  | 'NATIONAL_ID'
  | 'TAX_ID'
  | 'DATE_OF_BIRTH'
  | 'LOCATION';

// ─── Sensitivity Tiers ─────────────────────────────────────────────

export type SensitivityLevel =
  | 'PUBLIC'
  | 'CONTEXTUAL'
  | 'PERSONAL'
  | 'SECRET';

// ─── Detection Methods ─────────────────────────────────────────────

export type DetectionMethod =
  | 'INPUT_TYPE'
  | 'AUTOCOMPLETE'
  | 'FIELD_NAME'
  | 'FIELD_ID'
  | 'ARIA_LABEL'
  | 'LABEL'
  | 'PLACEHOLDER'
  | 'CONTEXT'
  | 'PATTERN'
  | 'VALUE_STRUCTURE';

// ─── Evidence Signal ───────────────────────────────────────────────

export interface EvidenceSignal {
  method: DetectionMethod;
  matchedValue: string;   // the attribute/text that matched — NOT the field's actual user value
  suggestedType: PIIType;
  weight: number;         // 0–1, see confidence.ts
}

// ─── Per-Element Assessment ────────────────────────────────────────

export interface PrivacyAssessment {
  elementId: string;      // ties back to PageElement.id from Phase 1
  piiType: PIIType;
  sensitivity: SensitivityLevel;
  confidence: number;     // 0–1
  detectionMethods: DetectionMethod[];
  explanation: string;
  evidence: EvidenceSignal[];
}

// ─── Page-Level Summary ────────────────────────────────────────────

export interface PrivacyAnalysis {
  timestamp: number;
  totalAnalyzed: number;
  publicCount: number;
  contextualCount: number;
  personalCount: number;
  secretCount: number;
  piiCount: number;
  assessments: PrivacyAssessment[];
}
