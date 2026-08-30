/**
 * Response Validator — security tests.
 *
 * Tests the validator's guarantees:
 * - Accepts valid response → produces ApprovedProposal
 * - Rejects requestId mismatch
 * - Rejects unknown elementId
 * - Rejects undisclosed elementId
 * - Rejects unknown proposedActions[].type
 * - Rejects malformed response
 */

import { describe, it, expect } from 'vitest';
import { validateResponse } from './responseValidator';
import type { PageRepresentation } from '../shared/types';

// ─── Test Fixtures ─────────────────────────────────────────────────

function makePageRepresentation(): PageRepresentation {
  return {
    url: 'https://demo.example.com',
    title: 'Flight Booking Demo',
    timestamp: Date.now(),
    summary: {
      totalElements: 10,
      visibleElements: 8,
      inputCount: 3,
      buttonCount: 2,
      linkCount: 3,
      formCount: 1,
    },
    elements: [
      { id: 'price-1', tagName: 'SPAN', text: '₹4,250', visible: true },
      { id: 'price-2', tagName: 'SPAN', text: '₹6,800', visible: true },
      { id: 'airline-1', tagName: 'SPAN', text: 'SkyBook', visible: true },
      { id: 'flight-1', tagName: 'SPAN', text: 'SB 101', visible: true },
      { id: 'select-btn-1', tagName: 'BUTTON', text: 'Select Flight', visible: true, clickable: true },
    ],
  };
}

function makeValidResponse(requestId: string) {
  return {
    requestId,
    success: true,
    taskInterpretation: 'Found 2 flight options. The cheapest is ₹4,250 (SB 101).',
    selectedElements: [
      { elementId: 'price-1', reason: 'Lowest price found' },
      { elementId: 'flight-1', reason: 'Cheapest flight number' },
    ],
    proposedActions: [
      { type: 'SELECT_ELEMENT' as const, elementId: 'select-btn-1' },
    ],
  };
}

// ─── Tests ─────────────────────────────────────────────────

describe('responseValidator', () => {
  describe('valid response', () => {
    it('accepts a valid response and produces an ApprovedProposal', () => {
      const requestId = '12345678-1234-4123-8123-123456789abc';
      const response = makeValidResponse(requestId);
      const disclosedIds = new Set(['price-1', 'price-2', 'airline-1', 'flight-1', 'select-btn-1']);
      const pageRep = makePageRepresentation();

      const approved = validateResponse(response, requestId, disclosedIds, pageRep);

      expect(approved.requestId).toBe(requestId);
      expect(approved.taskInterpretation).toContain('cheapest');
      expect(approved.selectedElements.length).toBe(2);
      expect(approved.proposedActions.length).toBe(1);
    });
  });

  describe('requestId mismatch', () => {
    it('rejects a response with wrong requestId', () => {
      const correctRequestId = '12345678-1234-4123-8123-123456789abc';
      const wrongRequestId = '87654321-4321-4321-8321-cba987654321';
      const response = makeValidResponse(wrongRequestId);
      const disclosedIds = new Set(['price-1', 'price-2', 'airline-1', 'flight-1', 'select-btn-1']);
      const pageRep = makePageRepresentation();

      expect(() => {
        validateResponse(response, correctRequestId, disclosedIds, pageRep);
      }).toThrow('RequestId mismatch');
    });
  });

  describe('unknown elementId', () => {
    it('rejects a response referencing an elementId not on the page', () => {
      const requestId = '12345678-1234-4123-8123-123456789abc';
      const response = {
        ...makeValidResponse(requestId),
        selectedElements: [
          { elementId: 'nonexistent-element', reason: 'Does not exist' },
        ],
      };
      const disclosedIds = new Set(['price-1', 'price-2', 'airline-1', 'flight-1', 'select-btn-1']);
      const pageRep = makePageRepresentation();

      expect(() => {
        validateResponse(response, requestId, disclosedIds, pageRep);
      }).toThrow('unknown elementId');
    });
  });

  describe('undisclosed elementId', () => {
    it('rejects a response referencing an elementId that exists but was not disclosed', () => {
      const requestId = '12345678-1234-4123-8123-123456789abc';
      const response = {
        ...makeValidResponse(requestId),
        selectedElements: [
          { elementId: 'price-2', reason: 'Second price' },  // price-2 exists but was NOT disclosed
        ],
      };
      // Only price-1, airline-1, flight-1, select-btn-1 were disclosed
      const disclosedIds = new Set(['price-1', 'airline-1', 'flight-1', 'select-btn-1']);
      const pageRep = makePageRepresentation();

      expect(() => {
        validateResponse(response, requestId, disclosedIds, pageRep);
      }).toThrow('NOT part of the disclosed set');
    });
  });

  describe('unknown proposedActions[].type', () => {
    it('rejects a response with unknown action type', () => {
      const requestId = '12345678-1234-4123-8123-123456789abc';
      const response = {
        ...makeValidResponse(requestId),
        proposedActions: [
          { type: 'EVIL_ACTION' as any, elementId: 'select-btn-1' },
        ],
      };
      const disclosedIds = new Set(['price-1', 'price-2', 'airline-1', 'flight-1', 'select-btn-1']);
      const pageRep = makePageRepresentation();

      // Zod catches the invalid type at schema validation (before our explicit check)
      expect(() => {
        validateResponse(response, requestId, disclosedIds, pageRep);
      }).toThrow('schema validation failed');
    });
  });

  describe('malformed response', () => {
    it('rejects a response missing required fields', () => {
      const requestId = '12345678-1234-4123-8123-123456789abc';
      const response = { requestId, success: true }; // Missing required fields
      const disclosedIds = new Set(['price-1']);
      const pageRep = makePageRepresentation();

      expect(() => {
        validateResponse(response, requestId, disclosedIds, pageRep);
      }).toThrow('schema validation failed');
    });

    it('rejects a response with unexpected extra fields', () => {
      const requestId = '12345678-1234-4123-8123-123456789abc';
      const response = {
        ...makeValidResponse(requestId),
        unexpectedField: 'should not be here',
      };
      const disclosedIds = new Set(['price-1', 'price-2', 'airline-1', 'flight-1', 'select-btn-1']);
      const pageRep = makePageRepresentation();

      expect(() => {
        validateResponse(response, requestId, disclosedIds, pageRep);
      }).toThrow('schema validation failed');
    });
  });

  describe('whole-response rejection', () => {
    it('rejects the entire response if any elementId is invalid', () => {
      const requestId = '12345678-1234-4123-8123-123456789abc';
      const response = {
        ...makeValidResponse(requestId),
        selectedElements: [
          { elementId: 'price-1', reason: 'Valid' },
          { elementId: 'nonexistent', reason: 'Invalid' },
        ],
      };
      const disclosedIds = new Set(['price-1', 'price-2', 'airline-1', 'flight-1', 'select-btn-1']);
      const pageRep = makePageRepresentation();

      // Should reject the WHOLE response, not just the invalid element
      expect(() => {
        validateResponse(response, requestId, disclosedIds, pageRep);
      }).toThrow('unknown elementId');
    });
  });
});
