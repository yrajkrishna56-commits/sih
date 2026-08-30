/**
 * Evidence extraction — reads a live DOM element's attributes, labels,
 * and nearby context to produce raw EvidenceSignal[].
 *
 * This module touches the DOM (it needs attribute/label traversal).
 * Everything downstream of it (classifiers, rules, confidence) is pure.
 *
 * SECURITY INVARIANT: Only reads static page metadata (attribute names,
 * label text, placeholder text). Never reads element.value for evidence.
 */

import type { EvidenceSignal, DetectionMethod } from './privacyTypes';
import { WEIGHT_MEDIUM, WEIGHT_WEAK } from './confidence';

// ─── Text Normalization ────────────────────────────────────────────

/**
 * Normalize text for comparison: lowercase, collapse separators, trim.
 */
export function normalizeText(text: string): string {
  return text
    // Split camelCase: insert space before uppercase letters
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ─── Label Resolution (§6 priority order) ──────────────────────────

/**
 * Resolve the "label text" for an input-like element.
 * Returns all found labels in priority order, each as a separate signal
 * candidate (lower-priority matches recorded as weaker evidence).
 */
function resolveLabels(element: Element): Array<{ text: string; method: DetectionMethod; weight: number }> {
  const results: Array<{ text: string; method: DetectionMethod; weight: number }> = [];
  const htmlEl = element as HTMLInputElement;

  // 1. Explicit <label for="{id}">
  if (htmlEl.id) {
    const label = document.querySelector(`label[for="${CSS.escape(htmlEl.id)}"]`);
    if (label?.textContent?.trim()) {
      results.push({ text: label.textContent.trim(), method: 'LABEL', weight: WEIGHT_MEDIUM });
    }
  }

  // 2. Ancestor <label> wrapping the element
  const wrappingLabel = element.closest('label');
  if (wrappingLabel) {
    const clone = wrappingLabel.cloneNode(true) as HTMLLabelElement;
    const inputs = clone.querySelectorAll('input, select, textarea, button');
    inputs.forEach(inp => inp.remove());
    const text = clone.textContent?.trim();
    if (text && !results.some(r => r.text.toLowerCase() === text.toLowerCase())) {
      results.push({ text, method: 'LABEL', weight: WEIGHT_MEDIUM });
    }
  }

  // 3. aria-labelledby → resolve referenced element(s) text
  const labelledBy = element.getAttribute('aria-labelledby');
  if (labelledBy) {
    const ids = labelledBy.split(/\s+/);
    for (const id of ids) {
      const ref = document.getElementById(id);
      if (ref?.textContent?.trim()) {
        results.push({ text: ref.textContent.trim(), method: 'ARIA_LABEL', weight: WEIGHT_MEDIUM });
      }
    }
  }

  // 4. aria-label attribute directly
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel?.trim()) {
    results.push({ text: ariaLabel.trim(), method: 'ARIA_LABEL', weight: WEIGHT_MEDIUM });
  }

  // 5. Nearest preceding sibling/ancestor text (capped traversal)
  const contextText = findNearbyContext(element);
  if (contextText) {
    results.push({ text: contextText, method: 'CONTEXT', weight: WEIGHT_WEAK });
  }

  // 6. placeholder (weakest)
  const placeholder = htmlEl.placeholder;
  if (placeholder?.trim()) {
    results.push({ text: placeholder.trim(), method: 'PLACEHOLDER', weight: WEIGHT_WEAK });
  }

  return results;
}

/**
 * Walk up to 3 levels up and 2 siblings back to find nearby text context.
 * Capped for performance (hackathon budget).
 */
function findNearbyContext(element: Element): string | null {
  let current: Element | null = element;

  for (let level = 0; level < 3; level++) {
    if (!current) break;

    // Check preceding siblings
    let prev = current.previousElementSibling;
    let siblingCount = 0;
    while (prev && siblingCount < 2) {
      const text = prev.textContent?.trim();
      if (text && text.length < 100) return text;
      prev = prev.previousElementSibling;
      siblingCount++;
    }

    // Check parent's preceding siblings
    const parent = current.parentElement;
    if (parent) {
      let parentPrev = parent.previousElementSibling;
      let parentSiblingCount = 0;
      while (parentPrev && parentSiblingCount < 2) {
        const text = parentPrev.textContent?.trim();
        if (text && text.length < 100) return text;
        parentPrev = parentPrev.previousElementSibling;
        parentSiblingCount++;
      }
    }

    current = current.parentElement;
  }

  return null;
}

