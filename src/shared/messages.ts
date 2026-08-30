/**
 * Discriminated-union message contracts for extension messaging.
 * All communication between side panel ↔ background ↔ content script
 * must use these types exclusively.
 */

import type { PageRepresentation } from './types';
import type { PrivacyAnalysis } from '../privacy/privacyTypes';

export type ExtensionMessage =
  | { type: 'ANALYZE_PAGE' }
  | { type: 'PAGE_ANALYSIS_RESULT'; payload: PageRepresentation; privacyAnalysis: PrivacyAnalysis }
  | { type: 'GET_PAGE_INFO' }
  | { type: 'HIGHLIGHT_ELEMENT'; elementId: string; color?: string }
  | { type: 'CLEAR_HIGHLIGHT' }
  | { type: 'ANALYZE_TASK'; taskText: string }
  | { type: 'TASK_ANALYSIS_RESULT'; taskText: string }
  | { type: 'SEND_TO_AI'; sanitizedContext: unknown; taskAnalysis: unknown }
  | { type: 'AI_RESPONSE'; response: unknown; approvalToken?: string }
  | { type: 'EXECUTE_ACTION'; action: unknown; approvalToken?: string }
  | { type: 'ACTION_RESULT'; result: unknown }
  | { type: 'ERROR'; message: string; context?: string };
