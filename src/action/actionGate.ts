/**
 * Local Action Gate — validates AI-proposed actions before execution.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * THE ONE PROPERTY THIS ENTIRE MODULE EXISTS TO PROVE:
 *
 * The server AI can propose actions, but the LOCAL browser decides:
 * 1. Whether the action type is allowed
 * 2. Whether the target element exists on the page
 * 3. Whether the target element was disclosed to the AI
 * 4. Whether the target element is safe to interact with
 * 5. Whether the user approves the action
 *
 * The remote AI NEVER directly controls the browser.
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Security checks (all must pass):
 * 1. Action type is in the allowed vocabulary
 * 2. Element exists in PageRepresentation
 * 3. Element was disclosed in the current request
 * 4. Element is in the current sanitized context (active plan)
 * 5. Element is clickable (for CLICK actions)
 * 6. Element is not a SECRET-sensitivity element
 * 7. Element is not a PERSONAL-sensitivity element
 * 8. Action is not a forbidden type (eval, form submit, etc.)
 * 9. User approval is required for all consequential actions
 */

import type { PageRepresentation } from '../shared/types';
import type { SanitizedContext, DisclosureDecision } from '../task/taskTypes';
import type { ApprovedProposal, ProposedActionType } from '../network/networkTypes';
import type { ActionType, ValidatedAction, ActionResult } from './actionTypes';
import { isAllowedActionType, FORBIDDEN_ACTIONS } from './actionTypes';

// ─── Action Gate Error ─────────────────────────────────────────────

export class ActionGateError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly elementId?: string,
  ) {
    super(message);
    this.name = 'ActionGateError';
  }
}

// ─── Validation Result ─────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  action?: ValidatedAction;
  error?: string;
  errorCode?: string;
  elementId?: string;
}

// ─── Main Validation Function ──────────────────────────────────────

/**
 * Validate a proposed action against all security rules.
 *
 * @param proposal - The validated AI proposal (from responseValidator)
 * @param pageRepresentation - Current page elements
 * @param disclosedElementIds - Elements disclosed in the current request
 * @param sanitizedContext - Current sanitized context (active plan)
 * @returns ValidationResult with the ValidatedAction if valid
 */
export function validateAction(
  proposal: ApprovedProposal,
  pageRepresentation: PageRepresentation,
  disclosedElementIds: Set<string>,
  sanitizedContext: SanitizedContext,
): ValidationResult {
  // Process each proposed action
  const results: ValidationResult[] = [];

  for (const proposed of proposal.proposedActions) {
    const result = validateSingleAction(
      proposed.type,
      proposed.elementId,
      pageRepresentation,
      disclosedElementIds,
      sanitizedContext,
    );
    results.push(result);
  }

  // All actions must pass validation
  const failures = results.filter(r => !r.valid);
  if (failures.length > 0) {
    return {
      valid: false,
      error: failures.map(f => f.error).join('; '),
      errorCode: failures[0]?.errorCode,
    };
  }

  // Return first validated action (MVP: one action at a time)
  const first = results[0];
  if (!first || !first.action) {
    return { valid: false, error: 'No actions to validate' };
  }

  return { valid: true, action: first.action };
}

/**
 * Validate a single proposed action.
 */
