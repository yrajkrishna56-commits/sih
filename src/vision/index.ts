/**
 * Vision module — public API.
 * Re-exports for clean imports from other parts of the codebase.
 */

// Types
export type {
  VisualRegion,
  VisualContext,
  SanitizedVisualContext,
  SanitizedVisualRegion,
  RedactionRules,
} from './visualTypes';

export { DEFAULT_REDACTION_RULES } from './visualTypes';

// Visual context builder
export {
  buildVisualContext,
  buildSanitizedVisualContext,
  getVisualRedactionSummary,
} from './visualContextBuilder';

// Visual redactor
export {
  classifyRedaction,
  applyVisualRedaction,
  isVisualRegionAllowed,
} from './visualRedactor';

export type { RedactionClassification } from './visualRedactor';
