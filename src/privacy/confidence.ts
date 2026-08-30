/**
 * Confidence scoring and evidence combination logic.
 *
 * Algorithm per §9:
 * 1. Group signals by suggestedType.
 * 2. For each group, sum weights (deduplicate by method).
 * 3. Cap at 1.0.
 * 4. Highest score wins if it clears the classification floor (0.40).
 * 5. If no type clears 0.40 → NONE/PUBLIC.
 * 6. Conflict case: if two types within 0.1, note ambiguity.
 */

import type { PIIType, EvidenceSignal, PrivacyAssessment } from './privacyTypes';
import { getSensitivity } from './sensitivity';

// ─── Weight Tiers (tunable constants) ──────────────────────────────

export const WEIGHT_STRONG = 0.50;
export const WEIGHT_MEDIUM = 0.25;
export const WEIGHT_WEAK   = 0.10;

/** Score below which no classification is forced */
export const CLASSIFICATION_FLOOR = 0.40;

/** Confidence bands for UI/tests */
export const CONFIDENCE_HIGH   = 0.85;
export const CONFIDENCE_MEDIUM = 0.60;
export const CONFIDENCE_LOW    = 0.40;

/**
 * Returns a human-readable confidence band label.
 */
export function confidenceBand(score: number): string {
  if (score >= CONFIDENCE_HIGH) return 'HIGH';
  if (score >= CONFIDENCE_MEDIUM) return 'MEDIUM';
  if (score >= CONFIDENCE_LOW) return 'LOW';
  return 'UNCLASSIFIED';
}

// ─── Scoring Algorithm ─────────────────────────────────────────────

interface TypeScore {
  type: PIIType;
  score: number;
  methods: Set<string>;
  signals: EvidenceSignal[];
}

/**
 * Groups evidence signals by suggestedType, deduplicates by method,
 * sums weights, and returns sorted type scores.
 */
function computeTypeScores(signals: EvidenceSignal[]): TypeScore[] {
  const groups = new Map<PIIType, TypeScore>();

  for (const signal of signals) {
    const type = signal.suggestedType;
    if (type === 'NONE') continue;

    let group = groups.get(type);
    if (!group) {
      group = { type, score: 0, methods: new Set(), signals: [] };
      groups.set(type, group);
    }

    // Deduplicate by method within the same type group
    const methodKey = `${signal.method}:${signal.matchedValue.toLowerCase()}`;
    if (!group.methods.has(methodKey)) {
      group.methods.add(methodKey);
      group.score += signal.weight;
      group.signals.push(signal);
    }
  }

  // Cap at 1.0 and sort descending
  return Array.from(groups.values())
    .map(g => ({ ...g, score: Math.min(g.score, 1.0) }))
    .sort((a, b) => b.score - a.score);
}

/**
 * Main combination function. Takes raw evidence signals and produces
 * a PrivacyAssessment for a single element.
 */
export function scoreAndCombine(
  elementId: string,
  signals: EvidenceSignal[],
): PrivacyAssessment {
  const typeScores = computeTypeScores(signals);

  // Get the top type
  const top = typeScores[0];

  // Check if top score clears the classification floor
  if (!top || top.score < CLASSIFICATION_FLOOR) {
    return {
      elementId,
      piiType: 'NONE',
      sensitivity: getSensitivity('NONE'),
      confidence: top?.score ?? 0,
      detectionMethods: [],
      explanation: 'No strong evidence for any PII classification.',
      evidence: signals,
    };
  }

  // Check for close conflicts (within 0.1 of top)
  const runnerUp = typeScores[1];
  let explanation = `Classified as ${top.type} with ${confidenceBand(top.score)} confidence.`;
  if (runnerUp && (top.score - runnerUp.score) < 0.1) {
    explanation += ` Closely matches both ${top.type} and ${runnerUp.type}.`;
  }

  // Collect unique detection methods from winning signals
  const methods = [...new Set(top.signals.map(s => s.method))];

  return {
    elementId,
    piiType: top.type,
    sensitivity: getSensitivity(top.type),
    confidence: top.score,
    detectionMethods: methods,
    explanation,
    evidence: signals,
  };
}
