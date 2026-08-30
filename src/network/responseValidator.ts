/**
 * Response Validator — the browser doesn't trust the server either.
 *
 * Before any proposed action is displayed:
 * 1. Schema-validate the response shape (zod).
 * 2. Verify requestId matches the awaiting request.
 * 3. For every elementId referenced: verify it exists in PageRepresentation
 *    AND was part of the disclosed set for that requestId.
 * 4. Reject unknown proposedActions[].type.
 * 5. Reject the whole response if any check fails.
 *
 * Output: ApprovedProposal — only validator-passed data becomes an
 * ApprovedProposal, and only ApprovedProposal is ever rendered.
 */

import type { RawAIResponse, ApprovedProposal } from './networkTypes';
import { rawAIResponseSchema } from './networkTypes';
import type { PageRepresentation } from '../shared/types';

/**
 * Validate a raw AI response against:
 * - Schema shape (zod)
 * - RequestId match
 * - ElementId existence in PageRepresentation
 * - ElementId was disclosed in the request
 * - Unknown action types
 *
 * @param rawResponse - The raw response from the server
 * @param requestId - The requestId of the request awaiting reply
 * @param disclosedElementIds - The set of elementIds sent in the request
 * @param pageRepresentation - The current page's element list (for existence check)
 * @returns ApprovedProposal if all checks pass
 * @throws {Error} with descriptive message if any check fails
 */
export function validateResponse(
  rawResponse: unknown,
  requestId: string,
  disclosedElementIds: Set<string>,
  pageRepresentation: PageRepresentation,
): ApprovedProposal {
  // 1. Schema validation (zod)
  const parseResult = rawAIResponseSchema.safeParse(rawResponse);
  if (!parseResult.success) {
    throw new Error(`Response schema validation failed: ${parseResult.error.message}`);
  }

  const response = parseResult.data;

  // 2. Verify requestId matches
  if (response.requestId !== requestId) {
    throw new Error(
      `RequestId mismatch: expected "${requestId}", got "${response.requestId}". ` +
      `This may be a stale or misrouted response.`
    );
  }

  // 3. Build page element lookup for existence check
  const pageElementIds = new Set(pageRepresentation.elements.map(el => el.id));

  // 4. Verify all referenced elementIds
  const allReferencedIds = new Set<string>();
  for (const sel of response.selectedElements) {
    allReferencedIds.add(sel.elementId);
  }
  for (const action of response.proposedActions) {
    allReferencedIds.add(action.elementId);
  }

  for (const elementId of allReferencedIds) {
    // Check: element exists on the page
    if (!pageElementIds.has(elementId)) {
      throw new Error(
        `Response references unknown elementId "${elementId}" that does not exist on the page.`
      );
    }

    // Check: element was disclosed in this request
    if (!disclosedElementIds.has(elementId)) {
      throw new Error(
        `Response references elementId "${elementId}" that was NOT part of the disclosed set ` +
        `for request "${requestId}". This is an attempt to reference an undisclosed element.`
      );
    }
  }

  // 5. Check proposedActions[].type is valid (zod enum handles this, but add explicit check)
  for (const action of response.proposedActions) {
    const validTypes = ['SELECT_ELEMENT', 'CLICK_TARGET', 'SCROLL_TARGET', 'CLICK', 'SCROLL'];
    if (!validTypes.includes(action.type)) {
      throw new Error(
        `Unknown proposedActions type "${action.type}". Valid types: ${validTypes.join(', ')}.`
      );
    }
  }

  // All checks passed — return ApprovedProposal
  const approved: ApprovedProposal = {
    requestId: response.requestId,
    taskInterpretation: response.taskInterpretation,
    selectedElements: response.selectedElements,
    proposedActions: response.proposedActions,
  };

  return approved;
}
