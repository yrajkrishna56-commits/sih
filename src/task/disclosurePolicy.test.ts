/**
 * Disclosure Policy Engine — unit tests.
 *
 * Tests the disclosure policy engine independently with fixed
 * TaskAnalysisResult + fixed tagged/classified test elements.
 *
 * Critical tests:
 * - SECRET always blocked even under FORM_COMPLETION_PREVIEW
 * - UNKNOWN task → everything except PUBLIC static → EXCLUDE
 * - No raw input value ever appears in SanitizedContext
 */

import { describe, it, expect } from 'vitest';
import { evaluateDisclosure, evaluateDisclosurePlan, buildTaggedElement } from './disclosurePolicy';
import { buildSanitizedContext } from './sanitizedContextBuilder';
import type { TaskAnalysisResult, DisclosureRuling } from './taskTypes';
import type { TaggedElement } from './disclosurePolicy';
import type { SensitivityLevel } from '../privacy/privacyTypes';

// ─── Test Fixtures ─────────────────────────────────────────────────

function makeTaskAnalysis(overrides: Partial<TaskAnalysisResult> = {}): TaskAnalysisResult {
  return {
    rawText: 'Find flights from Mumbai to Delhi',
    intent: 'FLIGHT_SEARCH',
    confidence: 0.75,
    entities: { origin: 'Mumbai', destination: 'Delhi' },
    requiredConcepts: ['ORIGIN', 'DESTINATION', 'PRICE', 'AIRLINE', 'FLIGHT_NUMBER', 'DEPARTURE_TIME', 'ARRIVAL_TIME', 'DURATION', 'SEARCH_CONTROL', 'SELECTION_CONTROL'],
    explanation: 'Test task analysis',
    ...overrides,
  };
}

function makeTaggedElement(overrides: Partial<TaggedElement> = {}): TaggedElement {
  return {
    elementId: 'test-element-1',
    concept: 'PRICE',
    sensitivity: 'PUBLIC',
    piiType: 'NONE',
    tagName: 'SPAN',
    text: '₹4,250',
    label: 'Price',
    ...overrides,
  };
}

// ─── Tests ─────────────────────────────────────────────────────────

