/**
 * Visual Context Builder — security tests.
 *
 * Tests the visual pipeline's guarantees:
 * - Visual context schema validation
 * - Sensitive bounding boxes are redacted
 * - BLOCK regions are redacted
 * - EXCLUDE regions are redacted
 * - Approved public regions remain available
 * - Raw input values never enter visual context
 * - Raw HTML never enters visual context
 * - Screenshot/raw image is never sent before redaction
 * - Empty visual context handled safely
 */

import { describe, it, expect } from 'vitest';
import { buildSanitizedVisualContext, getVisualRedactionSummary } from './visualContextBuilder';
import type { VisualContext, SanitizedVisualContext } from './visualTypes';
import type { SanitizedContext } from '../task/taskTypes';

// ─── Test Fixtures ─────────────────────────────────────────────────

function makeVisualContext(): VisualContext {
  return {
    width: 1920,
    height: 1080,
    timestamp: Date.now(),
    regions: [
      {
        elementId: 'price-1',
        concept: 'PRICE',
        boundingBox: { x: 100, y: 200, width: 150, height: 30 },
        visible: true,
        redacted: false,
      },
      {
        elementId: 'airline-1',
        concept: 'AIRLINE',
        boundingBox: { x: 100, y: 170, width: 200, height: 25 },
        visible: true,
        redacted: false,
      },
      {
        elementId: 'select-btn-1',
        concept: 'SELECTION_CONTROL',
        boundingBox: { x: 300, y: 200, width: 120, height: 35 },
        visible: true,
        redacted: false,
      },
      {
        elementId: 'passenger-name',
        concept: 'PASSENGER_NAME',
        boundingBox: { x: 100, y: 400, width: 200, height: 30 },
        visible: true,
        redacted: false,
      },
      {
        elementId: 'card-number',
        concept: 'PAYMENT_CARD',
        boundingBox: { x: 100, y: 500, width: 250, height: 30 },
        visible: true,
        redacted: false,
      },
    ],
  };
}

function makeSanitizedContext(): SanitizedContext {
  return {
    timestamp: Date.now(),
    task: 'Find the cheapest flight',
    elements: [
      { elementId: 'price-1', concept: 'PRICE', tagName: 'SPAN', decision: 'ALLOW' },
      { elementId: 'airline-1', concept: 'AIRLINE', tagName: 'SPAN', decision: 'ALLOW' },
      { elementId: 'select-btn-1', concept: 'SELECTION_CONTROL', tagName: 'BUTTON', decision: 'ALLOW' },
    ],
  };
}

// ─── Tests ─────────────────────────────────────────────────────────

