/**
 * Phase 4 — Network request/response types.
 *
 * These types define the ONLY data that may cross the network boundary.
 * The privacy firewall builds TaskReasoningRequest from SanitizedContext —
 * it structurally cannot accept PageRepresentation or PrivacyAnalysis.
 *
 * SECURITY INVARIANT: These types are the complete and exhaustive list
 * of fields that may leave the browser. No field in SanitizedElement
 * or SanitizedContext automatically inherits into TaskReasoningRequest.
 * Each field is mapped explicitly by the privacy firewall.
 */

import { z } from 'zod';
import type { TaskIntent, DomainConcept, DisclosureDecision } from '../task/taskTypes';

// ─── TaskReasoningRequest ──────────────────────────────────────────

/**
 * The request sent to the server. Built ONLY from SanitizedContext + TaskAnalysisResult.
 * The firewall's function signature structurally prevents PageRepresentation/PrivacyAnalysis.
 */
export interface TaskReasoningRequest {
  requestId: string;
  task: string;
  intent: TaskIntent;
  entities: { origin?: string; destination?: string };
  allowedContext: Array<{
    elementId: string;
    concept: DomainConcept;
    tagName: string;
    label?: string;
    publicText?: string;
    disclosureLevel: DisclosureDecision;
    boundingBox?: { x: number; y: number; width: number; height: number };
  }>;
}

// ─── ProposedActionType ────────────────────────────────────────────

export type ProposedActionType = 'SELECT_ELEMENT' | 'CLICK_TARGET' | 'SCROLL_TARGET' | 'CLICK' | 'SCROLL';

// ─── RawAIResponse ─────────────────────────────────────────────────

/**
 * Raw response from the AI provider. Must be schema-validated
 * before becoming an ApprovedProposal.
 */
export interface RawAIResponse {
  requestId: string;
  success: boolean;
  taskInterpretation: string;
  selectedElements: Array<{ elementId: string; reason: string }>;
  proposedActions: Array<{ type: ProposedActionType; elementId: string }>;
}

// ─── ApprovedProposal ──────────────────────────────────────────────

/**
 * Only validator-passed data becomes an ApprovedProposal.
 * Only ApprovedProposal is ever rendered in the UI.
 * This naming split (raw vs. approved) makes it structurally clear
 * which data has been checked.
 */
export interface ApprovedProposal {
  requestId: string;
  taskInterpretation: string;
  selectedElements: Array<{ elementId: string; reason: string }>;
  proposedActions: Array<{ type: ProposedActionType; elementId: string }>;
}

// ─── Zod Schemas ───────────────────────────────────────────────────

export const allowedContextItemSchema = z.object({
  elementId: z.string(),
  concept: z.string(),
  tagName: z.string(),
  label: z.string().optional(),
  publicText: z.string().optional(),
  disclosureLevel: z.enum(['ALLOW', 'MINIMIZE', 'TRANSFORM']),
  boundingBox: z.object({
    x: z.number(),
    y: z.number(),
    width: z.number(),
    height: z.number(),
  }).optional(),
});

export const taskReasoningRequestSchema = z.object({
  requestId: z.string().uuid(),
  task: z.string().min(1).max(1000),
  intent: z.string(),
  entities: z.object({
    origin: z.string().optional(),
    destination: z.string().optional(),
  }),
  allowedContext: z.array(allowedContextItemSchema).max(200),
}).strict();

export const proposedActionTypeSchema = z.enum(['SELECT_ELEMENT', 'CLICK_TARGET', 'SCROLL_TARGET', 'CLICK', 'SCROLL']);

export const rawAIResponseSchema = z.object({
  requestId: z.string().uuid(),
  success: z.boolean(),
  taskInterpretation: z.string(),
  selectedElements: z.array(z.object({
    elementId: z.string(),
    reason: z.string(),
  })),
  proposedActions: z.array(z.object({
    type: proposedActionTypeSchema,
    elementId: z.string(),
  })),
}).strict();

// ─── Network State ─────────────────────────────────────────────────

/**
 * Tracks outstanding requests for response validation.
 * Maps requestId → set of elementIds that were disclosed in that request.
 */
export interface NetworkState {
  pendingRequests: Map<string, Set<string>>;
}
