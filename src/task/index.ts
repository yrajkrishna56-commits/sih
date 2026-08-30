/**
 * Task module — public API.
 * Re-exports for clean imports from other parts of the codebase.
 */

// Types
export type {
  TaskIntent,
  DomainConcept,
  TaskAnalysisResult,
  DisclosureDecision,
  DisclosureReason,
  DisclosureRuling,
  DisclosurePlan,
  SanitizedElement,
  SanitizedContext,
} from './taskTypes';

// Task analyzer
export { analyzeTask, taskConfidenceBand, CONFIDENCE_HIGH, CONFIDENCE_MEDIUM, CONFIDENCE_LOW } from './taskAnalyzer';

// Concept tagger
export { tagElement, tagAllElements } from './conceptTagger';

// Entity extractor
export { extractEntities } from './entityExtractor';

// Intent rules (exported for auditability)
export { INTENT_RULES, INTENT_REQUIRED_CONCEPTS } from './intentRules';

// Disclosure policy
export { evaluateDisclosure, evaluateDisclosurePlan, buildTaggedElement } from './disclosurePolicy';
export type { TaggedElement } from './disclosurePolicy';

// Sanitized context builder
export { buildSanitizedContext } from './sanitizedContextBuilder';
