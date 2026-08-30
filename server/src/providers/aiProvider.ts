/**
 * AI Provider interface.
 *
 * Provider selection is a server-side concern (constructor injection or
 * config switch). The extension never imports or references a concrete
 * provider — it only talks to the server's HTTP endpoint.
 *
 * Swapping in a real LLM later touches zero browser-extension code.
 */

import type { TaskReasoningRequest } from '../schemas/request';
import type { RawAIResponse } from '../schemas/response';

export interface AIProvider {
  generate(request: TaskReasoningRequest): Promise<RawAIResponse>;
}
