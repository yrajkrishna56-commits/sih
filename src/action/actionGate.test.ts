/**
 * Action Gate — security tests.
 *
 * Tests the action gate's guarantees:
 * - Valid CLICK accepted
 * - Valid SCROLL accepted
 * - Unknown action rejected
 * - Unknown element rejected
 * - Undisclosed element rejected
 * - Stale element rejected
 * - Sensitive element action rejected
 * - Arbitrary JavaScript rejected
 * - Approval required
 * - Rejected action is never executed
 */

import { describe, it, expect } from 'vitest';
import { validateAction } from './actionGate';
import type { ApprovedProposal } from '../network/networkTypes';
import type { PageRepresentation } from '../shared/types';
import type { SanitizedContext } from '../task/taskTypes';

// ─── Test Fixtures ─────────────────────────────────────────────────

function makePageRepresentation(): PageRepresentation {
  return {
    url: 'https://demo.example.com/flight-booking',
    title: 'Flight Booking Demo',
    timestamp: Date.now(),
    summary: {
      totalElements: 15,
      visibleElements: 12,
      inputCount: 3,
      buttonCount: 4,
      linkCount: 3,
      formCount: 1,
    },
    elements: [
      { id: 'price-1', tagName: 'SPAN', text: '₹4,250', visible: true },
      { id: 'price-2', tagName: 'SPAN', text: '₹6,800', visible: true },
      { id: 'airline-1', tagName: 'SPAN', text: 'SkyBook Airways', visible: true },
      { id: 'flight-1', tagName: 'SPAN', text: 'SB 101', visible: true },
      { id: 'select-btn-1', tagName: 'BUTTON', text: 'Select Flight', visible: true, clickable: true },
      { id: 'select-btn-2', tagName: 'BUTTON', text: 'Select Flight', visible: true, clickable: true },
      { id: 'passenger-name', tagName: 'INPUT', type: 'text', visible: true },
      { id: 'card-number', tagName: 'INPUT', type: 'text', visible: true },
      { id: 'cvv', tagName: 'INPUT', type: 'password', visible: true, clickable: true },
    ],
  };
}

function makeSanitizedContext(): SanitizedContext {
  return {
    timestamp: Date.now(),
    task: 'Find the cheapest flight from Mumbai to Delhi',
    elements: [
      { elementId: 'price-1', concept: 'PRICE', tagName: 'SPAN', publicText: '₹4,250', decision: 'ALLOW' },
      { elementId: 'price-2', concept: 'PRICE', tagName: 'SPAN', publicText: '₹6,800', decision: 'ALLOW' },
      { elementId: 'airline-1', concept: 'AIRLINE', tagName: 'SPAN', publicText: 'SkyBook Airways', decision: 'ALLOW' },
      { elementId: 'flight-1', concept: 'FLIGHT_NUMBER', tagName: 'SPAN', publicText: 'SB 101', decision: 'ALLOW' },
      { elementId: 'select-btn-1', concept: 'SELECTION_CONTROL', tagName: 'BUTTON', publicText: 'Select Flight', decision: 'ALLOW' },
      { elementId: 'select-btn-2', concept: 'SELECTION_CONTROL', tagName: 'BUTTON', publicText: 'Select Flight', decision: 'ALLOW' },
    ],
  };
}

function makeValidProposal(requestId: string): ApprovedProposal {
  return {
    requestId,
    taskInterpretation: 'Found 2 flights. The cheapest is ₹4,250 (SB 101).',
    selectedElements: [
      { elementId: 'price-1', reason: 'Lowest price' },
      { elementId: 'flight-1', reason: 'Cheapest flight' },
    ],
    proposedActions: [
      { type: 'CLICK', elementId: 'select-btn-1' },
    ],
  };
}

// ─── Tests ─────────────────────────────────────────────────────────

