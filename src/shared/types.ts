/**
 * Canonical types for Phase 1 of the Privacy-Preserving Browser Agent.
 *
 * Phase 2+ extension points are documented as comments below.
 * Do NOT implement logic behind them in this phase.
 */

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PageElement {
  id: string;
  tagName: string;
  role?: string;
  type?: string;
  text?: string;
  label?: string;
  ariaLabel?: string;
  visible: boolean;
  enabled?: boolean;
  clickable?: boolean;
  boundingBox?: BoundingBox;
  // --- Phase 2+ extension points (privacy engine will populate these) ---
  // privacyClassification?: unknown;
  // sensitivity?: unknown;
  // disclosureDecision?: unknown;
}

export interface PageSummary {
  totalElements: number;
  visibleElements: number;
  inputCount: number;
  buttonCount: number;
  linkCount: number;
  formCount: number;
}

export interface PageRepresentation {
  url: string;
  title: string;
  timestamp: number;
  summary: PageSummary;
  elements: PageElement[];
}