// ─── Attribute Extraction ──────────────────────────────────────────

/**
 * Extract a signal from a named attribute if it exists and is non-empty.
 */
function attrSignal(
  element: Element,
  attrName: string,
  method: DetectionMethod,
  suggestedType: import('./privacyTypes').PIIType,
  weight: number,
): EvidenceSignal | null {
  const value = element.getAttribute(attrName);
  if (!value?.trim()) return null;
  return {
    method,
    matchedValue: value.trim(),
    suggestedType,
    weight,
  };
}

// ─── Main Extraction ───────────────────────────────────────────────

/**
 * Extract all evidence signals from a DOM element.
 * Returns raw, unscored signals for downstream classifiers.
 */
export function extractEvidence(element: Element): EvidenceSignal[] {
  const signals: EvidenceSignal[] = [];

  // 1. Input type signal
  const type = element.getAttribute('type');
  if (type) {
    signals.push({
      method: 'INPUT_TYPE',
      matchedValue: type,
      suggestedType: mapInputType(type),
      weight: type === 'password' ? 0.50 : type === 'email' ? 0.50 : type === 'tel' ? 0.50 : 0.25,
    });
  }

  // 2. Autocomplete signal
  const autocomplete = element.getAttribute('autocomplete');
  if (autocomplete) {
    const mapped = mapAutocomplete(autocomplete);
    if (mapped) {
      signals.push({
        method: 'AUTOCOMPLETE',
        matchedValue: autocomplete,
        suggestedType: mapped.type,
        weight: mapped.weight,
      });
    }
  }

  // 3. name attribute
  const nameAttr = element.getAttribute('name');
  if (nameAttr) {
    const normalized = normalizeText(nameAttr);
    const matched = matchKeywords(normalized, 'FIELD_NAME');
    signals.push(...matched);
  }

  // 4. id attribute
  const idAttr = element.id;
  if (idAttr) {
    const normalized = normalizeText(idAttr);
    const matched = matchKeywords(normalized, 'FIELD_ID');
    signals.push(...matched);
  }

  // 5. Labels and context (§6 resolution)
  const labels = resolveLabels(element);
  for (const label of labels) {
    const normalized = normalizeText(label.text);
    const matched = matchKeywords(normalized, label.method);
    // Override weight with the label priority weight
    for (const sig of matched) {
      sig.weight = label.weight;
    }
    signals.push(...matched);
  }

  return signals;
}

// ─── Input Type Mapping ────────────────────────────────────────────

function mapInputType(type: string): import('./privacyTypes').PIIType {
  switch (type) {
    case 'email': return 'EMAIL';
    case 'password': return 'PASSWORD';
    case 'tel': return 'PHONE';
    // date requires label context to distinguish DOB from travel date
    default: return 'NONE';
  }
}

// ─── Autocomplete Mapping ──────────────────────────────────────────

