/**
 * Card classifier — identifies CARD_NUMBER, CARD_EXPIRY, CVV from evidence signals.
 * Pure function: EvidenceSignal[] → filtered signals for card-related types.
 */

import type { EvidenceSignal, PIIType } from '../privacyTypes';

const CARD_TYPES: PIIType[] = ['CARD_NUMBER', 'CARD_EXPIRY', 'CVV'];

/**
 * Filter evidence signals that suggest card-related classification.
 */
export function classifyCard(signals: EvidenceSignal[]): EvidenceSignal[] {
  return signals.filter(s => CARD_TYPES.includes(s.suggestedType));
}