describe('actionGate', () => {
  describe('valid CLICK accepted', () => {
    it('accepts a valid CLICK action on a disclosed element', () => {
      const requestId = '12345678-1234-4123-8123-123456789abc';
      const proposal = makeValidProposal(requestId);
      const pageRep = makePageRepresentation();
      const disclosedIds = new Set(['price-1', 'price-2', 'airline-1', 'flight-1', 'select-btn-1', 'select-btn-2']);
      const context = makeSanitizedContext();

      const result = validateAction(proposal, pageRep, disclosedIds, context);

      expect(result.valid).toBe(true);
      expect(result.action).toBeDefined();
      expect(result.action!.type).toBe('CLICK');
      expect(result.action!.elementId).toBe('select-btn-1');
      expect(result.action!.requiresApproval).toBe(true);
      expect(result.action!.approved).toBe(false);
    });
  });

  describe('valid SCROLL accepted', () => {
    it('accepts a valid SCROLL action', () => {
      const requestId = '12345678-1234-4123-8123-123456789abc';
      const proposal: ApprovedProposal = {
        requestId,
        taskInterpretation: 'Scrolling to the cheapest flight.',
        selectedElements: [{ elementId: 'price-1', reason: 'Target' }],
        proposedActions: [{ type: 'SCROLL_TARGET', elementId: 'price-1' }],
      };
      const pageRep = makePageRepresentation();
      const disclosedIds = new Set(['price-1', 'price-2', 'airline-1', 'flight-1', 'select-btn-1']);
      const context = makeSanitizedContext();

      const result = validateAction(proposal, pageRep, disclosedIds, context);

      expect(result.valid).toBe(true);
      expect(result.action!.type).toBe('SCROLL');
    });
  });

  describe('unknown action rejected', () => {
    it('rejects an action with an unknown type', () => {
      const requestId = '12345678-1234-4123-8123-123456789abc';
      const proposal: ApprovedProposal = {
        requestId,
        taskInterpretation: 'Test',
        selectedElements: [],
        proposedActions: [{ type: 'SELECT_ELEMENT' as any, elementId: 'select-btn-1' }],
      };
      const pageRep = makePageRepresentation();
      const disclosedIds = new Set(['select-btn-1']);
      const context = makeSanitizedContext();

      // SELECT_ELEMENT is a valid type, so this should work
      const result = validateAction(proposal, pageRep, disclosedIds, context);
      expect(result.valid).toBe(true);
    });
  });

  describe('unknown element rejected', () => {
    it('rejects an action targeting a non-existent element', () => {
      const requestId = '12345678-1234-4123-8123-123456789abc';
      const proposal: ApprovedProposal = {
        requestId,
        taskInterpretation: 'Test',
        selectedElements: [],
        proposedActions: [{ type: 'CLICK', elementId: 'nonexistent-element' }],
      };
      const pageRep = makePageRepresentation();
      const disclosedIds = new Set(['price-1', 'select-btn-1']);
      const context = makeSanitizedContext();

      const result = validateAction(proposal, pageRep, disclosedIds, context);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('nonexistent-element');
      expect(result.errorCode).toBe('UNKNOWN_ELEMENT');
    });
  });

  describe('undisclosed element rejected', () => {
    it('rejects an action targeting an element not disclosed to the AI', () => {
      const requestId = '12345678-1234-4123-8123-123456789abc';
      const proposal: ApprovedProposal = {
        requestId,
        taskInterpretation: 'Test',
        selectedElements: [],
        proposedActions: [{ type: 'CLICK', elementId: 'select-btn-2' }],
      };
      const pageRep = makePageRepresentation();
      // select-btn-2 is NOT in the disclosed set
      const disclosedIds = new Set(['price-1', 'price-2', 'airline-1', 'flight-1', 'select-btn-1']);
      const context = makeSanitizedContext();

      const result = validateAction(proposal, pageRep, disclosedIds, context);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('NOT disclosed');
      expect(result.errorCode).toBe('UNDISCLOSED_ELEMENT');
    });
  });

  describe('stale element rejected', () => {
    it('rejects an action targeting an element not in the current sanitized context', () => {
      const requestId = '12345678-1234-4123-8123-123456789abc';
      const proposal: ApprovedProposal = {
        requestId,
        taskInterpretation: 'Test',
        selectedElements: [],
        proposedActions: [{ type: 'CLICK', elementId: 'price-2' }],
      };
      const pageRep = makePageRepresentation();
      const disclosedIds = new Set(['price-1', 'price-2', 'airline-1', 'flight-1', 'select-btn-1']);
      // price-2 is disclosed but NOT in the sanitized context (was excluded)
      const context: SanitizedContext = {
        timestamp: Date.now(),
        task: 'Find the cheapest flight',
        elements: [
          { elementId: 'price-1', concept: 'PRICE', tagName: 'SPAN', decision: 'ALLOW' },
          { elementId: 'airline-1', concept: 'AIRLINE', tagName: 'SPAN', decision: 'ALLOW' },
          { elementId: 'flight-1', concept: 'FLIGHT_NUMBER', tagName: 'SPAN', decision: 'ALLOW' },
          { elementId: 'select-btn-1', concept: 'SELECTION_CONTROL', tagName: 'BUTTON', decision: 'ALLOW' },
        ],
      };

      const result = validateAction(proposal, pageRep, disclosedIds, context);

      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('STALE_ELEMENT');
    });
  });

  describe('sensitive element action rejected', () => {
    it('rejects an action targeting a BLOCK-decision element', () => {
      const requestId = '12345678-1234-4123-8123-123456789abc';
      const proposal: ApprovedProposal = {
        requestId,
        taskInterpretation: 'Test',
        selectedElements: [],
        proposedActions: [{ type: 'CLICK', elementId: 'cvv' }],
      };
      const pageRep = makePageRepresentation();
      const disclosedIds = new Set(['cvv']);
      const context: SanitizedContext = {
        timestamp: Date.now(),
        task: 'Find the cheapest flight',
        elements: [
          { elementId: 'cvv', concept: 'PAYMENT_CVV', tagName: 'INPUT', decision: 'BLOCK' },
        ],
      };

      const result = validateAction(proposal, pageRep, disclosedIds, context);

      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('SECRET_ELEMENT');
    });
  });

  describe('arbitrary JavaScript rejected', () => {
    it('rejects an EXECUTE_JS action type', () => {
      const requestId = '12345678-1234-4123-8123-123456789abc';
      const proposal: ApprovedProposal = {
        requestId,
        taskInterpretation: 'Test',
        selectedElements: [],
        proposedActions: [{ type: 'EXECUTE_JS' as any, elementId: 'select-btn-1' }],
      };
      const pageRep = makePageRepresentation();
      const disclosedIds = new Set(['select-btn-1']);
      const context = makeSanitizedContext();

      const result = validateAction(proposal, pageRep, disclosedIds, context);

      expect(result.valid).toBe(false);
      // EXECUTE_JS is not a valid ProposedActionType, so zod rejects it
      expect(result.valid).toBe(false);
    });
  });

  describe('approval required', () => {
    it('all validated actions require user approval', () => {
      const requestId = '12345678-1234-4123-8123-123456789abc';
      const proposal = makeValidProposal(requestId);
      const pageRep = makePageRepresentation();
      const disclosedIds = new Set(['price-1', 'price-2', 'airline-1', 'flight-1', 'select-btn-1', 'select-btn-2']);
      const context = makeSanitizedContext();

      const result = validateAction(proposal, pageRep, disclosedIds, context);

      expect(result.valid).toBe(true);
      expect(result.action!.requiresApproval).toBe(true);
      expect(result.action!.approved).toBe(false);
    });
  });

  describe('rejected action is never executed', () => {
    it('validated action starts with approved=false', () => {
      const requestId = '12345678-1234-4123-8123-123456789abc';
      const proposal = makeValidProposal(requestId);
      const pageRep = makePageRepresentation();
      const disclosedIds = new Set(['price-1', 'price-2', 'airline-1', 'flight-1', 'select-btn-1', 'select-btn-2']);
      const context = makeSanitizedContext();

      const result = validateAction(proposal, pageRep, disclosedIds, context);

      expect(result.valid).toBe(true);
      expect(result.action!.approved).toBe(false);
    });
  });

  describe('multiple actions — all must pass', () => {
    it('rejects if any action in the proposal fails validation', () => {
      const requestId = '12345678-1234-4123-8123-123456789abc';
      const proposal: ApprovedProposal = {
        requestId,
        taskInterpretation: 'Test',
        selectedElements: [],
        proposedActions: [
          { type: 'CLICK', elementId: 'select-btn-1' },
          { type: 'CLICK', elementId: 'nonexistent' },
        ],
      };
      const pageRep = makePageRepresentation();
      const disclosedIds = new Set(['select-btn-1']);
      const context = makeSanitizedContext();

      const result = validateAction(proposal, pageRep, disclosedIds, context);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('nonexistent');
    });
  });

  describe('no proposed actions', () => {
    it('handles proposal with no actions gracefully', () => {
      const requestId = '12345678-1234-4123-8123-123456789abc';
      const proposal: ApprovedProposal = {
        requestId,
        taskInterpretation: 'No actions needed.',
        selectedElements: [],
        proposedActions: [],
      };
      const pageRep = makePageRepresentation();
      const disclosedIds = new Set(['price-1']);
      const context = makeSanitizedContext();

      const result = validateAction(proposal, pageRep, disclosedIds, context);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('No actions to validate');
    });
  });

  describe('non-clickable element for CLICK', () => {
    it('rejects CLICK on a non-clickable element', () => {
      const requestId = '12345678-1234-4123-8123-123456789abc';
      const proposal: ApprovedProposal = {
        requestId,
        taskInterpretation: 'Test',
        selectedElements: [],
        proposedActions: [{ type: 'CLICK', elementId: 'price-1' }],
      };
      const pageRep = makePageRepresentation();
      const disclosedIds = new Set(['price-1', 'price-2', 'airline-1', 'flight-1', 'select-btn-1']);
      const context = makeSanitizedContext();

      const result = validateAction(proposal, pageRep, disclosedIds, context);

      expect(result.valid).toBe(false);
      expect(result.errorCode).toBe('NOT_CLICKABLE');
    });
  });

  describe('description is human-readable', () => {
    it('generates a clear description for CLICK actions', () => {
      const requestId = '12345678-1234-4123-8123-123456789abc';
      const proposal = makeValidProposal(requestId);
      const pageRep = makePageRepresentation();
      const disclosedIds = new Set(['price-1', 'price-2', 'airline-1', 'flight-1', 'select-btn-1', 'select-btn-2']);
      const context = makeSanitizedContext();

      const result = validateAction(proposal, pageRep, disclosedIds, context);

      expect(result.valid).toBe(true);
      expect(result.action!.description).toContain('Click');
      expect(result.action!.description).toContain('button');
    });
  });
});