function mapAutocomplete(value: string): { type: import('./privacyTypes').PIIType; weight: number } | null {
  const v = value.toLowerCase().trim();
  const map: Record<string, { type: import('./privacyTypes').PIIType; weight: number }> = {
    'email':              { type: 'EMAIL', weight: 0.50 },
    'tel':                { type: 'PHONE', weight: 0.50 },
    'name':               { type: 'PERSON_NAME', weight: 0.50 },
    'given-name':         { type: 'PERSON_NAME', weight: 0.50 },
    'family-name':        { type: 'PERSON_NAME', weight: 0.50 },
    'honorific-prefix':   { type: 'PERSON_NAME', weight: 0.50 },
    'street-address':     { type: 'ADDRESS', weight: 0.50 },
    'address-line1':      { type: 'ADDRESS', weight: 0.50 },
    'address-line2':      { type: 'ADDRESS', weight: 0.50 },
    'cc-number':          { type: 'CARD_NUMBER', weight: 0.50 },
    'cc-exp':             { type: 'CARD_EXPIRY', weight: 0.50 },
    'cc-exp-month':       { type: 'CARD_EXPIRY', weight: 0.50 },
    'cc-exp-year':        { type: 'CARD_EXPIRY', weight: 0.50 },
    'cc-csc':             { type: 'CVV', weight: 0.50 },
    'cc-name':            { type: 'PERSON_NAME', weight: 0.50 },
    'bday':               { type: 'DATE_OF_BIRTH', weight: 0.50 },
    'bday-day':           { type: 'DATE_OF_BIRTH', weight: 0.50 },
    'bday-month':         { type: 'DATE_OF_BIRTH', weight: 0.50 },
    'bday-year':          { type: 'DATE_OF_BIRTH', weight: 0.50 },
    'new-password':       { type: 'PASSWORD', weight: 0.50 },
    'current-password':   { type: 'PASSWORD', weight: 0.50 },
  };
  return map[v] ?? null;
}

// ─── Keyword Matching ──────────────────────────────────────────────

interface KeywordRule {
  keywords: string[];
  type: import('./privacyTypes').PIIType;
  method: DetectionMethod;
  weight: number;
}

const KEYWORD_RULES: KeywordRule[] = [
  // EMAIL
  { keywords: ['email', 'e-mail'], type: 'EMAIL', method: 'FIELD_NAME', weight: 0.25 },
  // PHONE
  { keywords: ['phone', 'mobile', 'telephone', 'contact number', 'contact no'], type: 'PHONE', method: 'FIELD_NAME', weight: 0.25 },
  // PERSON_NAME
  { keywords: ['full name', 'passenger name', 'first name', 'last name', 'cardholder name', 'name on card', 'your name'], type: 'PERSON_NAME', method: 'FIELD_NAME', weight: 0.25 },
  // ADDRESS
  { keywords: ['address', 'street', 'home address', 'billing address', 'shipping address'], type: 'ADDRESS', method: 'FIELD_NAME', weight: 0.25 },
  // PASSPORT
  { keywords: ['passport', 'passport number', 'passport no'], type: 'PASSPORT_NUMBER', method: 'FIELD_NAME', weight: 0.25 },
  // CARD_NUMBER
  { keywords: ['card number', 'credit card', 'debit card', 'card no'], type: 'CARD_NUMBER', method: 'FIELD_NAME', weight: 0.25 },
  // CARD_EXPIRY
  { keywords: ['expiry', 'expiration', 'exp date', 'valid thru'], type: 'CARD_EXPIRY', method: 'FIELD_NAME', weight: 0.25 },
  // CVV
  { keywords: ['cvv', 'cvc', 'security code', 'card verification'], type: 'CVV', method: 'FIELD_NAME', weight: 0.25 },
  // PASSWORD
  { keywords: ['password', 'passcode', 'pin code'], type: 'PASSWORD', method: 'FIELD_NAME', weight: 0.25 },
  // DATE_OF_BIRTH
  { keywords: ['date of birth', 'dob', 'birth date', 'birthday', 'born'], type: 'DATE_OF_BIRTH', method: 'FIELD_NAME', weight: 0.25 },
];

/**
 * Match normalized text against keyword rules, producing evidence signals.
 * The method parameter overrides the rule's default method (allows same
 * keywords to fire from different evidence sources with different methods).
 */
function matchKeywords(normalizedText: string, method: DetectionMethod): EvidenceSignal[] {
  const signals: EvidenceSignal[] = [];

  for (const rule of KEYWORD_RULES) {
    for (const keyword of rule.keywords) {
      if (normalizedText.includes(keyword)) {
        signals.push({
          method,
          matchedValue: normalizedText,
          suggestedType: rule.type,
          weight: method === 'PLACEHOLDER' || method === 'CONTEXT' ? WEIGHT_WEAK : rule.weight,
        });
        break; // one match per rule is enough
      }
    }
  }

  return signals;
}
