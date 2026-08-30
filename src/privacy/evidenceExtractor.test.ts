/**
 * Tests for evidenceExtractor.ts — evidence extraction from DOM elements.
 * Also tests the full classify flow: evidenceExtractor → scoreAndCombine.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { extractEvidence, normalizeText } from './evidenceExtractor';
import { scoreAndCombine } from './confidence';
import type { EvidenceSignal } from './privacyTypes';

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  document.body.innerHTML = '';
});

function el(tag: string, attrs: Record<string, string> = {}, parent?: Element): HTMLElement {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    node.setAttribute(k, v);
  }
  (parent ?? document.body).appendChild(node);
  return node;
}

// ─── normalizeText ─────────────────────────────────────────────────

describe('normalizeText', () => {
  it('lowercases', () => {
    expect(normalizeText('HELLO')).toBe('hello');
  });

  it('collapses hyphens and underscores to spaces', () => {
    expect(normalizeText('first-name')).toBe('first name');
    expect(normalizeText('first_name')).toBe('first name');
  });

  it('collapses multiple spaces', () => {
    expect(normalizeText('hello   world')).toBe('hello world');
  });

  it('trims whitespace', () => {
    expect(normalizeText('  hello  ')).toBe('hello');
  });
});

// ─── Evidence Extraction ───────────────────────────────────────────

describe('extractEvidence', () => {
  it('extracts INPUT_TYPE signal for email', () => {
    const input = el('input', { type: 'email' });
    const signals = extractEvidence(input);
    const typeSignal = signals.find(s => s.method === 'INPUT_TYPE');
    expect(typeSignal).toBeDefined();
    expect(typeSignal?.suggestedType).toBe('EMAIL');
  });

  it('extracts INPUT_TYPE signal for password', () => {
    const input = el('input', { type: 'password' });
    const signals = extractEvidence(input);
    const typeSignal = signals.find(s => s.method === 'INPUT_TYPE');
    expect(typeSignal?.suggestedType).toBe('PASSWORD');
  });

  it('extracts INPUT_TYPE signal for tel', () => {
    const input = el('input', { type: 'tel' });
    const signals = extractEvidence(input);
    const typeSignal = signals.find(s => s.method === 'INPUT_TYPE');
    expect(typeSignal?.suggestedType).toBe('PHONE');
  });

  it('extracts AUTOCOMPLETE signal', () => {
    const input = el('input', { autocomplete: 'cc-number' });
    const signals = extractEvidence(input);
    const acSignal = signals.find(s => s.method === 'AUTOCOMPLETE');
    expect(acSignal).toBeDefined();
    expect(acSignal?.suggestedType).toBe('CARD_NUMBER');
  });

  it('extracts LABEL signal from for= association', () => {
    el('label', { for: 'test-email' }).textContent = 'Email Address';
    const input = el('input', { id: 'test-email', type: 'text' });
    const signals = extractEvidence(input);
    const labelSignal = signals.find(s => s.method === 'LABEL');
    expect(labelSignal).toBeDefined();
    expect(labelSignal?.suggestedType).toBe('EMAIL');
  });

  it('extracts FIELD_NAME signal from name attribute', () => {
    const input = el('input', { name: 'phone-number', type: 'text' });
    const signals = extractEvidence(input);
    const nameSignal = signals.find(s => s.method === 'FIELD_NAME');
    expect(nameSignal).toBeDefined();
    expect(nameSignal?.suggestedType).toBe('PHONE');
  });

  it('extracts FIELD_ID signal from id attribute', () => {
    const input = el('input', { id: 'card-number', type: 'text' });
    const signals = extractEvidence(input);
    const idSignal = signals.find(s => s.method === 'FIELD_ID');
    expect(idSignal).toBeDefined();
    expect(idSignal?.suggestedType).toBe('CARD_NUMBER');
  });

  it('extracts PLACEHOLDER signal', () => {
    const input = el('input', { placeholder: 'Enter your email', type: 'text' });
    const signals = extractEvidence(input);
    const phSignal = signals.find(s => s.method === 'PLACEHOLDER');
    expect(phSignal).toBeDefined();
    expect(phSignal?.suggestedType).toBe('EMAIL');
  });

  it('extracts ARIA_LABEL signal', () => {
    const input = el('input', { 'aria-label': 'Password input', type: 'text' });
    const signals = extractEvidence(input);
    const ariaSignal = signals.find(s => s.method === 'ARIA_LABEL');
    expect(ariaSignal).toBeDefined();
    expect(ariaSignal?.suggestedType).toBe('PASSWORD');
  });
});

// ─── Full Classification Flow ──────────────────────────────────────

describe('full classification flow', () => {
  it('EMAIL via type="email"', () => {
    const input = el('input', { type: 'email' });
    const signals = extractEvidence(input);
    const result = scoreAndCombine(input.getAttribute('data-ppba-id') || 'test', signals);
    expect(result.piiType).toBe('EMAIL');
    expect(result.confidence).toBeGreaterThanOrEqual(0.40);
    expect(result.evidence.length).toBeGreaterThan(0);
    expect(result.detectionMethods.length).toBeGreaterThan(0);
  });

  it('PASSWORD via type="password"', () => {
    const input = el('input', { type: 'password' });
    const signals = extractEvidence(input);
    const result = scoreAndCombine('pw-test', signals);
    expect(result.piiType).toBe('PASSWORD');
    expect(result.sensitivity).toBe('SECRET');
    expect(result.confidence).toBeGreaterThanOrEqual(0.40);
  });

  it('PHONE via type="tel"', () => {
    const input = el('input', { type: 'tel' });
    const signals = extractEvidence(input);
    const result = scoreAndCombine('tel-test', signals);
    expect(result.piiType).toBe('PHONE');
    expect(result.confidence).toBeGreaterThanOrEqual(0.40);
  });

  it('CARD_NUMBER via autocomplete="cc-number"', () => {
    const input = el('input', { autocomplete: 'cc-number' });
    const signals = extractEvidence(input);
    const result = scoreAndCombine('cc-test', signals);
    expect(result.piiType).toBe('CARD_NUMBER');
    expect(result.sensitivity).toBe('SECRET');
    expect(result.confidence).toBeGreaterThanOrEqual(0.40);
  });

  it('CVV via autocomplete="cc-csc"', () => {
    const input = el('input', { autocomplete: 'cc-csc' });
    const signals = extractEvidence(input);
    const result = scoreAndCombine('cvv-test', signals);
    expect(result.piiType).toBe('CVV');
    expect(result.sensitivity).toBe('SECRET');
    expect(result.confidence).toBeGreaterThanOrEqual(0.40);
  });

  it('PASSPORT_NUMBER via label', () => {
    el('label', { for: 'passport-input' }).textContent = 'Passport Number';
    const input = el('input', { id: 'passport-input', type: 'text' });
    const signals = extractEvidence(input);
    const result = scoreAndCombine('pp-test', signals);
    expect(result.piiType).toBe('PASSPORT_NUMBER');
    expect(result.sensitivity).toBe('SECRET');
  });

  it('PERSON_NAME via label "Passenger Name" + id', () => {
    el('label', { for: 'passengerName' }).textContent = 'Passenger Name';
    const input = el('input', { id: 'passengerName', type: 'text', name: 'name' });
    const signals = extractEvidence(input);
    const result = scoreAndCombine('name-test', signals);
    expect(result.piiType).toBe('PERSON_NAME');
    expect(result.sensitivity).toBe('PERSONAL');
  });

  it('DATE_OF_BIRTH via label "Date of Birth"', () => {
    el('label', { for: 'dob-input' }).textContent = 'Date of Birth';
    const input = el('input', { id: 'dob-input', type: 'date' });
    const signals = extractEvidence(input);
    const result = scoreAndCombine('dob-test', signals);
    expect(result.piiType).toBe('DATE_OF_BIRTH');
    expect(result.sensitivity).toBe('PERSONAL');
  });

  it('ADDRESS via autocomplete="street-address"', () => {
    const input = el('input', { autocomplete: 'street-address' });
    const signals = extractEvidence(input);
    const result = scoreAndCombine('addr-test', signals);
    expect(result.piiType).toBe('ADDRESS');
    expect(result.sensitivity).toBe('PERSONAL');
  });

  it('context inference: type="text" + label "Email Address" → EMAIL', () => {
    el('label', { for: 'ctx-email' }).textContent = 'Email Address';
    const input = el('input', { id: 'ctx-email', type: 'text' });
    const signals = extractEvidence(input);
    const result = scoreAndCombine('ctx-test', signals);
    expect(result.piiType).toBe('EMAIL');
  });

  it('low evidence: bare id-only input → NONE', () => {
    el('input', { id: 'field123', type: 'text' });
    const input = document.getElementById('field123')!;
    const signals = extractEvidence(input);
    const result = scoreAndCombine('bare-test', signals);
    // "field123" normalized is "field123" — no keyword match
    expect(result.piiType).toBe('NONE');
  });

  it('multi-signal yields HIGH confidence', () => {
    el('label', { for: 'multi-email' }).textContent = 'Your Email';
    const input = el('input', {
      id: 'multi-email',
      type: 'email',
      name: 'email',
      autocomplete: 'email',
      placeholder: 'Enter email',
    });
    const signals = extractEvidence(input);
    const result = scoreAndCombine('multi-test', signals);
    expect(result.piiType).toBe('EMAIL');
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
  });
});

// ─── False Positive Corpus (§10) ──────────────────────────────────

describe('false positive corpus', () => {
  it('flight price "₹4,200" → NONE/_PUBLIC', () => {
    const span = el('span');
    span.textContent = '₹4,200';
    const signals = extractEvidence(span);
    const result = scoreAndCombine('price-test', signals);
    expect(['NONE', 'PUBLIC']).toContain(result.sensitivity);
  });

  it('flight number "SG410" → NONE/PUBLIC', () => {
    const span = el('span');
    span.textContent = 'SG410';
    const signals = extractEvidence(span);
    const result = scoreAndCombine('flight-test', signals);
    expect(['NONE', 'PUBLIC']).toContain(result.sensitivity);
  });

  it('"Economy" → NONE/PUBLIC', () => {
    const span = el('span');
    span.textContent = 'Economy';
    const signals = extractEvidence(span);
    const result = scoreAndCombine('econ-test', signals);
    expect(['NONE', 'PUBLIC']).toContain(result.sensitivity);
  });

  it('"Air India" → NONE/PUBLIC', () => {
    const span = el('span');
    span.textContent = 'Air India';
    const signals = extractEvidence(span);
    const result = scoreAndCombine('airline-test', signals);
    expect(['NONE', 'PUBLIC']).toContain(result.sensitivity);
  });

  it('a bare input with no evidence → NONE', () => {
    el('input', { type: 'text' });
    const input = document.querySelector('input')!;
    const signals = extractEvidence(input);
    const result = scoreAndCombine('bare-test-2', signals);
    expect(result.piiType).toBe('NONE');
  });
});
