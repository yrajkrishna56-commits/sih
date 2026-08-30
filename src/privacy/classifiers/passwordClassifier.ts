/**
 * Password classifier — identifies PASSWORD PII type from evidence signals.
 * Pure function: EvidenceSignal[] → filtered signals for PASSWORD.
 *
 * SECURITY: Does NOT attempt to infer passwords from value content.
 * Relies solely on DOM semantics (type="password", autocomplete, label).
 */

import type { EvidenceSignal } from '../privacyTypes';

/**
 * Filter evidence signals that suggest PASSWORD classification.
 */
export function classifyPassword(signals: EvidenceSignal[]): EvidenceSignal[] {
  return signals.filter(s => s.suggestedType === 'PASSWORD');
}
