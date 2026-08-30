/**
 * Email classifier — identifies EMAIL PII type from evidence signals.
 * Pure function: EvidenceSignal[] → filtered signals for EMAIL.
 */

import type { EvidenceSignal } from '../privacyTypes';

/**
 * Filter and weight evidence signals that suggest EMAIL classification.
 * This is a simple pass-through since the evidence extractor and pattern
 * rules already handle email detection. This classifier exists for
 * architectural consistency — Phase 3+ may add email-specific logic.
 */
export function classifyEmail(signals: EvidenceSignal[]): EvidenceSignal[] {
  return signals.filter(s => s.suggestedType === 'EMAIL');
}
