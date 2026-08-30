/**
 * Privacy module — public API.
 * Re-exports for clean imports from other parts of the codebase.
 */

export { detectPII } from './piiDetector';
export { extractEvidence, normalizeText } from './evidenceExtractor';
export { scoreAndCombine, confidenceBand, WEIGHT_STRONG, WEIGHT_MEDIUM, WEIGHT_WEAK, CLASSIFICATION_FLOOR } from './confidence';
export { getSensitivity, SENSITIVITY_MAP, SENSITIVITY_COLORS } from './sensitivity';
export type { PIIType, SensitivityLevel, DetectionMethod, EvidenceSignal, PrivacyAssessment, PrivacyAnalysis } from './privacyTypes';