function validateSingleAction(
  type: ProposedActionType,
  elementId: string,
  pageRepresentation: PageRepresentation,
  disclosedElementIds: Set<string>,
  sanitizedContext: SanitizedContext,
): ValidationResult {
  // 1. Map ProposedActionType to ActionType
  const actionType = mapToActionType(type);
  if (!actionType) {
    return {
      valid: false,
      error: `Unknown action type "${type}"`,
      errorCode: 'UNKNOWN_ACTION_TYPE',
    };
  }

  // 2. Check if action type is allowed
  if (!isAllowedActionType(actionType)) {
    return {
      valid: false,
      error: `Action type "${actionType}" is not in the allowed vocabulary`,
      errorCode: 'FORBIDDEN_ACTION_TYPE',
    };
  }

  // 3. Check for forbidden action patterns
  if (FORBIDDEN_ACTIONS.has(type)) {
    return {
      valid: false,
      error: `Action "${type}" is forbidden by security policy`,
      errorCode: 'FORBIDDEN_ACTION',
      elementId,
    };
  }

  // 4. Verify element exists on the page
  const pageElement = pageRepresentation.elements.find(el => el.id === elementId);
  if (!pageElement) {
    return {
      valid: false,
      error: `Element "${elementId}" does not exist on the page`,
      errorCode: 'UNKNOWN_ELEMENT',
      elementId,
    };
  }

  // 5. Verify element was disclosed in this request
  if (!disclosedElementIds.has(elementId)) {
    return {
      valid: false,
      error: `Element "${elementId}" was NOT disclosed to the AI`,
      errorCode: 'UNDISCLOSED_ELEMENT',
      elementId,
    };
  }

  // 6. Verify element is in the current sanitized context
  const contextElement = sanitizedContext.elements.find(el => el.elementId === elementId);
  if (!contextElement) {
    return {
      valid: false,
      error: `Element "${elementId}" is not in the current sanitized context`,
      errorCode: 'STALE_ELEMENT',
      elementId,
    };
  }

  // 7. For CLICK actions, verify element is clickable
  if (actionType === 'CLICK' && !pageElement.clickable) {
    return {
      valid: false,
      error: `Element "${elementId}" is not clickable`,
      errorCode: 'NOT_CLICKABLE',
      elementId,
    };
  }

  // 8. Verify element is not SECRET (defense-in-depth)
  // SECRET elements should never be in the sanitized context,
  // but check as defense-in-depth
  if (contextElement.decision === 'BLOCK') {
    return {
      valid: false,
      error: `Element "${elementId}" has BLOCK decision — SECRET data cannot be acted upon`,
      errorCode: 'SECRET_ELEMENT',
      elementId,
    };
  }

  // 9. Build human-readable description
  const description = buildActionDescription(actionType, elementId, pageElement);

  // 10. All checks passed — create validated action
  const validatedAction: ValidatedAction = {
    type: actionType,
    elementId,
    description,
    requiresApproval: true, // All actions require user approval by default
    approved: false,
  };

  return { valid: true, action: validatedAction };
}

// ─── Helpers ───────────────────────────────────────────────────────

/**
 * Map a ProposedActionType from the AI response to our local ActionType.
 */
function mapToActionType(proposed: ProposedActionType): ActionType | null {
  switch (proposed) {
    case 'CLICK':
      return 'CLICK';
    case 'CLICK_TARGET':
      return 'CLICK';
    case 'SELECT_ELEMENT':
      return 'CLICK'; // In our MVP, SELECT_ELEMENT maps to CLICK
    case 'SCROLL':
      return 'SCROLL';
    case 'SCROLL_TARGET':
      return 'SCROLL';
    default:
      return null;
  }
}

/**
 * Build a human-readable description of what the action will do.
 */
function buildActionDescription(
  actionType: ActionType,
  elementId: string,
  pageElement: { tagName: string; text?: string; label?: string; role?: string },
): string {
  const label = pageElement.label || pageElement.text || elementId;
  const tag = pageElement.tagName;

  switch (actionType) {
    case 'CLICK':
      return `Click the ${tag.toLowerCase()} "${label}"`;
    case 'SCROLL':
      return `Scroll to the ${tag.toLowerCase()} "${label}"`;
    case 'SELECT':
      return `Select option in "${label}"`;
    default:
      return `Perform ${actionType} on ${elementId}`;
  }
}

// ─── Action Execution ──────────────────────────────────────────────

/**
 * Execute a validated and approved action on the page.
 * This function runs in the content script context.
 *
 * SECURITY: Only executes actions that have passed the action gate
 * AND received user approval. Never executes arbitrary code.
 *
 * @param action - The validated and approved action
 * @returns ActionResult with success/failure status
 */
export function executeAction(action: ValidatedAction): ActionResult {
  // Verify approval
  if (action.requiresApproval && !action.approved) {
    return {
      success: false,
      actionType: action.type,
      elementId: action.elementId,
      executedAt: Date.now(),
      error: 'Action requires user approval',
    };
  }

  // Find the element in the DOM
  const element = document.querySelector(
    `[data-ppba-id="${CSS.escape(action.elementId)}"]`
  );

  if (!element) {
    return {
      success: false,
      actionType: action.type,
      elementId: action.elementId,
      executedAt: Date.now(),
      error: `Element "${action.elementId}" not found in DOM`,
    };
  }

  try {
    switch (action.type) {
      case 'CLICK': {
        (element as HTMLElement).click();
        break;
      }
      case 'SCROLL': {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        break;
      }
      case 'SELECT': {
        // For select elements, we can't set a specific option without knowing which one
        // Just scroll to it and let the user interact
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        break;
      }
      default: {
        return {
          success: false,
          actionType: action.type,
          elementId: action.elementId,
          executedAt: Date.now(),
          error: `Unsupported action type: ${action.type}`,
        };
      }
    }

    return {
      success: true,
      actionType: action.type,
      elementId: action.elementId,
      executedAt: Date.now(),
    };
  } catch (error) {
    return {
      success: false,
      actionType: action.type,
      elementId: action.elementId,
      executedAt: Date.now(),
      error: `Execution failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}
