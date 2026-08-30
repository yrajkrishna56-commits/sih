/**
 * Server-side zod schema for RawAIResponse.
 * Mirrors the client schema but is validated independently.
 */

import { z } from 'zod';

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

export type RawAIResponse = z.infer<typeof rawAIResponseSchema>;
