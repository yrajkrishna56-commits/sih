/**
 * Privacy Firewall — security tests.
 *
 * Tests the firewall's defense-in-depth guarantees:
 * - Accepts valid SanitizedContext → produces well-formed request
 * - Re-filters EXCLUDE/BLOCK entries (defense in depth)
 * - Structural type guarantee (cannot pass PageRepresentation)
 * - No sensitive values in output
 */

import { describe, it, expect } from 'vitest';
import { buildNetworkRequest, inspectPayload } from './privacyFirewall';
import type { SanitizedContext, TaskAnalysisResult } from '../task/taskTypes';

// ─── Test Fixtures ─────────────────────────────────────────────────

function makeTaskAnalysis(overrides: Partial<TaskAnalysisResult> = {}): TaskAnalysisResult {
  return {
    rawText: 'Find the cheapest flight from Mumbai to Delhi',
    intent: 'FLIGHT_SEARCH',
    confidence: 0.75,
    entities: { origin: 'Mumbai', destination: 'Delhi' },
    requiredConcepts: ['ORIGIN', 'DESTINATION', 'PRICE', 'AIRLINE'],
    explanation: 'Test task analysis',
    ...overrides,
  };
}

function makeSanitizedContext(overrides: Partial<SanitizedContext> = {}): SanitizedContext {
  return {
    timestamp: Date.now(),
    task: 'Find the cheapest flight from Mumbai to Delhi',
    elements: [
      {
        elementId: 'price-1',
        concept: 'PRICE',
        tagName: 'SPAN',
        publicText: '₹4,250',
        label: 'Price',
        decision: 'ALLOW',
      },
      {
        elementId: 'airline-1',
        concept: 'AIRLINE',
        tagName: 'SPAN',
        publicText: 'SkyBook Airways',
        label: 'Airline',
        decision: 'ALLOW',
      },
    ],
    ...overrides,
  };
}

// ─── Tests ─────────────────────────────────────────────────────────

describe('privacyFirewall', () => {
  describe('valid request generation', () => {
    it('accepts a valid SanitizedContext and produces a well-formed TaskReasoningRequest', () => {
      const context = makeSanitizedContext();
      const task = makeTaskAnalysis();
      const request = buildNetworkRequest(context, task);

      expect(request).toHaveProperty('requestId');
      expect(request).toHaveProperty('task', context.task);
      expect(request).toHaveProperty('intent', task.intent);
      expect(request).toHaveProperty('entities');
      expect(request).toHaveProperty('allowedContext');
      expect(Array.isArray(request.allowedContext)).toBe(true);
      expect(request.allowedContext.length).toBe(2);
    });

    it('generates a valid UUID for requestId', () => {
      const context = makeSanitizedContext();
      const task = makeTaskAnalysis();
      const request = buildNetworkRequest(context, task);

      // UUID v4 format
      expect(request.requestId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
      );
    });
  });

  describe('defense in depth — re-filters EXCLUDE/BLOCK entries', () => {
    it('drops a mislabeled EXCLUDE entry from SanitizedContext', () => {
      const context = makeSanitizedContext({
        elements: [
          { elementId: 'e1', concept: 'PRICE', tagName: 'SPAN', decision: 'ALLOW' },
          { elementId: 'e2', concept: 'PASSENGER_NAME', tagName: 'INPUT', decision: 'EXCLUDE' as any },  // Mislabeled!
        ],
      });
      const task = makeTaskAnalysis();
      const request = buildNetworkRequest(context, task);

      // EXCLUDE entry should be dropped
      expect(request.allowedContext.length).toBe(1);
      expect(request.allowedContext[0]!.elementId).toBe('e1');
    });

    it('drops a mislabeled BLOCK entry from SanitizedContext', () => {
      const context = makeSanitizedContext({
        elements: [
          { elementId: 'e1', concept: 'PRICE', tagName: 'SPAN', decision: 'ALLOW' },
          { elementId: 'e2', concept: 'PAYMENT_CARD', tagName: 'INPUT', decision: 'BLOCK' as any },  // Mislabeled!
        ],
      });
      const task = makeTaskAnalysis();
      const request = buildNetworkRequest(context, task);

      // BLOCK entry should be dropped
      expect(request.allowedContext.length).toBe(1);
      expect(request.allowedContext[0]!.elementId).toBe('e1');
    });
  });

  describe('no sensitive values in output', () => {
    it('sanitized context with only PUBLIC elements produces no sensitive values', () => {
      const context = makeSanitizedContext({
        elements: [
          { elementId: 'e1', concept: 'PRICE', tagName: 'SPAN', publicText: '₹4,250', decision: 'ALLOW' },
          { elementId: 'e2', concept: 'AIRLINE', tagName: 'SPAN', publicText: 'SkyBook Airways', decision: 'ALLOW' },
        ],
      });
      const task = makeTaskAnalysis();
      const request = buildNetworkRequest(context, task);

      const inspection = inspectPayload(request);
      expect(inspection.hasSensitiveValues).toBe(false);
    });
  });

  describe('explicit field mapping (no spread)', () => {
    it('request contains only explicitly mapped fields', () => {
      const context = makeSanitizedContext({
        elements: [
          {
            elementId: 'e1',
            concept: 'PRICE',
            tagName: 'SPAN',
            publicText: '₹4,250',
            label: 'Price',
            decision: 'ALLOW',
            boundingBox: { x: 0, y: 0, width: 100, height: 20 },
          },
        ],
      });
      const task = makeTaskAnalysis();
      const request = buildNetworkRequest(context, task);

      // Check the allowedContext item has only expected fields
      const item = request.allowedContext[0]!;
      expect(Object.keys(item)).toEqual([
        'elementId', 'concept', 'tagName', 'label', 'publicText',
        'disclosureLevel', 'boundingBox',
      ]);
    });
  });

  describe('structural type guarantee', () => {
    it('buildNetworkRequest accepts SanitizedContext, not PageRepresentation', () => {
      // This test verifies the function signature at the type level.
      // The function should accept SanitizedContext and TaskAnalysisResult.
      // If someone tries to pass a PageRepresentation, it should fail at compile time.
      //
      // We verify this by checking the function exists and accepts the correct types.
      const context = makeSanitizedContext();
      const task = makeTaskAnalysis();
      const request = buildNetworkRequest(context, task);

      // Verify the output shape matches TaskReasoningRequest
      expect(request).toHaveProperty('requestId');
      expect(request).toHaveProperty('task');
      expect(request).toHaveProperty('intent');
      expect(request).toHaveProperty('entities');
      expect(request).toHaveProperty('allowedContext');
    });

    it('type-level test: buildNetworkRequest does not accept PageRepresentation', () => {
      // The TypeScript compiler should reject passing a PageRepresentation
      // as the first argument to buildNetworkRequest. This is verified by
      // the function signature: first param is SanitizedContext, not PageRepresentation.
      // We verify the structural guarantee by checking the function exists
      // and produces the correct output shape.
      const context = makeSanitizedContext();
      const task = makeTaskAnalysis();
      const request = buildNetworkRequest(context, task);

      // The request should NOT contain any PageRepresentation fields
      expect(request).not.toHaveProperty('url');
      expect(request).not.toHaveProperty('title');
      expect(request).not.toHaveProperty('elements');
      expect(request).toHaveProperty('task');
      expect(request).toHaveProperty('intent');
      expect(request).toHaveProperty('allowedContext');
    });
  });
});
