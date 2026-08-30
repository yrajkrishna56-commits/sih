/**
 * Pattern rules — regex and algorithmic detection.
 * These run against static evidence text (label/name/id/placeholder).
 * Value patterns are optional weak signals.
 */

import type { PIIType, DetectionMethod, EvidenceSignal } from '../privacyTypes';
import { WEIGHT_STRONG, WEIGHT_WEAK } from '../confidence';

// ─── Luhn Checksum ─────────────────────────────────────────────────

/**
 * Validate a credit card number using the Luhn algorithm.
 * Returns true if the number passes the checksum.
 */
export function luhnCheck(num: string): boolean {
  const digits = num.replace(/\D/g, '');
  if (digits.length < 13 || digits.length > 19) return false;

  let sum = 0;
  let alternate = false;

  for (let i = digits.length - 1; i >= 0; i--) {
    let n = parseInt(digits[i]!, 10);
    if (isNaN(n)) return false;

    if (alternate) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alternate = !alternate;
  }

  return sum % 10 === 0;
}

// ─── Email Pattern ─────────────────────────────────────────────────

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

/**
 * Test if text looks like an email address.
 */
export function isEmailPattern(text: string): boolean {
  return EMAIL_REGEX.test(text);
}

// ─── Phone Pattern ─────────────────────────────────────────────────

/**
 * Weak phone pattern: 7–15 digits after stripping separators.
 * This alone is weak evidence — must combine with label/type/autocomplete.
 */
export function isPhonePattern(text: string): boolean {
  const digits = text.replace(/[\s\-()+ ]/g, '');
  return /^\d{7,15}$/.test(digits);
}

// ─── Card Number Pattern ───────────────────────────────────────────

/**
 * Strong card pattern: 13–19 digits (stripped) that pass Luhn.
 */
export function isCardPattern(text: string): boolean {
  const digits = text.replace(/\D/g, '');
  return luhnCheck(digits);
}

// ─── Pattern Application ───────────────────────────────────────────

export interface PatternRule {
  name: string;
  test: (text: string) => boolean;
  piiType: PIIType;
  method: DetectionMethod;
  weight: number;
}

export const PATTERN_RULES: PatternRule[] = [
  {
    name: 'EMAIL',
    test: isEmailPattern,
    piiType: 'EMAIL',
    method: 'PATTERN',
    weight: WEIGHT_STRONG,
  },
  {
    name: 'PHONE',
    test: isPhonePattern,
    piiType: 'PHONE',
    method: 'PATTERN',
    weight: WEIGHT_WEAK,
  },
  {
    name: 'CARD_NUMBER',
    test: isCardPattern,
    piiType: 'CARD_NUMBER',
    method: 'VALUE_STRUCTURE',
    weight: WEIGHT_STRONG,
  },
];

/**
 * Apply pattern rules to a text string, producing evidence signals.
 */
export function applyPatternRules(text: string): EvidenceSignal[] {
  const signals: EvidenceSignal[] = [];
  for (const rule of PATTERN_RULES) {
    if (rule.test(text)) {
      signals.push({
        method: rule.method,
        matchedValue: text.slice(0, 50), // truncate for safety
        suggestedType: rule.piiType,
        weight: rule.weight,
      });
    }
  }
  return signals;
}
