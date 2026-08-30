/**
 * PageOverview — displays page title, URL, and element count summary.
 */

import React from 'react';
import type { PageSummary } from '../../shared/types';

interface PageOverviewProps {
  title: string;
  url: string;
  summary: PageSummary;
}

export function PageOverview({ title, url, summary }: PageOverviewProps): React.ReactElement {
  return (
    <div className="card page-overview">
      <h2 className="card-title">Page Overview</h2>
      <div className="overview-field">
        <span className="field-label">Title:</span>
        <span className="field-value">{title || '(untitled)'}</span>
      </div>
      <div className="overview-field">
        <span className="field-label">URL:</span>
        <span className="field-value url-value" title={url}>{url}</span>
      </div>
      <div className="summary-grid">
        <div className="summary-item">
          <span className="summary-count">{summary.totalElements}</span>
          <span className="summary-label">Total</span>
        </div>
        <div className="summary-item">
          <span className="summary-count">{summary.visibleElements}</span>
          <span className="summary-label">Visible</span>
        </div>
        <div className="summary-item">
          <span className="summary-count">{summary.inputCount}</span>
          <span className="summary-label">Inputs</span>
        </div>
        <div className="summary-item">
          <span className="summary-count">{summary.buttonCount}</span>
          <span className="summary-label">Buttons</span>
        </div>
        <div className="summary-item">
          <span className="summary-count">{summary.linkCount}</span>
          <span className="summary-label">Links</span>
        </div>
        <div className="summary-item">
          <span className="summary-count">{summary.formCount}</span>
          <span className="summary-label">Forms</span>
        </div>
      </div>
    </div>
  );
}
