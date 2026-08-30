/**
 * ElementInspector — scrollable list of extracted page elements.
 * Clicking an element highlights it on the live page.
 * Sensitive field values (passwords) are masked per Phase 1 blanket rule.
 */

import React, { useState, useMemo } from 'react';
import type { PageElement } from '../../shared/types';

interface ElementInspectorProps {
  elements: PageElement[];
  selectedElementId: string | null;
  onElementClick: (elementId: string) => void;
  onClearHighlight: () => void;
}

type FilterType = 'all' | 'input' | 'button' | 'link' | 'visible' | 'interactive';

export function ElementInspector({
  elements,
  selectedElementId,
  onElementClick,
  onClearHighlight,
}: ElementInspectorProps): React.ReactElement {
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredElements = useMemo(() => {
    let result = elements;

    // Apply filter
    switch (filter) {
      case 'input':
        result = result.filter(el =>
          ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)
        );
        break;
      case 'button':
        result = result.filter(el =>
          el.tagName === 'BUTTON' || el.role === 'button'
        );
        break;
      case 'link':
        result = result.filter(el =>
          el.tagName === 'A' || el.role === 'link'
        );
        break;
      case 'visible':
        result = result.filter(el => el.visible);
        break;
      case 'interactive':
        result = result.filter(el => el.clickable);
        break;
    }

    // Apply search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(el =>
        (el.text?.toLowerCase().includes(term)) ||
        (el.label?.toLowerCase().includes(term)) ||
        (el.ariaLabel?.toLowerCase().includes(term)) ||
        (el.id.toLowerCase().includes(term)) ||
        (el.tagName.toLowerCase().includes(term))
      );
    }

    return result;
  }, [elements, filter, searchTerm]);

  const handleElementClick = (elementId: string) => {
    if (selectedElementId === elementId) {
      onClearHighlight();
    } else {
      onElementClick(elementId);
    }
  };

  return (
    <div className="card element-inspector">
      <h2 className="card-title">
        Elements <span className="element-count">({filteredElements.length}/{elements.length})</span>
      </h2>

      <div className="inspector-controls">
        <input
          type="text"
          className="search-input"
          placeholder="Search elements..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <div className="filter-buttons">
          {(['all', 'input', 'button', 'link', 'visible', 'interactive'] as FilterType[]).map(f => (
            <button
              key={f}
              className={`filter-btn ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <div className="element-list">
        {filteredElements.length === 0 && (
          <div className="empty-state">
            {elements.length === 0
              ? 'No elements extracted. Click "Analyze" to start.'
              : 'No elements match the current filter.'}
          </div>
        )}
        {filteredElements.map(el => (
          <div
            key={el.id}
            className={`element-item ${selectedElementId === el.id ? 'selected' : ''} ${!el.visible ? 'hidden-element' : ''}`}
            onClick={() => handleElementClick(el.id)}
          >
            <div className="element-header">
              <span className="element-tag">{el.tagName}</span>
              {el.type && <span className="element-type">{el.type}</span>}
              {el.role && <span className="element-role">{el.role}</span>}
              <span className="element-id">{el.id}</span>
            </div>
            {(el.text || el.label || el.ariaLabel) && (
              <div className="element-details">
                {el.label && <span className="element-label">📋 {el.label}</span>}
                {el.text && <span className="element-text">📝 {el.text}</span>}
                {el.ariaLabel && <span className="element-aria">🔊 {el.ariaLabel}</span>}
              </div>
            )}
            <div className="element-flags">
              {!el.visible && <span className="flag flag-hidden">hidden</span>}
              {el.visible && <span className="flag flag-visible">visible</span>}
              {el.clickable && <span className="flag flag-clickable">clickable</span>}
              {el.enabled === false && <span className="flag flag-disabled">disabled</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
