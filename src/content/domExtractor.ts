/**
 * Pure DOM extraction module — transforms a live DOM tree into a typed
 * PageRepresentation. This file contains ZERO Chrome API calls and
 * ZERO network calls. It is unit-testable with a plain DOM environment
 * (e.g., jsdom).
 *
 * SECURITY INVARIANT: No data from this module leaves the window context
 * except through structured extension messaging (message contracts in
 * shared/messages.ts). No HTML strings, innerHTML dumps, or raw serializations
 * are produced anywhere in this pipeline.
 */

import type { PageRepresentation, PageElement, PageSummary } from '../shared/types';
import { MAX_EXTRACTED_ELEMENTS } from '../shared/constants';
import {
  getStableId,
  shouldSkipElement,
  isVisible,
  hasMinimumSize,
  isEnabled,
  isClickable,
  getBoundingBox,
  getElementLabel,
} from './elementUtils';

/**
 * Checks if an element is a relevant interactive or semantic element
 * worth extracting.
 */
function isRelevantElement(element: Element): boolean {
  const tag = element.tagName;

  // Interactive elements
  if (['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(tag)) return true;

  // Links
  if (tag === 'A' && element.hasAttribute('href')) return true;

  // Semantic landmarks
  const role = element.getAttribute('role');
  if (role === 'button' || role === 'link' || role === 'navigation' ||
      role === 'main' || role === 'banner' || role === 'contentinfo' ||
      role === 'form' || role === 'search') return true;

  // Headings
  if (/^H[1-6]$/.test(tag)) return true;

  // Images with alt text
  if (tag === 'IMG' && element.getAttribute('alt')) return true;

  // Sections / articles / nav / main / aside / form
  if (['SECTION', 'ARTICLE', 'NAV', 'MAIN', 'ASIDE', 'FORM', 'FIELDSET'].includes(tag)) return true;

  return false;
}

/**
 * Extracts text content from an element, preferring accessible name sources.
 */
function extractText(element: Element): string | undefined {
  // For input elements, check placeholder
  const htmlEl = element as HTMLInputElement;
  if ('placeholder' in htmlEl && htmlEl.placeholder) {
    return htmlEl.placeholder;
  }

  // For images, use alt
  if (element.tagName === 'IMG') {
    return element.getAttribute('alt') || undefined;
  }

  // For other elements, use textContent but truncate long text
  const text = element.textContent?.trim();
  if (!text) return undefined;
  return text.length > 200 ? text.slice(0, 200) + '…' : text;
}

/**
 * Builds a summary from the extracted elements.
 */
function buildSummary(elements: PageElement[]): PageSummary {
  let visibleElements = 0;
  let inputCount = 0;
  let buttonCount = 0;
  let linkCount = 0;
  let formCount = 0;

  for (const el of elements) {
    if (el.visible) visibleElements++;

    const tag = el.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') inputCount++;
    if (tag === 'BUTTON' || el.role === 'button') buttonCount++;
    if (tag === 'A' || el.role === 'link') linkCount++;
    if (tag === 'FORM') formCount++;
  }

  return {
    totalElements: elements.length,
    visibleElements,
    inputCount,
    buttonCount,
    linkCount,
    formCount,
  };
}

/**
 * Traverses the DOM and extracts a structured representation.
 * This is the main entry point for extraction.
 *
 * SECURITY INVARIANT: No data leaves window context except via extension messaging.
 */
export function extractPageRepresentation(): PageRepresentation {
  const elements: PageElement[] = [];
  let hitCap = false;

  function processElement(element: Element): void {
    if (elements.length >= MAX_EXTRACTED_ELEMENTS) {
      hitCap = true;
      return;
    }

    // Skip non-relevant elements
    if (!isRelevantElement(element)) return;

    // Skip script/style/noscript etc.
    if (shouldSkipElement(element)) return;

    // Skip elements below minimum size (noise filter)
    if (!hasMinimumSize(element)) return;

    const visible = isVisible(element);
    const enabled = isEnabled(element);
    const clickable = isClickable(element);
    const boundingBox = visible ? getBoundingBox(element) : undefined;

    const pageElement: PageElement = {
      id: getStableId(element),
      tagName: element.tagName,
      text: extractText(element),
      label: getElementLabel(element),
      ariaLabel: element.getAttribute('aria-label') || undefined,
      role: element.getAttribute('role') || undefined,
      type: element.getAttribute('type') || undefined,
      visible,
      enabled,
      clickable,
      boundingBox,
      // Phase 2+ extension points:
      // privacyClassification: undefined,
      // sensitivity: undefined,
      // disclosureDecision: undefined,
    };

    elements.push(pageElement);
  }

  // Walk the entire document body
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_ELEMENT,
    {
      acceptNode(node: Node): number {
        const el = node as Element;
        if (shouldSkipElement(el)) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    },
  );

  let node: Node | null;
  while ((node = walker.nextNode())) {
    processElement(node as Element);
    if (hitCap) break;
  }

  const summary = buildSummary(elements);

  if (hitCap) {
    console.warn(
      `[PPBA] Extraction hit cap of ${MAX_EXTRACTED_ELEMENTS} elements. ` +
      `Some elements were not extracted. This is a Phase 1 known limitation.`
    );
  }

  return {
    url: window.location.href,
    title: document.title,
    timestamp: Date.now(),
    summary,
    elements,
  };
}
