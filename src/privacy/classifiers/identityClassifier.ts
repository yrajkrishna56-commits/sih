/**
 * Identity classifier — identifies PERSON_NAME, PASSPORT_NUMBER,
 * NATIONAL_ID, TAX_ID from evidence signals.
 * Pure function: EvidenceSignal[] → filtered signals for identity types.
 */

import type { EvidenceSignal, PIIType } from '../privacyTypes';

const IDENTITY_TYPES: PIIType[] = [
  'PERSON_NAME',
  'PASSPORT_NUMBER',
  'NATIONAL_ID',
  'TAX_ID',
];

/**
 * Filter evidence signals that suggest identity-related classification.
 */
export function classifyIdentity(signals: EvidenceSignal[]): EvidenceSignal[] {
  return signals.filter(s => IDENTITY_TYPES.includes(s.suggestedType));
}