describe('disclosurePolicy', () => {
  describe('FLIGHT_SEARCH task — relevant concepts', () => {
    it('allows PRICE for FLIGHT_SEARCH', () => {
      const task = makeTaskAnalysis();
      const tagged = makeTaggedElement({ concept: 'PRICE', sensitivity: 'PUBLIC' });
      const ruling = evaluateDisclosure(tagged, task);
      expect(ruling.decision).toBe('ALLOW');
      expect(ruling.reason).toBe('TASK_REQUIRES_CONCEPT');
    });

    it('allows AIRLINE for FLIGHT_SEARCH', () => {
      const task = makeTaskAnalysis();
      const tagged = makeTaggedElement({ concept: 'AIRLINE', sensitivity: 'PUBLIC' });
      const ruling = evaluateDisclosure(tagged, task);
      expect(ruling.decision).toBe('ALLOW');
    });

    it('allows FLIGHT_NUMBER for FLIGHT_SEARCH', () => {
      const task = makeTaskAnalysis();
      const tagged = makeTaggedElement({ concept: 'FLIGHT_NUMBER', sensitivity: 'PUBLIC' });
      const ruling = evaluateDisclosure(tagged, task);
      expect(ruling.decision).toBe('ALLOW');
    });
  });

  describe('FLIGHT_SEARCH task — irrelevant concepts', () => {
    it('excludes PASSENGER_NAME for FLIGHT_SEARCH (not task-relevant)', () => {
      const task = makeTaskAnalysis();
      const tagged = makeTaggedElement({ concept: 'PASSENGER_NAME', sensitivity: 'PERSONAL', piiType: 'PERSON_NAME' });
      const ruling = evaluateDisclosure(tagged, task);
      expect(ruling.decision).toBe('EXCLUDE');
      expect(ruling.reason).toBe('NOT_TASK_RELEVANT');
    });

    it('excludes PASSENGER_EMAIL for FLIGHT_SEARCH', () => {
      const task = makeTaskAnalysis();
      const tagged = makeTaggedElement({ concept: 'PASSENGER_EMAIL', sensitivity: 'PERSONAL', piiType: 'EMAIL' });
      const ruling = evaluateDisclosure(tagged, task);
      expect(ruling.decision).toBe('EXCLUDE');
      expect(ruling.reason).toBe('NOT_TASK_RELEVANT');
    });

    it('excludes PASSPORT for FLIGHT_SEARCH', () => {
      const task = makeTaskAnalysis();
      const tagged = makeTaggedElement({ concept: 'PASSPORT', sensitivity: 'SECRET', piiType: 'PASSPORT_NUMBER' });
      const ruling = evaluateDisclosure(tagged, task);
      expect(ruling.decision).toBe('EXCLUDE');
      expect(ruling.reason).toBe('NOT_TASK_RELEVANT');
    });

    it('excludes generic page chrome for FLIGHT_SEARCH', () => {
      const task = makeTaskAnalysis();
      const tagged = makeTaggedElement({ concept: 'UNKNOWN', sensitivity: 'PUBLIC', piiType: 'NONE' });
      const ruling = evaluateDisclosure(tagged, task);
      expect(ruling.decision).toBe('EXCLUDE');
      expect(ruling.reason).toBe('NOT_TASK_RELEVANT');
    });
  });

  describe('SECRET always blocked (unconditional)', () => {
    it('blocks CARD_NUMBER even under FORM_COMPLETION_PREVIEW', () => {
      const task = makeTaskAnalysis({
        intent: 'FORM_COMPLETION_PREVIEW',
        requiredConcepts: ['PASSENGER_NAME', 'PASSENGER_EMAIL', 'PASSENGER_PHONE', 'PASSPORT', 'PAYMENT_CARD', 'PAYMENT_EXPIRY', 'PAYMENT_CVV'],
      });
      const tagged = makeTaggedElement({ concept: 'PAYMENT_CARD', sensitivity: 'SECRET', piiType: 'CARD_NUMBER' });
      const ruling = evaluateDisclosure(tagged, task);
      expect(ruling.decision).toBe('BLOCK');
      expect(ruling.reason).toBe('SECRET_ALWAYS_BLOCKED');
    });

    it('blocks CVV even under FORM_COMPLETION_PREVIEW', () => {
      const task = makeTaskAnalysis({
        intent: 'FORM_COMPLETION_PREVIEW',
        requiredConcepts: ['PASSENGER_NAME', 'PASSENGER_EMAIL', 'PASSENGER_PHONE', 'PASSPORT', 'PAYMENT_CARD', 'PAYMENT_EXPIRY', 'PAYMENT_CVV'],
      });
      const tagged = makeTaggedElement({ concept: 'PAYMENT_CVV', sensitivity: 'SECRET', piiType: 'CVV' });
      const ruling = evaluateDisclosure(tagged, task);
      expect(ruling.decision).toBe('BLOCK');
      expect(ruling.reason).toBe('SECRET_ALWAYS_BLOCKED');
    });

    it('blocks PASSWORD even under FORM_REVIEW', () => {
      const task = makeTaskAnalysis({
        intent: 'FORM_REVIEW',
        requiredConcepts: ['PASSENGER_NAME', 'PASSENGER_EMAIL', 'PASSENGER_PHONE', 'PASSPORT', 'PAYMENT_CARD', 'PAYMENT_EXPIRY', 'PAYMENT_CVV'],
      });
      const tagged = makeTaggedElement({ concept: 'PAYMENT_CVV', sensitivity: 'SECRET', piiType: 'PASSWORD' });
      const ruling = evaluateDisclosure(tagged, task);
      expect(ruling.decision).toBe('BLOCK');
      expect(ruling.reason).toBe('SECRET_ALWAYS_BLOCKED');
    });

    it('blocks PASSPORT even under FORM_REVIEW', () => {
      const task = makeTaskAnalysis({
        intent: 'FORM_REVIEW',
        requiredConcepts: ['PASSENGER_NAME', 'PASSENGER_EMAIL', 'PASSENGER_PHONE', 'PASSPORT', 'PAYMENT_CARD', 'PAYMENT_EXPIRY', 'PAYMENT_CVV'],
      });
      const tagged = makeTaggedElement({ concept: 'PASSPORT', sensitivity: 'SECRET', piiType: 'PASSPORT_NUMBER' });
      const ruling = evaluateDisclosure(tagged, task);
      expect(ruling.decision).toBe('BLOCK');
      expect(ruling.reason).toBe('SECRET_ALWAYS_BLOCKED');
    });
  });

  describe('PERSONAL data minimized', () => {
    it('minimizes PASSENGER_NAME under FORM_REVIEW', () => {
      const task = makeTaskAnalysis({
        intent: 'FORM_REVIEW',
        requiredConcepts: ['PASSENGER_NAME', 'PASSENGER_EMAIL', 'PASSENGER_PHONE'],
      });
      const tagged = makeTaggedElement({ concept: 'PASSENGER_NAME', sensitivity: 'PERSONAL', piiType: 'PERSON_NAME' });
      const ruling = evaluateDisclosure(tagged, task);
      expect(ruling.decision).toBe('MINIMIZE');
      expect(ruling.reason).toBe('PERSONAL_DATA_MINIMIZED');
    });

    it('minimizes PASSENGER_EMAIL under FORM_REVIEW', () => {
      const task = makeTaskAnalysis({
        intent: 'FORM_REVIEW',
        requiredConcepts: ['PASSENGER_NAME', 'PASSENGER_EMAIL', 'PASSENGER_PHONE'],
      });
      const tagged = makeTaggedElement({ concept: 'PASSENGER_EMAIL', sensitivity: 'PERSONAL', piiType: 'EMAIL' });
      const ruling = evaluateDisclosure(tagged, task);
      expect(ruling.decision).toBe('MINIMIZE');
      expect(ruling.reason).toBe('PERSONAL_DATA_MINIMIZED');
    });
  });

  describe('UNKNOWN task — conservative exclude', () => {
    it('excludes everything except PUBLIC static content for UNKNOWN task', () => {
      const task = makeTaskAnalysis({ intent: 'UNKNOWN', confidence: 0.1, requiredConcepts: [] });

      // PUBLIC UNKNOWN concept → ALLOW (static content)
      const publicStatic = makeTaggedElement({ concept: 'UNKNOWN', sensitivity: 'PUBLIC' });
      const ruling1 = evaluateDisclosure(publicStatic, task);
      expect(ruling1.decision).toBe('ALLOW');

      // PERSONAL concept → EXCLUDE
      const personal = makeTaggedElement({ concept: 'PASSENGER_NAME', sensitivity: 'PERSONAL', piiType: 'PERSON_NAME' });
      const ruling2 = evaluateDisclosure(personal, task);
      expect(ruling2.decision).toBe('EXCLUDE');
      expect(ruling2.reason).toBe('UNKNOWN_TASK_CONSERVATIVE_EXCLUDE');

      // SECRET concept → EXCLUDE
      const secret = makeTaggedElement({ concept: 'PAYMENT_CARD', sensitivity: 'SECRET', piiType: 'CARD_NUMBER' });
      const ruling3 = evaluateDisclosure(secret, task);
      expect(ruling3.decision).toBe('EXCLUDE');
      expect(ruling3.reason).toBe('UNKNOWN_TASK_CONSERVATIVE_EXCLUDE');

      // CONTEXTUAL concept → EXCLUDE
      const contextual = makeTaggedElement({ concept: 'ORIGIN', sensitivity: 'CONTEXTUAL' });
      const ruling4 = evaluateDisclosure(contextual, task);
      expect(ruling4.decision).toBe('EXCLUDE');
      expect(ruling4.reason).toBe('UNKNOWN_TASK_CONSERVATIVE_EXCLUDE');
    });
  });

  describe('DisclosurePlan summary counts', () => {
    it('counts allowed, minimized, excluded, blocked correctly', () => {
      // Use FORM_REVIEW which requires PAYMENT_CARD, PASSENGER_NAME, and PRICE
      const task = makeTaskAnalysis({
        intent: 'FORM_REVIEW',
        requiredConcepts: ['PASSENGER_NAME', 'PASSENGER_EMAIL', 'PAYMENT_CARD', 'PRICE', 'AIRLINE'],
      });
      const taggedElements: TaggedElement[] = [
        makeTaggedElement({ elementId: 'e1', concept: 'PRICE', sensitivity: 'PUBLIC' }),
        makeTaggedElement({ elementId: 'e2', concept: 'PASSENGER_NAME', sensitivity: 'PERSONAL', piiType: 'PERSON_NAME' }),
        makeTaggedElement({ elementId: 'e3', concept: 'PAYMENT_CARD', sensitivity: 'SECRET', piiType: 'CARD_NUMBER' }),
        makeTaggedElement({ elementId: 'e4', concept: 'AIRLINE', sensitivity: 'PUBLIC' }),
      ];

      const plan = evaluateDisclosurePlan(taggedElements, task);
      expect(plan.summary.allowed).toBe(2);  // PRICE, AIRLINE (PUBLIC + required)
      expect(plan.summary.minimized).toBe(1); // PASSENGER_NAME (PERSONAL + required)
      expect(plan.summary.excluded).toBe(0);
      expect(plan.summary.blocked).toBe(1);   // PAYMENT_CARD (SECRET + required)
    });
  });

  describe('No raw input values in SanitizedContext (structural test)', () => {
    it('SanitizedContext never contains raw user-entered values', () => {
      const task = makeTaskAnalysis({
        intent: 'FORM_REVIEW',
        requiredConcepts: ['PASSENGER_NAME', 'PASSENGER_EMAIL', 'PASSENGER_PHONE', 'PASSPORT', 'PAYMENT_CARD', 'PAYMENT_EXPIRY', 'PAYMENT_CVV', 'PRICE', 'AIRLINE'],
      });

      // Elements with raw values that should NOT appear
      const taggedElements: TaggedElement[] = [
        makeTaggedElement({ elementId: 'name-field', concept: 'PASSENGER_NAME', sensitivity: 'PERSONAL', piiType: 'PERSON_NAME', text: 'John Doe', label: 'Full Name', tagName: 'INPUT' }),
        makeTaggedElement({ elementId: 'email-field', concept: 'PASSENGER_EMAIL', sensitivity: 'PERSONAL', piiType: 'EMAIL', text: 'john@example.com', label: 'Email', tagName: 'INPUT' }),
        makeTaggedElement({ elementId: 'card-field', concept: 'PAYMENT_CARD', sensitivity: 'SECRET', piiType: 'CARD_NUMBER', text: '4242424242424242', label: 'Card Number', tagName: 'INPUT' }),
        makeTaggedElement({ elementId: 'price-field', concept: 'PRICE', sensitivity: 'PUBLIC', text: '₹4,250', label: 'Price', tagName: 'SPAN' }),
        makeTaggedElement({ elementId: 'airline-field', concept: 'AIRLINE', sensitivity: 'PUBLIC', text: 'SkyBook Airways', label: 'Airline', tagName: 'SPAN' }),
      ];

      const plan = evaluateDisclosurePlan(taggedElements, task);
      const context = buildSanitizedContext(plan, taggedElements, task.rawText);

      // Structural assertion: no sensitive values in the context
      const sensitiveValues = ['John Doe', 'john@example.com', '4242424242424242'];
      for (const element of context.elements) {
        // Check publicText doesn't contain sensitive values
        if (element.publicText) {
          for (const value of sensitiveValues) {
            expect(element.publicText).not.toContain(value);
          }
        }
      }

      // PASSPORT should be BLOCKED (SECRET), not in context at all
      const passportElements = context.elements.filter(e => e.concept === 'PASSPORT');
      expect(passportElements).toHaveLength(0);

      // PAYMENT_CARD should be BLOCKED (SECRET), not in context
      const cardElements = context.elements.filter(e => e.concept === 'PAYMENT_CARD');
      expect(cardElements).toHaveLength(0);
    });

    it('EXCLUDE and BLOCK entries never appear in SanitizedContext.elements', () => {
      const task = makeTaskAnalysis();
      const taggedElements: TaggedElement[] = [
        makeTaggedElement({ elementId: 'e1', concept: 'PRICE', sensitivity: 'PUBLIC' }),
        makeTaggedElement({ elementId: 'e2', concept: 'PASSENGER_NAME', sensitivity: 'PERSONAL', piiType: 'PERSON_NAME' }),
        makeTaggedElement({ elementId: 'e3', concept: 'PAYMENT_CARD', sensitivity: 'SECRET', piiType: 'CARD_NUMBER' }),
      ];

      const plan = evaluateDisclosurePlan(taggedElements, task);
      const context = buildSanitizedContext(plan, taggedElements, task.rawText);

      // Only ALLOW entries should be in the context (PRICE is the only required PUBLIC concept)
      for (const element of context.elements) {
        expect(element.decision).not.toBe('EXCLUDE');
        expect(element.decision).not.toBe('BLOCK');
      }
    });
  });
});
