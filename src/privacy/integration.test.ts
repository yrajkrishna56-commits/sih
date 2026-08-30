/**
 * Integration test — runs the full privacy detection pipeline against
 * the Phase 1 synthetic flight-booking demo site's HTML structure.
 *
 * This validates that all required PII types are detected and that
 * non-PII elements are NOT misclassified.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { extractEvidence } from './evidenceExtractor';
import { scoreAndCombine } from './confidence';
import type { PrivacyAssessment } from './privacyTypes';

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  document.body.innerHTML = '';
});

/**
 * Helper: build the demo site's form HTML in jsdom and classify all inputs.
 */
function buildDemoSite(): PrivacyAssessment[] {
  document.body.innerHTML = `
    <form id="searchForm">
      <label for="fromCity">From</label>
      <select id="fromCity" name="from"><option>Mumbai (BOM)</option></select>
      <label for="toCity">To</label>
      <select id="toCity" name="to"><option>Delhi (DEL)</option></select>
      <label for="travelDate">Date</label>
      <input type="date" id="travelDate" name="date" />
      <label for="passengers">Passengers</label>
      <select id="passengers" name="passengers"><option>1 Adult</option></select>
      <button type="submit" id="searchBtn">Search Flights</button>
    </form>

    <form id="passengerForm">
      <label for="passengerName">Full Name</label>
      <input type="text" id="passengerName" name="name" placeholder="As on ID proof" />

      <label for="passengerEmail">Email</label>
      <input type="email" id="passengerEmail" name="email" placeholder="you@example.com" />

      <label for="passengerPhone">Phone</label>
      <input type="tel" id="passengerPhone" name="phone" placeholder="+91-XXXXXXXXXX" />

      <label for="passengerPassport">Passport Number</label>
      <input type="text" id="passengerPassport" name="passport" placeholder="e.g. X0000000" />

      <label for="passengerDob">Date of Birth</label>
      <input type="date" id="passengerDob" name="dob" />

      <label for="nationality">Nationality</label>
      <select id="nationality" name="nationality"><option>Indian</option></select>
    </form>

    <form id="paymentForm">
      <label for="cardNumber">Card Number</label>
      <input type="text" id="cardNumber" name="cardNumber" placeholder="XXXX XXXX XXXX XXXX" />

      <label for="cardName">Cardholder Name</label>
      <input type="text" id="cardName" name="cardName" placeholder="Name on card" />

      <label for="cardExpiry">Expiry Date</label>
      <input type="text" id="cardExpiry" name="expiry" placeholder="MM/YY" />

      <label for="cardCvv">CVV</label>
      <input type="password" id="cardCvv" name="cvv" placeholder="***" />
    </form>

    <span class="price">₹4,250</span>
    <span class="flight-id">SB 101</span>
    <span class="airline">SkyBook Airways</span>
  `;

  // Classify all input-like elements
  const inputs = document.querySelectorAll('input, select, textarea');
  const assessments: PrivacyAssessment[] = [];

  for (const input of inputs) {
    const signals = extractEvidence(input);
    const id = input.id || input.getAttribute('name') || 'unknown';
    const result = scoreAndCombine(id, signals);
    assessments.push(result);
  }

  return assessments;
}

