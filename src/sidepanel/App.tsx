/**
 * Side panel App — orchestrates the analysis flow and UI state.
 *
 * Phase 2: Holds both PageRepresentation and PrivacyAnalysis as sibling
 * state pieces, joined by elementId when rendering.
 *
 * SECURITY INVARIANT: No network calls. All communication goes through
 * Chrome extension messaging only.
 */

import React, { useState, useCallback, useEffect } from 'react';
import type { PageRepresentation, PageElement } from '../shared/types';
import type { PrivacyAnalysis } from '../privacy/privacyTypes';
import type { ExtensionMessage } from '../shared/messages';
import { SENSITIVITY_COLORS } from '../shared/constants';
import { PageOverview } from './components/PageOverview';
import { ElementInspector } from './components/ElementInspector';
import { AnalyzeButton } from './components/AnalyzeButton';
import { PrivacyView } from './components/PrivacyView';
import { TaskView } from './components/TaskView';
import './styles/panel.css';

type AppState =
  | { status: 'idle' }
  | { status: 'analyzing' }
  | { status: 'result'; data: PageRepresentation; privacyAnalysis: PrivacyAnalysis }
  | { status: 'error'; message: string; context?: string };

export default function App() {
  const [state, setState] = useState<AppState>({ status: 'idle' });
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'elements' | 'privacy' | 'task'>('elements');

  const analyze = useCallback(async () => {
    setState({ status: 'analyzing' });
    setSelectedElementId(null);

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'ANALYZE_PAGE',
      } satisfies ExtensionMessage);

      if (
        response &&
        typeof response === 'object' &&
        'type' in response &&
        response.type === 'PAGE_ANALYSIS_RESULT'
      ) {
        setState({
          status: 'result',
          data: response.payload as PageRepresentation,
          privacyAnalysis: response.privacyAnalysis as PrivacyAnalysis,
        });
      } else if (
        response &&
        typeof response === 'object' &&
        'type' in response &&
        response.type === 'ERROR'
      ) {
        setState({
          status: 'error',
          message: (response as { message: string }).message,
          context: (response as { context?: string }).context,
        });
      } else {
        setState({
          status: 'error',
          message: 'Received unexpected response from content script.',
          context: 'sidePanel',
        });
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      setState({
        status: 'error',
        message: `Analysis failed: ${msg}`,
        context: 'sidePanel',
      });
    }
  }, []);

  const handleElementClick = useCallback(async (elementId: string, color?: string) => {
    setSelectedElementId(elementId);

    try {
      await chrome.runtime.sendMessage({
        type: 'HIGHLIGHT_ELEMENT',
        elementId,
        color,
      } satisfies ExtensionMessage);
    } catch (error) {
      console.error('[PPBA-SidePanel] Failed to highlight element:', error);
    }
  }, []);

  const handleClearHighlight = useCallback(async () => {
    setSelectedElementId(null);

    try {
      await chrome.runtime.sendMessage({
        type: 'CLEAR_HIGHLIGHT',
      } satisfies ExtensionMessage);
    } catch (error) {
      console.error('[PPBA-SidePanel] Failed to clear highlight:', error);
    }
  }, []);

  // Clear highlight when panel unloads
  useEffect(() => {
    const handleUnload = () => {
      chrome.runtime.sendMessage({
        type: 'CLEAR_HIGHLIGHT',
      } satisfies ExtensionMessage).catch(() => {
        // Panel is closing, best-effort cleanup
      });
    };

    window.addEventListener('unload', handleUnload);
    return () => {
      window.removeEventListener('unload', handleUnload);
      handleUnload();
    };
  }, []);

  // Filter out sensitive element values in the display (Phase 1 blanket rule)
  const sanitizeElements = useCallback((elements: PageElement[]): PageElement[] => {
    return elements.map(el => {
      if (el.type === 'password') {
        return { ...el, text: '••••••••' };
      }
      return el;
    });
  }, []);

  // Get sensitivity color for an element
  const getElementColor = useCallback((elementId: string): string | undefined => {
    if (state.status !== 'result') return undefined;
    const assessment = state.privacyAnalysis.assessments.find(a => a.elementId === elementId);
    if (!assessment) return undefined;
    return SENSITIVITY_COLORS[assessment.sensitivity];
  }, [state]);

  return (
    <div className="panel">
      <header className="panel-header">
        <h1 className="panel-title">🛡️ Privacy Panel</h1>
        <span className="panel-status">
          <span className="status-dot" /> Local Analysis
        </span>
      </header>

      <main className="panel-main">
        {state.status === 'result' && (
          <PageOverview
            title={state.data.title}
            url={state.data.url}
            summary={state.data.summary}
          />
        )}

        <AnalyzeButton
          onAnalyze={analyze}
          isAnalyzing={state.status === 'analyzing'}
        />

        {state.status === 'error' && (
          <div className="error-box">
            <span className="error-icon">⚠️</span>
            <div>
              <strong>Analysis Error</strong>
              <p>{state.message}</p>
              {state.context && <small>Context: {state.context}</small>}
            </div>
          </div>
        )}

        {state.status === 'result' && (
          <>
            {/* Tab Bar */}
            <div className="tab-bar">
              <button
                className={`tab-btn ${activeTab === 'elements' ? 'active' : ''}`}
                onClick={() => setActiveTab('elements')}
              >
                Elements ({state.data.elements.length})
              </button>
              <button
                className={`tab-btn ${activeTab === 'privacy' ? 'active' : ''}`}
                onClick={() => setActiveTab('privacy')}
              >
                🔐 Privacy ({state.privacyAnalysis.piiCount})
              </button>
              <button
                className={`tab-btn ${activeTab === 'task' ? 'active' : ''}`}
                onClick={() => setActiveTab('task')}
              >
                🎯 Task
              </button>
            </div>

            {activeTab === 'elements' && (
              <ElementInspector
                elements={sanitizeElements(state.data.elements)}
                selectedElementId={selectedElementId}
                onElementClick={handleElementClick}
                onClearHighlight={handleClearHighlight}
              />
            )}

            {activeTab === 'privacy' && (
              <PrivacyView
                analysis={state.privacyAnalysis}
                elements={state.data.elements}
                selectedElementId={selectedElementId}
                onElementClick={handleElementClick}
                onClearHighlight={handleClearHighlight}
                getElementColor={getElementColor}
              />
            )}

            {activeTab === 'task' && (
              <TaskView
                elements={state.data.elements}
                analysis={state.privacyAnalysis}
                selectedElementId={selectedElementId}
                onElementClick={handleElementClick}
                onClearHighlight={handleClearHighlight}
              />
            )}
          </>
        )}
      </main>

      <footer className="panel-footer">
        <span>✓ Processed locally</span>
        <span>✓ No server connection</span>
      </footer>
    </div>
  );
}
