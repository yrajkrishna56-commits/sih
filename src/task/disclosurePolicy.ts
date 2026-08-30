/**
 * Disclosure Policy Engine — the decision matrix.
 *
 * Evaluates every element that has a Phase 2 sensitivity AND/OR
 * a Phase 3 concept tag. Applies decisions in this exact order:
 *
 * 1. Task intent is UNKNOWN → EXCLUDE (conservative default)
 *    except PUBLIC static content → may ALLOW
 * 2. Concept not in requiredConcepts → EXCLUDE (NOT_TASK_RELEVANT)
 * 3. Concept required + SECRET → BLOCK (SECRET_ALWAYS_BLOCKED)
 * 4. Concept required + PERSONAL → MINIMIZE (no raw values)
 * 5. Concept required + CONTEXTUAL → ALLOW (may TRANSFORM if transform exists)
 * 6. Concept required + PUBLIC → ALLOW
 *
 * Implemented as a switch over (taskIntentKnown, isRequired, sensitivity).
 * This matrix is point-at-able during demo Q&A.
 *
 * SECURITY INVARIANT: Decisions are made from Phase 2's classification
 * + Phase 3's concept tag + task requirements — all metadata, never values.
 * The engine never needs a sensitive element's runtime value.
 */

import type {
  TaskIntent,
  DomainConcept,
  DisclosureDecision,
  DisclosureReason,
  DisclosureRuling,
  DisclosurePlan,
  TaskAnalysisResult,
} from './taskTypes';
import type { PageElement } from '../shared/types';
import type { PrivacyAssessment } from '../privacy/privacyTypes';
import type { SensitivityLevel } from '../privacy/privacyTypes';
import { getSensitivity } from '../privacy/sensitivity';

/**
 * A tagged element ready for disclosure evaluation.
 * Combines Phase 1 element + Phase 2 assessment + Phase 3 concept.
 */
export interface TaggedElement {
  elementId: string;
  concept: DomainConcept;
  sensitivity: SensitivityLevel;
  piiType: string;
  tagName: string;
  text?: string;
  label?: string;
  boundingBox?: { x: number; y: number; width: number; height: number };
}

/**
 * Build a TaggedElement from Phase 1/2/3 data.
 */
export function buildTaggedElement(
  element: PageElement,
  assessment: PrivacyAssessment | undefined,
  concept: DomainConcept,
): TaggedElement {
  return {
    elementId: element.id,
    concept,
    sensitivity: assessment !== undefined ? assessment.sensitivity : getSensitivity('NONE'),
    piiType: assessment !== undefined ? assessment.piiType : 'NONE',
    tagName: element.tagName,
    text: element.text,
    label: element.label,
    boundingBox: element.boundingBox,
  };
}

/**
 * Apply the disclosure decision matrix to a single tagged element.
 *
 * Order of evaluation (§5 from spec):
 * 1. UNKNOWN task → conservative EXCLUDE (except PUBLIC static)
 * 2. Not required → EXCLUDE
 * 3. SECRET + required → BLOCK
 * 4. PERSONAL + required → MINIMIZE
 * 5. CONTEXTUAL + required → ALLOW
 * 6. PUBLIC + required → ALLOW
 */
