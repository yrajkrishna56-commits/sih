/**
 * POST /reason route handler.
 *
 * Server responsibilities (each a hard gate):
 * 1. Parse + schema-validate the request body
 * 2. Reject payloads over size cap (100KB)
 * 3. Pass validated request to AIProvider.generate()
 * 4. Schema-validate the provider's response before returning
 * 5. Return only validated structured JSON
 */

import { Router, Request, Response } from 'express';
import { taskReasoningRequestSchema } from '../schemas/request';
import { rawAIResponseSchema } from '../schemas/response';
import { getProvider } from '../providers';

const router = Router();

/** Maximum request body size in bytes (100KB) */
const MAX_REQUEST_SIZE_BYTES = 100 * 1024;

router.post('/reason', async (req: Request, res: Response) => {
  try {
    // 1. Size check (before parsing)
    const contentLength = parseInt(req.headers['content-length'] || '0', 10);
    if (contentLength > MAX_REQUEST_SIZE_BYTES) {
      res.status(413).json({
        error: `Payload too large: ${contentLength} bytes (max ${MAX_REQUEST_SIZE_BYTES})`,
      });
      return;
    }

    // 2. Schema-validate the request body
    const parseResult = taskReasoningRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      res.status(400).json({
        error: `Request validation failed: ${parseResult.error.message}`,
      });
      return;
    }

    const request = parseResult.data;

    // 3. Pass to AI provider
    const provider = getProvider('mock');
    const rawResponse = await provider.generate(request);

    // 4. Schema-validate the provider's response
    const responseParseResult = rawAIResponseSchema.safeParse(rawResponse);
    if (!responseParseResult.success) {
      // Server does not trust its own mock provider blindly
      console.error('[Server] Provider response validation failed:', responseParseResult.error.message);
      res.status(500).json({
        error: `Provider response validation failed: ${responseParseResult.error.message}`,
      });
      return;
    }

    // 5. Return validated response
    res.json(responseParseResult.data);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[Server] Error processing request:', message);
    res.status(500).json({ error: `Internal server error: ${message}` });
  }
});

export default router;
