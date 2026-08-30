/**
 * Generic classifier — identifies ADDRESS, DATE_OF_BIRTH, LOCATION
 * and handles the NONE fallback.
 * Pure function: EvidenceSignal[] → filtered signals for these types.
 */

import type { EvidenceSignal, PIIType } from '../privacyTypes';

const GENERIC_TYPES: PIIType[] = ['ADDRESS', 'DATE_OF_BIRTH', 'LOCATION'];

/**
 * Filter evidence signals that suggest generic personal classification.
 */
export function classifyGeneric(signals: EvidenceSignal[]): EvidenceSignal[] {
  return signals.filter(s => GENERIC_TYPES.includes(s.suggestedType));
}
