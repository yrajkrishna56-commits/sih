/**
 * Phase 5 — Action types for the Local Action Gate.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * SECURITY INVARIANT:
 * The AI must NEVER be allowed to:
 * - Execute arbitrary JavaScript
 * - Type or transmit secret values
 * - Navigate to arbitrary URLs
 * - Perform form submissions
 * - Access password/credit card/CVV fields
 *
 * The allowed action vocabulary is intentionally small and auditable.
 * ═══════════════════════════════════════════════════════════════════════
 */

// ─── Action Types ──────────────────────────────────────────────────

/** The complete set of action types the AI may propose. */
export type ActionType =
  | 'CLICK'          // Click a button, link, or interactive element
  | 'SCROLL'         // Scroll to an element
  | 'SELECT';        // Select an option in a select element

/** Actions the AI must NEVER propose (rejection rules). */
export const FORBIDDEN_ACTIONS: Set<string> = new Set([
  'TYPE_TEXT',
  'SUBMIT_FORM',
  'NAVIGATE_URL',
  'EXECUTE_JS',
  'KEYBOARD_INPUT',
  'SET_VALUE',
]);

/** Actions that require explicit user approval (all actions do by default). */
export const CONSEQUENTIAL_ACTIONS: Set<ActionType> = new Set([
  'CLICK',
  'SCROLL',
  'SELECT',
]);

// ─── Validation ────────────────────────────────────────────────────

/** Allowed action types as a readonly array for validation. */
export const ALLOWED_ACTION_TYPES: readonly ActionType[] = [
  'CLICK',
  'SCROLL',
  'SELECT',
];

/** Check if an action type is in the allowed vocabulary. */
export function isAllowedActionType(actionType: string): actionType is ActionType {
  return (ALLOWED_ACTION_TYPES as readonly string[]).includes(actionType);
}

// ─── Validated Action ───────────────────────────────────────────────

/**
 * An action that has passed all local validation checks.
 * Only ValidatedAction may be presented to the user for approval.
 */
export interface ValidatedAction {
  /** Original action from the AI proposal */
  type: ActionType;
  /** Element to act upon (verified to exist and be disclosed) */
  elementId: string;
  /** Human-readable description of what this action will do */
  description: string;
  /** Whether user approval is required before execution */
  requiresApproval: boolean;
  /** Whether user has approved this action */
  approved: boolean;
}

// ─── Action Execution Result ────────────────────────────────────────

export interface ActionResult {
  success: boolean;
  actionType: ActionType;
  elementId: string;
  /** Timestamp of execution */
  executedAt: number;
  /** Error message if failed */
  error?: string;
}