export function evaluateDisclosure(
  tagged: TaggedElement,
  taskAnalysis: TaskAnalysisResult,
): DisclosureRuling {
  const taskIntentKnown = taskAnalysis.intent !== 'UNKNOWN';
  const isRequired = taskAnalysis.requiredConcepts.includes(tagged.concept);

  // Rule 1: UNKNOWN task → conservative default
  if (!taskIntentKnown) {
    // PUBLIC static content may be allowed
    if (tagged.sensitivity === 'PUBLIC' && tagged.concept === 'UNKNOWN') {
      return {
        elementId: tagged.elementId,
        concept: tagged.concept,
        decision: 'ALLOW',
        reason: 'TASK_REQUIRES_CONCEPT',
        explanation: 'PUBLIC static content allowed even under UNKNOWN task.',
      };
    }
    return {
      elementId: tagged.elementId,
      concept: tagged.concept,
      decision: 'EXCLUDE',
      reason: 'UNKNOWN_TASK_CONSERVATIVE_EXCLUDE',
      explanation: 'UNKNOWN task — conservatively excluding all non-PUBLIC static content.',
    };
  }

  // Rule 2: Concept not required → EXCLUDE
  if (!isRequired) {
    return {
      elementId: tagged.elementId,
      concept: tagged.concept,
      decision: 'EXCLUDE',
      reason: 'NOT_TASK_RELEVANT',
      explanation: `Concept ${tagged.concept} is not required for intent ${taskAnalysis.intent}.`,
    };
  }

  // Rule 3: SECRET + required → BLOCK (unconditional)
  if (tagged.sensitivity === 'SECRET') {
    return {
      elementId: tagged.elementId,
      concept: tagged.concept,
      decision: 'BLOCK',
      reason: 'SECRET_ALWAYS_BLOCKED',
      explanation: `SECRET tier data is always blocked regardless of task relevance. Concept: ${tagged.concept}.`,
    };
  }

  // Rule 4: PERSONAL + required → MINIMIZE
  if (tagged.sensitivity === 'PERSONAL') {
    // Check if a real transform function exists for this concept
    const transformFn = getTransformFunction(tagged.concept);
    if (transformFn) {
      return {
        elementId: tagged.elementId,
        concept: tagged.concept,
        decision: 'TRANSFORM',
        reason: 'PERSONAL_DATA_MINIMIZED',
        explanation: `PERSONAL data for concept ${tagged.concept} will be transformed (generalized).`,
      };
    }
    return {
      elementId: tagged.elementId,
      concept: tagged.concept,
      decision: 'MINIMIZE',
      reason: 'PERSONAL_DATA_MINIMIZED',
      explanation: `PERSONAL data for concept ${tagged.concept} is minimized — label and metadata included, value excluded.`,
    };
  }

  // Rule 5: CONTEXTUAL + required → ALLOW (may TRANSFORM)
  if (tagged.sensitivity === 'CONTEXTUAL') {
    const transformFn = getTransformFunction(tagged.concept);
    if (transformFn) {
      return {
        elementId: tagged.elementId,
        concept: tagged.concept,
        decision: 'TRANSFORM',
        reason: 'CONTEXTUAL_DATA_GENERALIZED',
        explanation: `CONTEXTUAL data for concept ${tagged.concept} will be transformed (generalized).`,
      };
    }
    return {
      elementId: tagged.elementId,
      concept: tagged.concept,
      decision: 'ALLOW',
      reason: 'TASK_REQUIRES_CONCEPT',
      explanation: `CONTEXTUAL data for concept ${tagged.concept} is allowed for task ${taskAnalysis.intent}.`,
    };
  }

  // Rule 6: PUBLIC + required → ALLOW
  return {
    elementId: tagged.elementId,
    concept: tagged.concept,
    decision: 'ALLOW',
    reason: 'TASK_REQUIRES_CONCEPT',
    explanation: `PUBLIC data for concept ${tagged.concept} is allowed for task ${taskAnalysis.intent}.`,
  };
}

/**
 * Get a transform/generalization function for a concept, if one exists.
 * Returns null if no transform is implemented — meaning MINIMIZE is the
 * correct decision, not TRANSFORM.
 *
 * IMPORTANT: Do not claim a transform that isn't implemented.
 * Only return a function here if there's actual generalization logic.
 */
function getTransformFunction(concept: DomainConcept): ((value: string) => string) | null {
  switch (concept) {
    case 'TRAVEL_DATE':
      // Transform: exact date → month-level granularity
      return (value: string) => {
        // Attempt to parse and generalize
        const match = value.match(/(\d{4})-(\d{2})-(\d{2})/);
        if (match) {
          const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                         'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          const monthIndex = parseInt(match[2]!, 10) - 1;
          return `${months[monthIndex]} ${match[1]}`;
        }
        return value; // Can't transform, pass through
      };

    case 'DEPARTURE_TIME':
    case 'ARRIVAL_TIME':
      // Transform: exact time → rounded to the hour
      return (value: string) => {
        const match = value.match(/(\d{1,2}):(\d{2})/);
        if (match) {
          return `${match[1]}:00`;
        }
        return value;
      };

    default:
      return null;
  }
}

/**
 * Run the full disclosure evaluation pipeline.
 * Returns a DisclosurePlan with per-element rulings and summary counts.
 */
export function evaluateDisclosurePlan(
  taggedElements: TaggedElement[],
  taskAnalysis: TaskAnalysisResult,
): DisclosurePlan {
  const rulings: DisclosureRuling[] = [];
  let allowed = 0;
  let minimized = 0;
  let excluded = 0;
  let blocked = 0;

  for (const tagged of taggedElements) {
    const ruling = evaluateDisclosure(tagged, taskAnalysis);
    rulings.push(ruling);

    switch (ruling.decision) {
      case 'ALLOW': allowed++; break;
      case 'MINIMIZE': minimized++; break;
      case 'TRANSFORM': minimized++; break;
      case 'EXCLUDE': excluded++; break;
      case 'BLOCK': blocked++; break;
    }
  }

  return {
    taskAnalysis,
    rulings,
    summary: { allowed, minimized, excluded, blocked },
  };
}
