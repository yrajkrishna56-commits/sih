/**
 * Task analyzer — takes raw task text and produces a TaskAnalysisResult.
 *
 * Uses the same evidence → classification → confidence → explanation
 * pattern established in Phase 2 — consistency across phases.
 *
 * Deterministic, not an LLM. String matching only.
 *
 * SECURITY INVARIANT: This module operates on user-provided task text only.
 * It does not access the DOM, PageRepresentation, or PrivacyAnalysis.
 */

import type { TaskIntent, TaskAnalysisResult, DomainConcept } from './taskTypes';
import { INTENT_RULES, INTENT_REQUIRED_CONCEPTS } from './intentRules';
import { extractEntities } from './entityExtractor';

/**
 * Confidence floor — below this threshold, no intent is forced.
 * If no keyword matches fire, the result is UNKNOWN with low confidence.
 */
const CONFIDENCE_FLOOR = 0.40;

/** Confidence bands for UI */
export const CONFIDENCE_HIGH = 0.85;
export const CONFIDENCE_MEDIUM = 0.60;
export const CONFIDENCE_LOW = 0.40;

/**
 * Returns a human-readable confidence band label.
 */
export function taskConfidenceBand(score: number): string {
  if (score >= CONFIDENCE_HIGH) return 'HIGH';
  if (score >= CONFIDENCE_MEDIUM) return 'MEDIUM';
  if (score >= CONFIDENCE_LOW) return 'LOW';
  return 'UNCLASSIFIED';
}

/**
 * Normalize text for keyword matching (same as Phase 2's normalizeText).
 */
function normalizeText(text: string): string {
  return text
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Analyze a task string and produce a TaskAnalysisResult.
 *
 * Pipeline:
 * 1. Normalize text
 * 2. Score each intent against keyword rules
 * 3. Pick the highest-scoring intent (if above floor)
 * 4. Extract entities (origin/destination)
 * 5. Map intent → required concepts
 * 6. Build explanation
 */
export function analyzeTask(taskText: string): TaskAnalysisResult {
  const normalized = normalizeText(taskText);

  // Score each intent
  const intentScores = new Map<TaskIntent, { score: number; matchedKeywords: string[] }>();

  for (const rule of INTENT_RULES) {
    let score = 0;
    const matched: string[] = [];

    for (const keyword of rule.keywords) {
      if (normalized.includes(keyword)) {
        score += rule.weight;
        matched.push(keyword);
      }
    }

    // Deduplicate: same keyword matching multiple rules within an intent
    if (score > 0) {
      intentScores.set(rule.intent, { score: Math.min(score, 1.0), matchedKeywords: matched });
    }
  }

  // Sort by score descending
  const sorted = Array.from(intentScores.entries())
    .sort((a, b) => b[1].score - a[1].score);

  // Pick the top intent, or UNKNOWN if nothing clears the floor
  let intent: TaskIntent = 'UNKNOWN';
  let confidence = 0;
  let matchedKeywords: string[] = [];

  if (sorted.length > 0 && sorted[0]![1].score >= CONFIDENCE_FLOOR) {
    intent = sorted[0]![0];
    confidence = sorted[0]![1].score;
    matchedKeywords = sorted[0]![1].matchedKeywords;
  }

  // Extract entities
  const entities = extractEntities(taskText);

  // Map intent → required concepts
  const requiredConcepts = INTENT_REQUIRED_CONCEPTS[intent];

  // Build explanation
  let explanation: string;
  if (intent === 'UNKNOWN') {
    if (sorted.length === 0) {
      explanation = 'No recognizable keywords found in task text. Result: UNKNOWN with low confidence.';
    } else {
      const bestIntent = sorted[0]![0];
      const bestScore = sorted[0]![1].score;
      explanation = `Best match was ${bestIntent} (${Math.round(bestScore * 100)}%) but below confidence floor (${Math.round(CONFIDENCE_FLOOR * 100)}%). Result: UNKNOWN.`;
    }
  } else {
    explanation = `Detected intent: ${intent} (${Math.round(confidence * 100)}% confidence). Matched keywords: ${matchedKeywords.join(', ')}.`;
    if (entities.origin || entities.destination) {
      const parts: string[] = [];
      if (entities.origin) parts.push(`origin: ${entities.origin}`);
      if (entities.destination) parts.push(`destination: ${entities.destination}`);
      explanation += ` Entities: ${parts.join(', ')}.`;
    }
    explanation += ` Requires ${requiredConcepts.length} concepts.`;
  }

  return {
    rawText: taskText,
    intent,
    confidence,
    entities,
    requiredConcepts,
    explanation,
  };
}
