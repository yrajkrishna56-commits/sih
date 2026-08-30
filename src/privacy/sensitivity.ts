/**
 * PIIType → SensitivityLevel mapping.
 *
 * Single exported constant table. Phase 3 reads from this seam.
 * Do not scatter sensitivity logic across classifiers.
 */

import type { PIIType, SensitivityLevel } from './privacyTypes';

/**
 * Default sensitivity for each PII type.
 * Defined as a const object so it's immutable and tree-shakeable.
 */
export const SENSITIVITY_MAP: Record<PIIType, SensitivityLevel> = {
  NONE:             'PUBLIC',
  PERSON_NAME:      'PERSONAL',
  EMAIL:            'PERSONAL',
  PHONE:            'PERSONAL',
  ADDRESS:          'PERSONAL',
  PASSWORD:         'SECRET',
  CARD_NUMBER:      'SECRET',
  CARD_EXPIRY:      'SECRET',
  CVV:              'SECRET',
  BANK_ACCOUNT:     'SECRET',
  PASSPORT_NUMBER:  'SECRET',
  NATIONAL_ID:      'SECRET',
  TAX_ID:           'SECRET',
  DATE_OF_BIRTH:    'PERSONAL',
  LOCATION:         'PERSONAL',
};

/**
 * Convenience: get sensitivity for a PII type.
 */
export function getSensitivity(piiType: PIIType): SensitivityLevel {
  return SENSITIVITY_MAP[piiType] ?? 'PUBLIC';
}

/**
 * Sensitivity → display color (used by highlighter and side panel).
 * Defined here so Phase 3+ can reuse the same palette.
 */
export const SENSITIVITY_COLORS: Record<SensitivityLevel, string> = {
  PUBLIC:     '#4CAF50',  // green
  CONTEXTUAL: '#FF9800',  // orange
  PERSONAL:   '#F44336',  // red
  SECRET:     '#9C27B0',  // purple
};
