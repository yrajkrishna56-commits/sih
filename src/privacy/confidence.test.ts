/**
 * Tests for confidence.ts — scoring, Luhn, combination logic.
 */

import { describe, it, expect } from 'vitest';
import { scoreAndCombine, confidenceBand, luhnCheck, CONFIDENCE_HIGH, CONFIDENCE_MEDIUM, CONFIDENCE_LOW } from './confidence';
import type { EvidenceSignal } from './privacyTypes';

// ─── Luhn Algorithm ────────────────────────────────────────────────

describe('luhnCheck', () => {
  it('validates standard test card 4242 4242 4242 4242', () => {
    expect(luhnCheck('4242424242424242')).toBe(true);
  });

  it('validates card with spaces', () => {
    expect(luhnCheck('4242 4242 4242 4242')).toBe(true);
  });

  it('validates another known valid number 4012888888881881', () => {
    expect(luhnCheck('4012888888881881')).toBe(true);
  });

  it('rejects random 16-digit number failing Luhn', () => {
    expect(luhnCheck('1234567890123456')).toBe(false);
  });

  it('rejects too-short number', () => {
    expect(luhnCheck('424242')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(luhnCheck('')).toBe(false);
  });

  it('rejects non-numeric string', () => {
    expect(luhnCheck('abcdefghijklmnop')).toBe(false);
  });
});

// ─── Confidence Band ───────────────────────────────────────────────

describe('confidenceBand', () => {
  it('returns HIGH for >= 0.85', () => {
    expect(confidenceBand(0.85)).toBe('HIGH');
    expect(confidenceBand(1.0)).toBe('HIGH');
  });

  it('returns MEDIUM for 0.60–0.84', () => {
    expect(confidenceBand(0.60)).toBe('MEDIUM');
    expect(confidenceBand(0.84)).toBe('MEDIUM');
  });

  it('returns LOW for 0.40–0.59', () => {
    expect(confidenceBand(0.40)).toBe('LOW');
    expect(confidenceBand(0.59)).toBe('LOW');
  });

  it('returns UNCLASSIFIED for < 0.40', () => {
    expect(confidenceBand(0.39)).toBe('UNCLASSIFIED');
    expect(confidenceBand(0)).toBe('UNCLASSIFIED');
  });
});

// ─── Score and Combine ─────────────────────────────────────────────

describe('scoreAndCombine', () => {
  it('returns NONE when no signals', () => {
    const result = scoreAndCombine('el-1', []);
    expect(result.piiType).toBe('NONE');
    expect(result.confidence).toBe(0);
  });

  it('returns NONE when score below floor (0.40)', () => {
    const signals: EvidenceSignal[] = [
      { method: 'PLACEHOLDER', matchedValue: 'type here', suggestedType: 'EMAIL', weight: 0.10 },
    ];
    const result = scoreAndCombine('el-2', signals);
    expect(result.piiType).toBe('NONE');
  });

  it('classifies EMAIL with strong type signal', () => {
    const signals: EvidenceSignal[] = [
      { method: 'INPUT_TYPE', matchedValue: 'email', suggestedType: 'EMAIL', weight: 0.50 },
    ];
    const result = scoreAndCombine('el-3', signals);
    expect(result.piiType).toBe('EMAIL');
    expect(result.confidence).toBe(0.50);
    expect(result.sensitivity).toBe('PERSONAL');
  });

  it('multi-signal yields HIGH confidence', () => {
    const signals: EvidenceSignal[] = [
      { method: 'INPUT_TYPE', matchedValue: 'email', suggestedType: 'EMAIL', weight: 0.50 },
      { method: 'LABEL', matchedValue: 'email address', suggestedType: 'EMAIL', weight: 0.25 },
      { method: 'FIELD_NAME', matchedValue: 'email', suggestedType: 'EMAIL', weight: 0.25 },
    ];
    const result = scoreAndCombine('el-4', signals);
    expect(result.piiType).toBe('EMAIL');
    expect(result.confidence).toBe(1.0); // capped
    expect(result.detectionMethods).toContain('INPUT_TYPE');
    expect(result.detectionMethods).toContain('LABEL');
  });

  it('deduplicates same method+value to prevent double-counting', () => {
    const signals: EvidenceSignal[] = [
      { method: 'FIELD_NAME', matchedValue: 'email', suggestedType: 'EMAIL', weight: 0.25 },
      { method: 'FIELD_NAME', matchedValue: 'email', suggestedType: 'EMAIL', weight: 0.25 },
    ];
    const result = scoreAndCombine('el-5', signals);
    // Should only count once = 0.25, below floor
    expect(result.piiType).toBe('NONE');
  });

  it('allows different methods for same type', () => {
    const signals: EvidenceSignal[] = [
      { method: 'FIELD_NAME', matchedValue: 'email', suggestedType: 'EMAIL', weight: 0.25 },
      { method: 'FIELD_ID', matchedValue: 'email', suggestedType: 'EMAIL', weight: 0.25 },
    ];
    const result = scoreAndCombine('el-6', signals);
    expect(result.piiType).toBe('EMAIL');
    expect(result.confidence).toBe(0.50);
  });

  it('picks highest scoring type when types compete', () => {
    const signals: EvidenceSignal[] = [
      { method: 'INPUT_TYPE', matchedValue: 'password', suggestedType: 'PASSWORD', weight: 0.50 },
      { method: 'PLACEHOLDER', matchedValue: 'enter password', suggestedType: 'PASSWORD', weight: 0.10 },
      { method: 'FIELD_NAME', matchedValue: 'secret', suggestedType: 'EMAIL', weight: 0.25 },
    ];
    const result = scoreAndCombine('el-7', signals);
    expect(result.piiType).toBe('PASSWORD');
  });

  it('includes all evidence in output', () => {
    const signals: EvidenceSignal[] = [
      { method: 'INPUT_TYPE', matchedValue: 'email', suggestedType: 'EMAIL', weight: 0.50 },
      { method: 'LABEL', matchedValue: 'your email', suggestedType: 'EMAIL', weight: 0.25 },
    ];
    const result = scoreAndCombine('el-8', signals);
    expect(result.evidence).toHaveLength(2);
  });
});
