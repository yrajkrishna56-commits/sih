/**
 * PrivacyView — displays privacy analysis results.
 * Shows summary counts and a scrollable list of assessments.
 * Clicking an entity highlights it on the page with sensitivity color.
 */

import React, { useState, useMemo } from 'react';
import type { PrivacyAnalysis, PrivacyAssessment } from '../../privacy/privacyTypes';
import type { PageElement } from '../../shared/types';
import { SENSITIVITY_COLORS } from '../../shared/constants';
import { confidenceBand } from '../../privacy/confidence';

interface PrivacyViewProps {
  analysis: PrivacyAnalysis;
  elements: PageElement[];
  selectedElementId: string | null;
  onElementClick: (elementId: string, color?: string) => void;
  onClearHighlight: () => void;
  getElementColor: (elementId: string) => string | undefined;
}

type FilterSensitivity = 'all' | 'SECRET' | 'PERSONAL' | 'CONTEXTUAL' | 'PUBLIC';

export function PrivacyView({
  analysis,
  elements,
  selectedElementId,
  onElementClick,
  onClearHighlight,
  getElementColor,
}: PrivacyViewProps): React.ReactElement {
  const [filter, setFilter] = useState<FilterSensitivity>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Build a map from elementId to PageElement for display
  const elementMap = useMemo(() => {
    const map = new Map<string, PageElement>();
    for (const el of elements) {
      map.set(el.id, el);
    }
    return map;
  }, [elements]);

  // Filter assessments
  const filteredAssessments = useMemo(() => {
    if (filter === 'all') return analysis.assessments;
    return analysis.assessments.filter(a => a.sensitivity === filter);
  }, [analysis.assessments, filter]);

  const handleEntityClick = (assessment: PrivacyAssessment) => {
    if (selectedElementId === assessment.elementId) {
      onClearHighlight();
    } else {
      const color = SENSITIVITY_COLORS[assessment.sensitivity];
      onElementClick(assessment.elementId, color);
    }
  };

  const formatMethod = (method: string): string => {
    const map: Record<string, string> = {
      'INPUT_TYPE': 'Input type',
      'AUTOCOMPLETE': 'Autocomplete',
      'FIELD_NAME': 'Field name',
      'FIELD_ID': 'Field ID',
      'ARIA_LABEL': 'ARIA label',
      'LABEL': 'Label',
      'PLACEHOLDER': 'Placeholder',
      'CONTEXT': 'Nearby context',
      'PATTERN': 'Value pattern',
      'VALUE_STRUCTURE': 'Value structure',
    };
    return map[method] ?? method;
  };

  return (
    <div className="card privacy-view">
      <h2 className="card-title">🔐 Privacy Analysis</h2>

      {/* Summary Counts */}
      <div className="privacy-summary">
        <div className="summary-item">
          <span className="summary-count">{analysis.totalAnalyzed}</span>
          <span className="summary-label">Analyzed</span>
        </div>
        <div className="summary-item">
          <span className="summary-count" style={{ color: SENSITIVITY_COLORS.PUBLIC }}>
            {analysis.publicCount}
          </span>
          <span className="summary-label">Public</span>
        </div>
        <div className="summary-item">
          <span className="summary-count" style={{ color: SENSITIVITY_COLORS.CONTEXTUAL }}>
            {analysis.contextualCount}
          </span>
          <span className="summary-label">Contextual</span>
        </div>
        <div className="summary-item">
          <span className="summary-count" style={{ color: SENSITIVITY_COLORS.PERSONAL }}>
            {analysis.personalCount}
          </span>
          <span className="summary-label">Personal</span>
        </div>
        <div className="summary-item">
          <span className="summary-count" style={{ color: SENSITIVITY_COLORS.SECRET }}>
            {analysis.secretCount}
          </span>
          <span className="summary-label">Secret</span>
        </div>
      </div>

      {/* Sensitivity Filter */}
      <div className="filter-buttons">
        {(['all', 'SECRET', 'PERSONAL', 'CONTEXTUAL', 'PUBLIC'] as FilterSensitivity[]).map(f => (
          <button
            key={f}
            className={`filter-btn ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
            style={f !== 'all' && filter === f ? { borderColor: SENSITIVITY_COLORS[f], background: SENSITIVITY_COLORS[f] + '33' } : undefined}
          >
            {f === 'all' ? 'All' : f}
          </button>
        ))}
      </div>

      {/* Assessment List */}
      <div className="assessment-list">
        {filteredAssessments.length === 0 && (
          <div className="empty-state">
            {analysis.assessments.length === 0
              ? 'No assessments yet. Click "Analyze" to start.'
              : 'No assessments match the current filter.'}
          </div>
        )}
        {filteredAssessments.map(assessment => {
          const element = elementMap.get(assessment.elementId);
          const isExpanded = expandedId === assessment.elementId;
          const color = SENSITIVITY_COLORS[assessment.sensitivity];

          return (
            <div
              key={assessment.elementId}
              className={`assessment-item ${selectedElementId === assessment.elementId ? 'selected' : ''}`}
              style={{ borderLeftColor: color }}
            >
              {/* Header Row */}
              <div
                className="assessment-header"
                onClick={() => handleEntityClick(assessment)}
              >
                <div className="assessment-main">
                  <span className="assessment-type">{assessment.piiType}</span>
                  <span
                    className="assessment-sensitivity"
                    style={{ background: color + '33', color }}
                  >
                    {assessment.sensitivity}
                  </span>
                </div>
                <div className="assessment-meta">
                  <span className="assessment-confidence">
                    {Math.round(assessment.confidence * 100)}%
                  </span>
                  <span className="assessment-band">
                    {confidenceBand(assessment.confidence)}
                  </span>
                </div>
              </div>

              {/* Element Info */}
              {element && (
                <div className="assessment-element">
                  <span className="element-tag">{element.tagName}</span>
                  {element.label && <span className="element-label">📋 {element.label}</span>}
                  <span className="element-id">{assessment.elementId}</span>
                </div>
              )}

              {/* Expand/Collapse */}
              <button
                className="expand-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpandedId(isExpanded ? null : assessment.elementId);
                }}
              >
                {isExpanded ? '▼ Hide details' : '▶ Show details'}
              </button>

              {/* Detail Panel */}
              {isExpanded && (
                <div className="assessment-detail">
                  <div className="detail-row">
                    <span className="detail-label">Explanation:</span>
                    <span className="detail-value">{assessment.explanation}</span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Detection methods:</span>
                    <div className="detail-methods">
                      {assessment.detectionMethods.map(method => (
                        <span key={method} className="method-badge">
                          ✓ {formatMethod(method)}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Evidence ({assessment.evidence.length} signals):</span>
                    <div className="detail-evidence">
                      {assessment.evidence.map((sig, i) => (
                        <div key={i} className="evidence-signal">
                          <span className="signal-method">{formatMethod(sig.method)}</span>
                          <span className="signal-value">"{sig.matchedValue}"</span>
                          <span className="signal-type">→ {sig.suggestedType}</span>
                          <span className="signal-weight">w={sig.weight.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
