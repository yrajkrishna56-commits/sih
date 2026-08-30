/**
 * Label / keyword rules — data table.
 * Maps keyword substrings in label/name/id/placeholder text to PII types.
 * Case-insensitive, hyphen/underscore/space-normalized.
 */

import type { PIIType, DetectionMethod } from '../privacyTypes';
import { WEIGHT_MEDIUM } from '../confidence';

export interface LabelRule {
  keywords: string[];
  piiType: PIIType;
  weight: number;
}

export const LABEL_RULES: LabelRule[] = [
  { keywords: ['email', 'e-mail'],                                       piiType: 'EMAIL',           weight: WEIGHT_MEDIUM },
  { keywords: ['phone', 'mobile', 'telephone', 'contact number', 'contact no'], piiType: 'PHONE',    weight: WEIGHT_MEDIUM },
  { keywords: ['full name', 'passenger name', 'first name', 'last name', 'cardholder name', 'name on card', 'your name'], piiType: 'PERSON_NAME', weight: WEIGHT_MEDIUM },
  { keywords: ['address', 'street', 'home address', 'billing address'], piiType: 'ADDRESS',         weight: WEIGHT_MEDIUM },
  { keywords: ['passport', 'passport number', 'passport no'],           piiType: 'PASSPORT_NUMBER', weight: WEIGHT_MEDIUM },
  { keywords: ['card number', 'credit card', 'debit card', 'card no'],  piiType: 'CARD_NUMBER',     weight: WEIGHT_MEDIUM },
  { keywords: ['expiry', 'expiration', 'exp date', 'valid thru'],       piiType: 'CARD_EXPIRY',     weight: WEIGHT_MEDIUM },
  { keywords: ['cvv', 'cvc', 'security code', 'card verification'],     piiType: 'CVV',             weight: WEIGHT_MEDIUM },
  { keywords: ['password', 'passcode', 'pin code'],                     piiType: 'PASSWORD',        weight: WEIGHT_MEDIUM },
  { keywords: ['date of birth', 'dob', 'birth date', 'birthday', 'born'], piiType: 'DATE_OF_BIRTH', weight: WEIGHT_MEDIUM },
];