describe('integration: demo site classification', () => {
  let assessments: PrivacyAssessment[];

  beforeEach(() => {
    assessments = buildDemoSite();
  });

  it('classifies passengerEmail as EMAIL', () => {
    const a = assessments.find(x => x.elementId === 'passengerEmail');
    expect(a).toBeDefined();
    expect(a!.piiType).toBe('EMAIL');
    expect(a!.sensitivity).toBe('PERSONAL');
    expect(a!.confidence).toBeGreaterThanOrEqual(0.40);
    expect(a!.evidence.length).toBeGreaterThan(0);
  });

  it('classifies passengerPhone as PHONE', () => {
    const a = assessments.find(x => x.elementId === 'passengerPhone');
    expect(a).toBeDefined();
    expect(a!.piiType).toBe('PHONE');
    expect(a!.sensitivity).toBe('PERSONAL');
    expect(a!.confidence).toBeGreaterThanOrEqual(0.40);
  });

  it('classifies passengerName as PERSON_NAME', () => {
    const a = assessments.find(x => x.elementId === 'passengerName');
    expect(a).toBeDefined();
    expect(a!.piiType).toBe('PERSON_NAME');
    expect(a!.sensitivity).toBe('PERSONAL');
    expect(a!.confidence).toBeGreaterThanOrEqual(0.40);
  });

  it('classifies passengerPassport as PASSPORT_NUMBER', () => {
    const a = assessments.find(x => x.elementId === 'passengerPassport');
    expect(a).toBeDefined();
    expect(a!.piiType).toBe('PASSPORT_NUMBER');
    expect(a!.sensitivity).toBe('SECRET');
    expect(a!.confidence).toBeGreaterThanOrEqual(0.40);
  });

  it('classifies cardCvv as CVV (label wins over type="password")', () => {
    const a = assessments.find(x => x.elementId === 'cardCvv');
    expect(a).toBeDefined();
    // label "CVV" + name="cvv" beats type="password" → CVV is more specific
    expect(a!.piiType).toBe('CVV');
    expect(a!.sensitivity).toBe('SECRET');
    expect(a!.confidence).toBeGreaterThanOrEqual(0.40);
  });

  it('classifies cardNumber with card-related keywords', () => {
    const a = assessments.find(x => x.elementId === 'cardNumber');
    expect(a).toBeDefined();
    // label "Card Number" matches CARD_NUMBER keywords
    expect(a!.piiType).toBe('CARD_NUMBER');
    expect(a!.sensitivity).toBe('SECRET');
    expect(a!.confidence).toBeGreaterThanOrEqual(0.40);
  });

  it('classifies cardExpiry as CARD_EXPIRY', () => {
    const a = assessments.find(x => x.elementId === 'cardExpiry');
    expect(a).toBeDefined();
    expect(a!.piiType).toBe('CARD_EXPIRY');
    expect(a!.sensitivity).toBe('SECRET');
    expect(a!.confidence).toBeGreaterThanOrEqual(0.40);
  });

  it('classifies cardName as PERSON_NAME', () => {
    const a = assessments.find(x => x.elementId === 'cardName');
    expect(a).toBeDefined();
    // label "Cardholder Name" matches PERSON_NAME keywords
    expect(a!.piiType).toBe('PERSON_NAME');
    expect(a!.sensitivity).toBe('PERSONAL');
    expect(a!.confidence).toBeGreaterThanOrEqual(0.40);
  });

  it('classifies passengerDob as DATE_OF_BIRTH', () => {
    const a = assessments.find(x => x.elementId === 'passengerDob');
    expect(a).toBeDefined();
    expect(a!.piiType).toBe('DATE_OF_BIRTH');
    expect(a!.sensitivity).toBe('PERSONAL');
    expect(a!.confidence).toBeGreaterThanOrEqual(0.40);
  });

  it('non-PII selects (fromCity, toCity, nationality, passengers) → NONE', () => {
    const nonPiiIds = ['fromCity', 'toCity', 'nationality', 'passengers'];
    for (const id of nonPiiIds) {
      const a = assessments.find(x => x.elementId === id);
      expect(a).toBeDefined();
      expect(a!.piiType).toBe('NONE');
    }
  });

  it('every assessment has confidence, evidence, and detectionMethods', () => {
    for (const a of assessments) {
      expect(typeof a.confidence).toBe('number');
      expect(Array.isArray(a.evidence)).toBe(true);
      expect(Array.isArray(a.detectionMethods)).toBe(true);
      expect(typeof a.explanation).toBe('string');
    }
  });
});
