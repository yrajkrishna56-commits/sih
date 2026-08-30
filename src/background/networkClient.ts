/**
 * Network Client — single fetch boundary.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * SECURITY RULE: This is the ONLY file in the extension that may call fetch.
 * Content scripts and the side panel must not call fetch directly.
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Flow: Task tab → message → background networkClient → privacyFirewall →
 *       fetch → responseValidator → message back to Task tab
 */

import type { TaskReasoningRequest, RawAIResponse } from '../network/networkTypes';
import { buildNetworkRequest } from '../network/privacyFirewall';
import type { SanitizedContext, TaskAnalysisResult } from '../task/taskTypes';

/** Server URL — configurable for different environments */
const SERVER_URL = 'http://localhost:3001';

/** Request timeout in milliseconds */
const REQUEST_TIMEOUT_MS = 10000;

/**
 * Send a task reasoning request to the server.
 *
 * @param sanitizedContext - Phase 3 output (NOT PageRepresentation)
 * @param taskAnalysis - Phase 3 task analysis result
 * @returns The raw AI response (must be validated by responseValidator before use)
 * @throws {Error} If the request fails or server returns an error
 */
export async function sendTaskReasoningRequest(
  sanitizedContext: SanitizedContext,
  taskAnalysis: TaskAnalysisResult,
): Promise<{ request: TaskReasoningRequest; response: RawAIResponse }> {
  // Build request through the privacy firewall
  const request = buildNetworkRequest(sanitizedContext, taskAnalysis);

  // Send via fetch — this is the ONLY fetch call in the extension
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const httpResponse = await fetch(`${SERVER_URL}/reason`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    if (!httpResponse.ok) {
      const errorText = await httpResponse.text().catch(() => 'Unknown error');
      throw new Error(
        `Server returned HTTP ${httpResponse.status}: ${errorText}`
      );
    }

    const response: RawAIResponse = await httpResponse.json();
    return { request, response };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`Request timed out after ${REQUEST_TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
