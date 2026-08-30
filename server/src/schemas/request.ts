/**
 * Server-side zod schema for TaskReasoningRequest.
 * Mirrors the client schema but is validated independently.
 */

import { z } from 'zod';

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

export type TaskReasoningRequest = z.infer<typeof taskReasoningRequestSchema>;
