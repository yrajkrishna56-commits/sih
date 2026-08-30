/**
 * Action module — public API.
 * Re-exports for clean imports from other parts of the codebase.
 */

// Types
export type {
  ActionType,
  ValidatedAction,
  ActionResult,
} from './actionTypes';

export {
  ALLOWED_ACTION_TYPES,
  FORBIDDEN_ACTIONS,
  CONSEQUENTIAL_ACTIONS,
  isAllowedActionType,
} from './actionTypes';

// Action Gate
export {
  validateAction,
  executeAction,
  ActionGateError,
} from './actionGate';

export type { ValidationResult } from './actionGate';
