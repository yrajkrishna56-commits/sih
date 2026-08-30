/**
 * Concept Tagger — unit tests.
 *
 * Tests the concept tagger independently of the DOM.
 * Uses PageElement fixtures with text/label/ariaLabel.
 */

import { describe, it, expect } from 'vitest';
import { tagElement } from './conceptTagger';
import type { PageElement } from '../shared/types';
import type { PrivacyAssessment } from '../privacy/privacyTypes';

// ─── Test Fixtures ─────────────────────────────────────────────────

function makeElement(overrides: Partial<PageElement> = {}): PageElement {
  return {
    id: 'test-1',
    tagName: 'SPAN',
    visible: true,
    ...overrides,
  };
}

function makeAssessment(overrides: Partial<PrivacyAssessment> = {}): PrivacyAssessment {
  return {
    elementId: 'test-1',
    piiType: 'NONE',
    sensitivity: 'PUBLIC',
    confidence: 0.5,
    detectionMethods: [],
    explanation: 'Test',
    evidence: [],
    ...overrides,
  };
}

// ─── Tests ─────────────────────────────────────────────────────────

describe('conceptTagger', () => {
  describe('PII type mapping', () => {
    it('maps PERSON_NAME to PASSENGER_NAME', () => {
      const element = makeElement();
      const assessment = makeAssessment({ piiType: 'PERSON_NAME', sensitivity: 'PERSONAL' });
      expect(tagElement(element, assessment)).toBe('PASSENGER_NAME');
    });

    it('maps EMAIL to PASSENGER_EMAIL', () => {
      const element = makeElement();
      const assessment = makeAssessment({ piiType: 'EMAIL', sensitivity: 'PERSONAL' });
      expect(tagElement(element, assessment)).toBe('PASSENGER_EMAIL');
    });

    it('maps PHONE to PASSENGER_PHONE', () => {
      const element = makeElement();
      const assessment = makeAssessment({ piiType: 'PHONE', sensitivity: 'PERSONAL' });
      expect(tagElement(element, assessment)).toBe('PASSENGER_PHONE');
    });

    it('maps CARD_NUMBER to PAYMENT_CARD', () => {
      const element = makeElement();
      const assessment = makeAssessment({ piiType: 'CARD_NUMBER', sensitivity: 'SECRET' });
      expect(tagElement(element, assessment)).toBe('PAYMENT_CARD');
    });

    it('maps CVV to PAYMENT_CVV', () => {
      const element = makeElement();
      const assessment = makeAssessment({ piiType: 'CVV', sensitivity: 'SECRET' });
      expect(tagElement(element, assessment)).toBe('PAYMENT_CVV');
    });

    it('maps PASSPORT_NUMBER to PASSPORT', () => {
      const element = makeElement();
      const assessment = makeAssessment({ piiType: 'PASSPORT_NUMBER', sensitivity: 'SECRET' });
      expect(tagElement(element, assessment)).toBe('PASSPORT');
    });

    it('maps NONE to UNKNOWN', () => {
      const element = makeElement();
      const assessment = makeAssessment({ piiType: 'NONE', sensitivity: 'PUBLIC' });
      expect(tagElement(element, assessment)).toBe('UNKNOWN');
    });
  });

  describe('text/label keyword matching', () => {
    it('tags price text as PRICE', () => {
      const element = makeElement({ text: '₹4,250' });
      expect(tagElement(element, undefined)).toBe('PRICE');
    });

    it('tags airline text as AIRLINE', () => {
      const element = makeElement({ text: 'SkyBook Airways' });
      expect(tagElement(element, undefined)).toBe('AIRLINE');
    });

    it('tags flight number as FLIGHT_NUMBER', () => {
      const element = makeElement({ text: 'SB 101' });
      expect(tagElement(element, undefined)).toBe('FLIGHT_NUMBER');
    });

    it('tags "Select Flight" button as SELECTION_CONTROL', () => {
      const element = makeElement({ tagName: 'BUTTON', text: 'Select Flight' });
      expect(tagElement(element, undefined)).toBe('SELECTION_CONTROL');
    });

    it('tags "Search Flights" button as SEARCH_CONTROL', () => {
      const element = makeElement({ tagName: 'BUTTON', text: 'Search Flights' });
      expect(tagElement(element, undefined)).toBe('SEARCH_CONTROL');
    });

    it('tags duration text as DURATION', () => {
      const element = makeElement({ text: 'Non-stop · 2h 15m' });
      expect(tagElement(element, undefined)).toBe('DURATION');
    });

    it('tags origin label as ORIGIN', () => {
      const element = makeElement({ label: 'From' });
      expect(tagElement(element, undefined)).toBe('ORIGIN');
    });

    it('tags destination label as DESTINATION', () => {
      const element = makeElement({ tagName: 'SELECT', label: 'To' });
      expect(tagElement(element, undefined)).toBe('DESTINATION');
    });

    it('tags email input type as PASSENGER_EMAIL', () => {
      const element = makeElement({ type: 'email' });
      expect(tagElement(element, undefined)).toBe('PASSENGER_EMAIL');
    });

    it('tags tel input type as PASSENGER_PHONE', () => {
      const element = makeElement({ type: 'tel' });
      expect(tagElement(element, undefined)).toBe('PASSENGER_PHONE');
    });
  });

  describe('UNKNOWN fallback', () => {
    it('returns UNKNOWN for elements with no matching rules', () => {
      const element = makeElement({ text: 'random text', tagName: 'DIV' });
      expect(tagElement(element, undefined)).toBe('UNKNOWN');
    });

    it('returns UNKNOWN for empty elements', () => {
      const element = makeElement({ tagName: 'DIV' });
      expect(tagElement(element, undefined)).toBe('UNKNOWN');
    });
  });
});
