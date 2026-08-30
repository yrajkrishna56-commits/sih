/**
 * PII Detector — orchestrator.
 *
 * Pipeline: DOM element → EvidenceSignal[] → classifiers → scoreAndCombine → PrivacyAssessment
 *
 * This module touches the DOM (via evidenceExtractor). Everything downstream
 * (classifiers, confidence) is pure.
 *
 * SECURITY INVARIANT: No data leaves window context except via extension messaging.
 * No sensitive field values are read from elements — only static metadata.
 */

import type { PrivacyAssessment, PrivacyAnalysis } from './privacyTypes';
import type { PageRepresentation } from '../shared/types';
import { extractEvidence } from './evidenceExtractor';
import { scoreAndCombine } from './confidence';

/**
 * Tags considered "input-like" for privacy classification.
 * We classify these elements; headings, links, buttons, etc. are skipped.
 */
const INPUT_LIKE_TAGS = new Set(['INPUT', 'SELECT', 'TEXTAREA']);

/**
 * Elements that are purely structural (forms, sections) are analyzed
 * only for context, not as primary PII targets.
 */
const STRUCTURAL_TAGS = new Set(['FORM', 'SECTION', 'ARTICLE', 'NAV', 'MAIN', 'ASIDE', 'FIELDSET']);

/**
 * Classify a single DOM element.
 * Returns a PrivacyAssessment, or null if the element is not input-like.
 */
function classifyElement(element: Element): PrivacyAssessment | null {
  const tag = element.tagName;

  // Only classify input-like elements (inputs, selects, textareas)
  // plus elements with input-like roles
  const role = element.getAttribute('role');
  if (!INPUT_LIKE_TAGS.has(tag) && role !== 'textbox' && role !== 'combobox') {
    return null;
  }

  // Extract evidence from the live DOM element
  const signals = extractEvidence(element);

  // Generate a stable ID for this element (reuse Phase 1's strategy)
  const elementId = element.getAttribute('data-ppba-id') || element.id || 'unknown';

  // Score and combine signals into an assessment
  return scoreAndCombine(elementId, signals);
}

/**
 * Run the full PII detection pipeline on a page representation.
 * Uses the PageRepresentation's element list to find DOM elements,
 * then classifies each one.
 *
 * @param pageRepresentation - Phase 1's extraction result
 * @returns PrivacyAnalysis with per-element assessments
 */
export function detectPII(pageRepresentation: PageRepresentation): PrivacyAnalysis {
  const assessments: PrivacyAssessment[] = [];

  // We need to work with the live DOM to read element attributes
  // that Phase 1 already extracted IDs for
  for (const pageElement of pageRepresentation.elements) {
    // Find the live DOM element by its ID
    const domElement = document.querySelector(`[data-ppba-id="${CSS.escape(pageElement.id)}"]`)
      || (pageElement.id ? document.getElementById(pageElement.id) : null);

    if (!domElement) continue;

    const assessment = classifyElement(domElement);
    if (assessment) {
      assessments.push(assessment);
    }
  }

  // Build page-level summary
  let publicCount = 0;
  let contextualCount = 0;
  let personalCount = 0;
  let secretCount = 0;
  let piiCount = 0;

  for (const a of assessments) {
    switch (a.sensitivity) {
      case 'PUBLIC': publicCount++; break;
      case 'CONTEXTUAL': contextualCount++; break;
      case 'PERSONAL': personalCount++; break;
      case 'SECRET': secretCount++; break;
    }
    if (a.piiType !== 'NONE') piiCount++;
  }

  return {
    timestamp: Date.now(),
    totalAnalyzed: assessments.length,
    publicCount,
    contextualCount,
    personalCount,
    secretCount,
    piiCount,
    assessments,
  };
}
