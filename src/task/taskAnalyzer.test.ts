/**
 * Task Analyzer — unit tests.
 *
 * Tests the task analyzer independently of the DOM/policy engine.
 * Pure text-in, TaskAnalysisResult-out.
 */

import { describe, it, expect } from 'vitest';
import { analyzeTask, taskConfidenceBand } from './taskAnalyzer';

describe('taskAnalyzer', () => {
  describe('flight-search intent detection', () => {
    it('detects FLIGHT_SEARCH for "find the cheapest flight from Mumbai to Delhi"', () => {
      const result = analyzeTask('Find the cheapest flight from Mumbai to Delhi');
      expect(result.intent).toBe('FLIGHT_SEARCH');
      expect(result.confidence).toBeGreaterThanOrEqual(0.40);
      expect(result.entities.origin).toBeDefined();
      expect(result.entities.destination).toBeDefined();
    });

    it('detects FLIGHT_SEARCH for "search flights"', () => {
      const result = analyzeTask('Search flights');
      expect(result.intent).toBe('FLIGHT_SEARCH');
      expect(result.confidence).toBeGreaterThanOrEqual(0.40);
    });

    it('detects FLIGHT_SEARCH for "compare prices"', () => {
      const result = analyzeTask('Compare prices for flights');
      expect(result.intent).toBe('FLIGHT_SEARCH');
    });
  });

  describe('flight-selection intent detection', () => {
    it('detects FLIGHT_SELECTION for "select this flight"', () => {
      const result = analyzeTask('Select this flight');
      expect(result.intent).toBe('FLIGHT_SELECTION');
      expect(result.confidence).toBeGreaterThanOrEqual(0.40);
    });

    it('detects FLIGHT_SELECTION for "book this flight"', () => {
      const result = analyzeTask('Book this flight');
      expect(result.intent).toBe('FLIGHT_SELECTION');
    });
  });

  describe('form-review intent detection', () => {
    it('detects FORM_REVIEW for "review my details"', () => {
      const result = analyzeTask('Review my details');
      expect(result.intent).toBe('FORM_REVIEW');
      expect(result.confidence).toBeGreaterThanOrEqual(0.40);
    });

    it('detects FORM_REVIEW for "what did I enter"', () => {
      const result = analyzeTask('What did I enter?');
      expect(result.intent).toBe('FORM_REVIEW');
    });
  });

  describe('form-completion-preview intent detection', () => {
    it('detects FORM_COMPLETION_PREVIEW for "fill in the form"', () => {
      const result = analyzeTask('Fill in the form');
      expect(result.intent).toBe('FORM_COMPLETION_PREVIEW');
      expect(result.confidence).toBeGreaterThanOrEqual(0.40);
    });
  });

  describe('generic-page-navigation intent detection', () => {
    it('detects GENERIC_PAGE_NAVIGATION for "browse the page"', () => {
      const result = analyzeTask('Browse the page');
      expect(result.intent).toBe('GENERIC_PAGE_NAVIGATION');
    });
  });

  describe('UNKNOWN intent handling', () => {
    it('returns UNKNOWN with low confidence for unrecognized task', () => {
      const result = analyzeTask('What is the weather like today?');
      expect(result.intent).toBe('UNKNOWN');
      expect(result.confidence).toBeLessThan(0.40);
    });

    it('returns UNKNOWN for empty string', () => {
      const result = analyzeTask('');
      expect(result.intent).toBe('UNKNOWN');
      expect(result.confidence).toBe(0);
    });

    it('does not fall through to FLIGHT_SEARCH for irrelevant text', () => {
      const result = analyzeTask('hello world');
      expect(result.intent).toBe('UNKNOWN');
    });
  });

  describe('origin/destination extraction via gazetteer', () => {
    it('extracts origin and destination from "from Mumbai to Delhi"', () => {
      const result = analyzeTask('Find flights from Mumbai to Delhi');
      expect(result.entities.origin).toBe('Mumbai');
      expect(result.entities.destination).toBe('Delhi');
    });

    it('extracts entities from "Mumbai to Delhi flights"', () => {
      const result = analyzeTask('Mumbai to Delhi flights');
      expect(result.entities.origin).toBe('Mumbai');
      expect(result.entities.destination).toBe('Delhi');
    });

    it('handles unrecognized city names with lower confidence', () => {
      const result = analyzeTask('Flights from Xyzabc to Qwerty');
      // Should still extract the spans, just with lower confidence
      expect(result.entities.origin).toBeDefined();
      expect(result.entities.destination).toBeDefined();
    });
  });

  describe('required concepts mapping', () => {
    it('FLIGHT_SEARCH requires flight-related concepts', () => {
      const result = analyzeTask('Search flights from Mumbai to Delhi');
      expect(result.requiredConcepts).toContain('ORIGIN');
      expect(result.requiredConcepts).toContain('DESTINATION');
      expect(result.requiredConcepts).toContain('PRICE');
      expect(result.requiredConcepts).toContain('AIRLINE');
      expect(result.requiredConcepts).toContain('FLIGHT_NUMBER');
    });

    it('UNKNOWN intent has empty required concepts', () => {
      const result = analyzeTask('What is the weather?');
      expect(result.requiredConcepts).toEqual([]);
    });
  });

  describe('confidence bands', () => {
    it('returns HIGH for score >= 0.85', () => {
      expect(taskConfidenceBand(0.85)).toBe('HIGH');
      expect(taskConfidenceBand(1.0)).toBe('HIGH');
    });

    it('returns MEDIUM for score 0.60-0.84', () => {
      expect(taskConfidenceBand(0.60)).toBe('MEDIUM');
      expect(taskConfidenceBand(0.84)).toBe('MEDIUM');
    });

    it('returns LOW for score 0.40-0.59', () => {
      expect(taskConfidenceBand(0.40)).toBe('LOW');
      expect(taskConfidenceBand(0.59)).toBe('LOW');
    });

    it('returns UNCLASSIFIED for score < 0.40', () => {
      expect(taskConfidenceBand(0.39)).toBe('UNCLASSIFIED');
      expect(taskConfidenceBand(0)).toBe('UNCLASSIFIED');
    });
  });
});
