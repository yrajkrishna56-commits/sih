/**
 * Privacy Firewall — the browser decides before anything leaves the device.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * THE ONE PROPERTY THIS ENTIRE MODULE EXISTS TO PROVE:
 *
 * The network request is constructed ONLY from SanitizedContext, and it
 * is structurally impossible — not just policy-forbidden — for
 * PageRepresentation, PrivacyAnalysis, or any raw DOM/input value to
 * reach the wire.
 *
 * "Structurally impossible" means: this function's TypeScript signature
 * does not accept a PageRepresentation or PrivacyAnalysis as an argument.
 * If it can't be passed in, it can't be serialized out.
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Defense in depth: even though SanitizedContext should already contain
 * only ALLOW/MINIMIZE/TRANSFORM entries per Phase 3's contract, this
 * module independently re-filters by decision before serializing.
 */

import type { SanitizedContext } from '../task/taskTypes';
import type { TaskAnalysisResult } from '../task/taskTypes';
import type { TaskReasoningRequest } from './networkTypes';
import { taskReasoningRequestSchema } from './networkTypes';

/** Maximum allowed context items per request */
const MAX_ALLOWED_CONTEXT = 200;

/** Maximum request body size in bytes (100KB) */
const MAX_REQUEST_SIZE_BYTES = 100 * 1024;

/**
 * Generate a UUID v4 for request identification.
 * Uses crypto.randomUUID when available, falls back to a simple implementation.
 */
function generateRequestId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for environments without crypto.randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Build a TaskReasoningRequest from SanitizedContext + TaskAnalysisResult.
 *
 * SECURITY INVARIANT:
 * - First parameter is SanitizedContext, NOT PageRepresentation or PrivacyAnalysis.
 * - TypeScript signature structurally prevents passing the wrong type.
 * - Independently re-filters by decision before serializing.
 * - Uses explicit field-by-field mapping, not spread operators.
 * - Strips any field not in the explicit allow-list.
 *
 * @throws {Error} If sanitizedContext is malformed or contains no allowed elements
 */
export function buildNetworkRequest(
  sanitizedContext: SanitizedContext,   // NOT PageRepresentation, NOT PrivacyAnalysis
  taskAnalysis: TaskAnalysisResult,
): TaskReasoningRequest {
  // Defense in depth: re-filter by decision before serializing
  // Do not assume the upstream caller already did this correctly
  const allowedElements = sanitizedContext.elements.filter(
    el => el.decision === 'ALLOW' || el.decision === 'MINIMIZE' || el.decision === 'TRANSFORM'
  );

  // Enforce size cap on context items
  if (allowedElements.length > MAX_ALLOWED_CONTEXT) {
    allowedElements.length = MAX_ALLOWED_CONTEXT;
  }

  // Build request with explicit field-by-field mapping (no spread operators)
  const request: TaskReasoningRequest = {
    requestId: generateRequestId(),
    task: sanitizedContext.task,
    intent: taskAnalysis.intent,
    entities: {
      origin: taskAnalysis.entities.origin,
      destination: taskAnalysis.entities.destination,
    },
    allowedContext: allowedElements.map(el => ({
      elementId: el.elementId,
      concept: el.concept,
      tagName: el.tagName,
      label: el.label,
      publicText: el.publicText,
      disclosureLevel: el.decision,
      boundingBox: el.boundingBox,
    })),
  };

  // Schema validation before sending
  const parseResult = taskReasoningRequestSchema.safeParse(request);
  if (!parseResult.success) {
    throw new Error(`Request validation failed: ${parseResult.error.message}`);
  }

  // Size check
  const serialized = JSON.stringify(request);
  if (serialized.length > MAX_REQUEST_SIZE_BYTES) {
    throw new Error(`Request too large: ${serialized.length} bytes (max ${MAX_REQUEST_SIZE_BYTES})`);
  }

  return request;
}

/**
 * Verify that a request payload contains no sensitive field names or values.
 * Used in tests to inspect actual serialized payloads.
 */
export function inspectPayload(request: TaskReasoningRequest): {
  fieldNames: string[];
  hasSensitiveFields: boolean;
  hasSensitiveValues: boolean;
} {
  const sensitiveFieldPatterns = [
    /password/i, /card.*number/i, /cvv/i, /passport/i,
    /email.*value/i, /phone.*value/i, /name.*value/i,
    /secret/i, /private/i,
  ];

  const sensitiveValuePatterns = [
    /rahul/i, /sharma/i, /4242/i, /x0000000/i,
    /@example\.com/i, /90000/i,
  ];

  const serialized = JSON.stringify(request);
  const fieldNames = Object.keys(request);

  const hasSensitiveFields = sensitiveFieldPatterns.some(p => p.test(serialized));
  const hasSensitiveValues = sensitiveValuePatterns.some(p => p.test(serialized));

  return { fieldNames, hasSensitiveFields, hasSensitiveValues };
}