describe('visualContextBuilder', () => {
  describe('visual context schema validation', () => {
    it('produces a valid SanitizedVisualContext', () => {
      const visualContext = makeVisualContext();
      const sanitizedContext = makeSanitizedContext();

      const result = buildSanitizedVisualContext(visualContext, sanitizedContext);

      expect(result).toHaveProperty('width');
      expect(result).toHaveProperty('height');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('regions');
      expect(result).toHaveProperty('summary');
      expect(Array.isArray(result.regions)).toBe(true);
    });

    it('preserves page dimensions', () => {
      const visualContext = makeVisualContext();
      const sanitizedContext = makeSanitizedContext();

      const result = buildSanitizedVisualContext(visualContext, sanitizedContext);

      expect(result.width).toBe(1920);
      expect(result.height).toBe(1080);
    });

    it('each region has required fields', () => {
      const visualContext = makeVisualContext();
      const sanitizedContext = makeSanitizedContext();

      const result = buildSanitizedVisualContext(visualContext, sanitizedContext);

      for (const region of result.regions) {
        expect(region).toHaveProperty('elementId');
        expect(region).toHaveProperty('concept');
        expect(region).toHaveProperty('boundingBox');
        expect(region).toHaveProperty('visible');
        expect(region.boundingBox).toHaveProperty('x');
        expect(region.boundingBox).toHaveProperty('y');
        expect(region.boundingBox).toHaveProperty('width');
        expect(region.boundingBox).toHaveProperty('height');
      }
    });
  });

  describe('sensitive bounding boxes are redacted', () => {
    it('excludes PASSENGER_NAME regions from sanitized output', () => {
      const visualContext = makeVisualContext();
      const sanitizedContext = makeSanitizedContext();

      const result = buildSanitizedVisualContext(visualContext, sanitizedContext);

      const nameRegion = result.regions.find(r => r.elementId === 'passenger-name');
      expect(nameRegion).toBeUndefined();
    });

    it('excludes PAYMENT_CARD regions from sanitized output', () => {
      const visualContext = makeVisualContext();
      const sanitizedContext = makeSanitizedContext();

      const result = buildSanitizedVisualContext(visualContext, sanitizedContext);

      const cardRegion = result.regions.find(r => r.elementId === 'card-number');
      expect(cardRegion).toBeUndefined();
    });
  });

  describe('BLOCK regions are redacted', () => {
    it('excludes elements not in the sanitized context', () => {
      const visualContext = makeVisualContext();
      const sanitizedContext = makeSanitizedContext();

      const result = buildSanitizedVisualContext(visualContext, sanitizedContext);

      // passenger-name and card-number are not in sanitizedContext
      expect(result.regions.find(r => r.elementId === 'passenger-name')).toBeUndefined();
      expect(result.regions.find(r => r.elementId === 'card-number')).toBeUndefined();
    });
  });

  describe('EXCLUDE regions are redacted', () => {
    it('excludes elements not in the sanitized context', () => {
      const visualContext = makeVisualContext();
      const sanitizedContext = makeSanitizedContext();

      const result = buildSanitizedVisualContext(visualContext, sanitizedContext);

      // Elements not in sanitizedContext are excluded
      const allElementIds = result.regions.map(r => r.elementId);
      expect(allElementIds).not.toContain('passenger-name');
      expect(allElementIds).not.toContain('card-number');
    });
  });

  describe('approved public regions remain available', () => {
    it('includes ALLOW-decision elements in sanitized output', () => {
      const visualContext = makeVisualContext();
      const sanitizedContext = makeSanitizedContext();

      const result = buildSanitizedVisualContext(visualContext, sanitizedContext);

      expect(result.regions.find(r => r.elementId === 'price-1')).toBeDefined();
      expect(result.regions.find(r => r.elementId === 'airline-1')).toBeDefined();
      expect(result.regions.find(r => r.elementId === 'select-btn-1')).toBeDefined();
    });
  });

  describe('raw input values never enter visual context', () => {
    it('visual context contains no raw text values', () => {
      const visualContext = makeVisualContext();
      const sanitizedContext = makeSanitizedContext();

      const result = buildSanitizedVisualContext(visualContext, sanitizedContext);

      // SanitizedVisualRegion should not have a 'text' or 'value' field
      for (const region of result.regions) {
        expect(region).not.toHaveProperty('text');
        expect(region).not.toHaveProperty('value');
        expect(region).not.toHaveProperty('publicText');
      }
    });
  });

  describe('raw HTML never enters visual context', () => {
    it('visual context contains no HTML strings', () => {
      const visualContext = makeVisualContext();
      const sanitizedContext = makeSanitizedContext();

      const result = buildSanitizedVisualContext(visualContext, sanitizedContext);

      const serialized = JSON.stringify(result);
      expect(serialized).not.toContain('<');
      expect(serialized).not.toContain('innerHTML');
      expect(serialized).not.toContain('script');
    });
  });

  describe('screenshot/raw image is never sent before redaction', () => {
    it('sanitized visual context has no image data', () => {
      const visualContext = makeVisualContext();
      const sanitizedContext = makeSanitizedContext();

      const result = buildSanitizedVisualContext(visualContext, sanitizedContext);

      expect(result).not.toHaveProperty('image');
      expect(result).not.toHaveProperty('screenshot');
      expect(result).not.toHaveProperty('pixels');
      expect(result).not.toHaveProperty('dataUrl');
      expect(result).not.toHaveProperty('base64');
    });
  });

  describe('empty visual context handled safely', () => {
    it('handles empty regions gracefully', () => {
      const visualContext: VisualContext = {
        width: 1920,
        height: 1080,
        timestamp: Date.now(),
        regions: [],
      };
      const sanitizedContext = makeSanitizedContext();

      const result = buildSanitizedVisualContext(visualContext, sanitizedContext);

      expect(result.regions).toEqual([]);
      expect(result.summary.totalRegions).toBe(0);
      expect(result.summary.redactedRegions).toBe(0);
    });

    it('handles empty sanitized context gracefully', () => {
      const visualContext = makeVisualContext();
      const sanitizedContext: SanitizedContext = {
        timestamp: Date.now(),
        task: 'Test',
        elements: [],
      };

      const result = buildSanitizedVisualContext(visualContext, sanitizedContext);

      expect(result.regions).toEqual([]);
      expect(result.summary.redactedRegions).toBe(5); // All regions redacted
    });
  });

  describe('summary counts are accurate', () => {
    it('counts total, redacted, and visible regions correctly', () => {
      const visualContext = makeVisualContext();
      const sanitizedContext = makeSanitizedContext();

      const result = buildSanitizedVisualContext(visualContext, sanitizedContext);

      expect(result.summary.totalRegions).toBe(5); // All original regions
      expect(result.summary.redactedRegions).toBe(2); // passenger-name, card-number
      expect(result.summary.visibleRegions).toBe(3); // price-1, airline-1, select-btn-1
    });
  });

  describe('redaction summary', () => {
    it('provides a human-readable summary', () => {
      const visualContext = makeVisualContext();
      const sanitizedContext = makeSanitizedContext();

      const sanitized = buildSanitizedVisualContext(visualContext, sanitizedContext);
      const summary = getVisualRedactionSummary(visualContext, sanitized);

      expect(summary).toContain('5 regions');
      expect(summary).toContain('3 approved');
      expect(summary).toContain('2 redacted');
    });
  });
});
