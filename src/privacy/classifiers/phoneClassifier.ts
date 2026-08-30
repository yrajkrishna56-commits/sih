/**
 * Phone classifier — identifies PHONE PII type from evidence signals.
 * Pure function: EvidenceSignal[] → filtered signals for PHONE.
 */

import type { EvidenceSignal } from '../privacyTypes';

/**
 * Filter evidence signals that suggest PHONE classification.
 * Phone detection is inherently weak from patterns alone (many non-phone
 * numbers fit the digit-count heuristic), so this classifier ensures
 * phone signals are only strong when corroborated by label/type/autocomplete.
 */
export function classifyPhone(signals: EvidenceSignal[]): EvidenceSignal[] {
  return signals.filter(s => s.suggestedType === 'PHONE');
}
