/**
 * TaskView — Task tab UI for Phase 3/4/5.
 *
 * Phase 5 additions:
 * - Action Gate validation for AI-proposed actions
 * - User approval UI with Approve/Reject buttons
 * - Action execution via content script
 * - Visual context display
 *
 * SECURITY: AI-authored strings (taskInterpretation, reason) are rendered
 * as plain text only — never dangerouslySetInnerHTML or HTML-injection paths.
 * Actions require explicit user approval before execution.
 */

import React, { useState, useCallback, useMemo } from 'react';
import type { PageElement } from '../../shared/types';
import type { PrivacyAnalysis } from '../../privacy/privacyTypes';
import type {
  TaskAnalysisResult,
  DisclosurePlan,
  SanitizedContext,
  DisclosureRuling,
} from '../../task/taskTypes';
import { analyzeTask, taskConfidenceBand } from '../../task/taskAnalyzer';
import { tagAllElements } from '../../task/conceptTagger';
import { buildTaggedElement, evaluateDisclosurePlan } from '../../task/disclosurePolicy';
import { buildSanitizedContext } from '../../task/sanitizedContextBuilder';
import { DISCLOSURE_COLORS } from '../../shared/constants';
import type { ApprovedProposal } from '../../network/networkTypes';
import { validateAction } from '../../action/actionGate';
import type { ValidatedAction, ActionResult } from '../../action/actionTypes';

interface TaskViewProps {
  elements: PageElement[];
  analysis: PrivacyAnalysis;
  selectedElementId: string | null;
  onElementClick: (elementId: string, color?: string) => void;
  onClearHighlight: () => void;
}

/** Unified state shape — avoids union-narrowing issues */
interface TaskViewState {
  status: 'idle' | 'result' | 'sending' | 'ai-result' | 'action-pending' | 'action-executing' | 'action-result' | 'error';
  taskAnalysis: TaskAnalysisResult | null;
  plan: DisclosurePlan | null;
  context: SanitizedContext | null;
  proposal: ApprovedProposal | null;
  validatedAction: ValidatedAction | null;
  actionResult: ActionResult | null;
  errorMessage: string | null;
}

const INITIAL_STATE: TaskViewState = {
  status: 'idle',
  taskAnalysis: null,
  plan: null,
  context: null,
  proposal: null,
  validatedAction: null,
  actionResult: null,
  errorMessage: null,
};

export function TaskView({
  elements,
  analysis,
  selectedElementId,
  onElementClick,
  onClearHighlight,
}: TaskViewProps): React.ReactElement {
  const [taskText, setTaskText] = useState('');
  const [state, setState] = useState<TaskViewState>(INITIAL_STATE);

  const handleAnalyze = useCallback(() => {
    if (!taskText.trim()) return;

    // 1. Analyze the task text
    const taskAnalysis = analyzeTask(taskText);

    // 2. Tag all elements with domain concepts
    const conceptMap = tagAllElements(elements, analysis.assessments);

    // 3. Build tagged elements
    const taggedElements = elements.map(el => {
      const assessment = analysis.assessments.find(a => a.elementId === el.id);
      const concept = conceptMap.get(el.id) ?? 'UNKNOWN';
      return buildTaggedElement(el, assessment, concept);
    });

    // 4. Evaluate disclosure plan
    const plan = evaluateDisclosurePlan(taggedElements, taskAnalysis);

    // 5. Build sanitized context
    const context = buildSanitizedContext(plan, taggedElements, taskText);

    setState({
      status: 'result',
      taskAnalysis,
      plan,
      context,
      proposal: null,
      validatedAction: null,
      actionResult: null,
      errorMessage: null,
    });
  }, [taskText, elements, analysis]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAnalyze();
    }
  }, [handleAnalyze]);

  const handleSendToAI = useCallback(async () => {
    if (state.status !== 'result' || !state.context || !state.taskAnalysis) return;

    setState(prev => ({ ...prev, status: 'sending' }));

    try {
      const response = await chrome.runtime.sendMessage({
        type: 'SEND_TO_AI',
        sanitizedContext: state.context,
        taskAnalysis: state.taskAnalysis,
      });

      if (response && typeof response === 'object' && 'type' in response) {
        if (response.type === 'AI_RESPONSE') {
          const proposal = response.response as ApprovedProposal;

          // Action Gate: validate proposed actions
          if (proposal.proposedActions.length > 0 && state.context) {
            const disclosedIds = new Set(state.context.elements.map(el => el.elementId));
            const pageRepresentation = {
              url: '',
              title: '',
              timestamp: Date.now(),
              summary: {
                totalElements: elements.length,
                visibleElements: elements.filter(e => e.visible).length,
                inputCount: elements.filter(e => e.tagName === 'INPUT').length,
                buttonCount: elements.filter(e => e.tagName === 'BUTTON').length,
                linkCount: elements.filter(e => e.tagName === 'A').length,
                formCount: elements.filter(e => e.tagName === 'FORM').length,
              },
              elements,
            };

            const validation = validateAction(
              proposal,
              pageRepresentation,
              disclosedIds,
              state.context,
            );

            if (validation.valid && validation.action) {
              setState(prev => ({
                ...prev,
                status: 'action-pending',
                proposal,
                validatedAction: validation.action ?? null,
              }));
              return;
            } else {
              // Action gate rejected
              setState(prev => ({
                ...prev,
                status: 'error',
                proposal,
                errorMessage: `Action gate rejected: ${validation.error}`,
              }));
              return;
            }
          }

          setState(prev => ({
            ...prev,
            status: 'ai-result',
            proposal,
          }));
        } else if (response.type === 'ERROR') {
          setState(prev => ({
            ...prev,
            status: 'error',
            errorMessage: (response as { message: string }).message,
          }));
        }
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        status: 'error',
        errorMessage: `Network request failed: ${error instanceof Error ? error.message : String(error)}`,
      }));
    }
  }, [state, elements]);

  const handleApproveAction = useCallback(async () => {
    if (!state.validatedAction) return;

    setState(prev => ({ ...prev, status: 'action-executing' }));

    try {
      // Mark as approved
      const approvedAction: ValidatedAction = {
        ...state.validatedAction,
        approved: true,
      };

      // Send to content script for execution
      const response = await chrome.runtime.sendMessage({
        type: 'EXECUTE_ACTION',
        action: approvedAction,
      });

      if (response && typeof response === 'object' && 'type' in response) {
        if (response.type === 'ACTION_RESULT') {
          setState(prev => ({
            ...prev,
            status: 'action-result',
            actionResult: response.result as ActionResult,
          }));
        } else if (response.type === 'ERROR') {
          setState(prev => ({
            ...prev,
            status: 'error',
            errorMessage: (response as { message: string }).message,
          }));
        }
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        status: 'error',
        errorMessage: `Action execution failed: ${error instanceof Error ? error.message : String(error)}`,
      }));
    }
  }, [state.validatedAction]);

  const handleRejectAction = useCallback(() => {
    setState(prev => ({
      ...prev,
      status: 'ai-result',
      validatedAction: null,
    }));
  }, []);

  // Group rulings by decision type
  const groupedRulings = useMemo(() => {
    if (!state.plan) return null;

    const allowed: DisclosureRuling[] = [];
    const minimized: DisclosureRuling[] = [];
    const excluded: DisclosureRuling[] = [];
    const blocked: DisclosureRuling[] = [];

    for (const ruling of state.plan.rulings) {
      switch (ruling.decision) {
        case 'ALLOW': allowed.push(ruling); break;
        case 'MINIMIZE': minimized.push(ruling); break;
        case 'TRANSFORM': minimized.push(ruling); break;
        case 'EXCLUDE': excluded.push(ruling); break;
        case 'BLOCK': blocked.push(ruling); break;
      }
    }

    return { allowed, minimized, excluded, blocked };
  }, [state.plan]);

  // Element lookup for display
  const elementMap = useMemo(() => {
    const map = new Map<string, PageElement>();
    for (const el of elements) {
      map.set(el.id, el);
    }
    return map;
  }, [elements]);

  const hasData = state.taskAnalysis && state.plan && state.context;

  return (
    <div className="card task-view">
      <h2 className="card-title">🎯 Task Analysis</h2>

      {/* Task Input */}
      <div className="task-input-area">
        <textarea
          className="task-input"
          placeholder="e.g. Find the cheapest flight from Mumbai to Delhi"
          value={taskText}
          onChange={(e) => setTaskText(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
        />
        <button
          className="analyze-button task-analyze-btn"
          onClick={handleAnalyze}
          disabled={!taskText.trim()}
        >
          Analyze Task
        </button>
      </div>

      {/* Results */}
      {hasData && state.taskAnalysis && state.plan && state.context && (
        <>
          {/* Intent + Confidence */}
          <div className="task-intent">
            <div className="intent-badge" data-intent={state.taskAnalysis.intent}>
              {state.taskAnalysis.intent.replace(/_/g, ' ')}
            </div>
            <span className="intent-confidence">
              {Math.round(state.taskAnalysis.confidence * 100)}%
            </span>
            <span className="intent-band">
              {taskConfidenceBand(state.taskAnalysis.confidence)}
            </span>
          </div>

          {/* Entities */}
          {(state.taskAnalysis.entities.origin || state.taskAnalysis.entities.destination) && (
            <div className="task-entities">
              {state.taskAnalysis.entities.origin && (
                <span className="entity-badge origin">✈️ From: {state.taskAnalysis.entities.origin}</span>
              )}
              {state.taskAnalysis.entities.destination && (
                <span className="entity-badge destination">✈️ To: {state.taskAnalysis.entities.destination}</span>
              )}
            </div>
          )}

          {/* Disclosure Summary */}
          <div className="disclosure-summary">
            <div className="summary-item">
              <span className="summary-count" style={{ color: DISCLOSURE_COLORS.ALLOW }}>
                {state.plan.summary.allowed}
              </span>
              <span className="summary-label">Allowed</span>
            </div>
            <div className="summary-item">
              <span className="summary-count" style={{ color: DISCLOSURE_COLORS.MINIMIZE }}>
                {state.plan.summary.minimized}
              </span>
              <span className="summary-label">Minimized</span>
            </div>
            <div className="summary-item">
              <span className="summary-count" style={{ color: DISCLOSURE_COLORS.EXCLUDE }}>
                {state.plan.summary.excluded}
              </span>
              <span className="summary-label">Excluded</span>
            </div>
            <div className="summary-item">
              <span className="summary-count" style={{ color: DISCLOSURE_COLORS.BLOCK }}>
                {state.plan.summary.blocked}
              </span>
              <span className="summary-label">Blocked</span>
            </div>
          </div>

          {/* Required Concepts */}
          {groupedRulings && groupedRulings.allowed.length > 0 && (
            <div className="ruling-section">
              <h3 className="ruling-title">✓ Required (Allowed)</h3>
              <div className="ruling-list">
                {groupedRulings.allowed.map(ruling => {
                  const element = elementMap.get(ruling.elementId);
                  return (
                    <div
                      key={ruling.elementId}
                      className={`ruling-item ${selectedElementId === ruling.elementId ? 'selected' : ''}`}
                      style={{ borderLeftColor: DISCLOSURE_COLORS.ALLOW }}
                      onClick={() => onElementClick(ruling.elementId, DISCLOSURE_COLORS.ALLOW)}
                    >
                      <span className="ruling-concept">{ruling.concept}</span>
                      <span className="ruling-element">
                        {element?.tagName} {element?.label ? `(${element.label})` : ''}
                      </span>
                      <span className="ruling-decision" style={{ color: DISCLOSURE_COLORS.ALLOW }}>
                        {ruling.decision}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Minimized/Transformed Concepts */}
          {groupedRulings && groupedRulings.minimized.length > 0 && (
            <div className="ruling-section">
              <h3 className="ruling-title">⚡ Minimized/Transformed</h3>
              <div className="ruling-list">
                {groupedRulings.minimized.map(ruling => {
                  const element = elementMap.get(ruling.elementId);
                  return (
                    <div
                      key={ruling.elementId}
                      className={`ruling-item ${selectedElementId === ruling.elementId ? 'selected' : ''}`}
                      style={{ borderLeftColor: DISCLOSURE_COLORS.MINIMIZE }}
                      onClick={() => onElementClick(ruling.elementId, DISCLOSURE_COLORS.MINIMIZE)}
                    >
                      <span className="ruling-concept">{ruling.concept}</span>
                      <span className="ruling-element">
                        {element?.tagName} {element?.label ? `(${element.label})` : ''}
                      </span>
                      <span className="ruling-decision" style={{ color: DISCLOSURE_COLORS.MINIMIZE }}>
                        {ruling.decision}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Excluded Concepts */}
          {groupedRulings && groupedRulings.excluded.length > 0 && (
            <div className="ruling-section">
              <h3 className="ruling-title">× Excluded (Not Task-Relevant)</h3>
              <div className="ruling-list">
                {groupedRulings.excluded.map(ruling => {
                  const element = elementMap.get(ruling.elementId);
                  return (
                    <div
                      key={ruling.elementId}
                      className="ruling-item excluded"
                      style={{ borderLeftColor: DISCLOSURE_COLORS.EXCLUDE }}
                    >
                      <span className="ruling-concept">{ruling.concept}</span>
                      <span className="ruling-element">
                        {element?.tagName} {element?.label ? `(${element.label})` : ''}
                      </span>
                      <span className="ruling-decision" style={{ color: DISCLOSURE_COLORS.EXCLUDE }}>
                        EXCLUDE
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Blocked Concepts */}
          {groupedRulings && groupedRulings.blocked.length > 0 && (
            <div className="ruling-section">
              <h3 className="ruling-title">🔒 Blocked (Secret)</h3>
              <div className="ruling-list">
                {groupedRulings.blocked.map(ruling => {
                  const element = elementMap.get(ruling.elementId);
                  return (
                    <div
                      key={ruling.elementId}
                      className="ruling-item blocked"
                      style={{ borderLeftColor: DISCLOSURE_COLORS.BLOCK }}
                    >
                      <span className="ruling-concept">{ruling.concept}</span>
                      <span className="ruling-element">
                        {element?.tagName} {element?.label ? `(${element.label})` : ''}
                      </span>
                      <span className="ruling-decision" style={{ color: DISCLOSURE_COLORS.BLOCK }}>
                        BLOCK
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* AI Result */}
          {(state.status === 'ai-result' || state.status === 'action-pending') && state.proposal && (
            <div className="ai-result-section">
              <h3 className="ruling-title">🤖 AI Analysis Result</h3>
              <div className="ai-interpretation">
                <strong>Interpretation:</strong> {state.proposal.taskInterpretation}
              </div>

              {state.proposal.selectedElements.length > 0 && (
                <div className="ai-selected">
                  <strong>Selected Elements:</strong>
                  {state.proposal.selectedElements.map((sel: { elementId: string; reason: string }) => (
                    <div key={sel.elementId} className="ai-element-item">
                      <span className="ai-element-id">{sel.elementId}</span>
                      <span className="ai-element-reason">{sel.reason}</span>
                    </div>
                  ))}
                </div>
              )}

              {state.proposal.proposedActions.length > 0 && (
                <div className="ai-actions">
                  <strong>Proposed Actions:</strong>
                  {state.proposal.proposedActions.map((action: { type: string; elementId: string }, i: number) => (
                    <div key={i} className="ai-action-item">
                      <span className="ai-action-type">{action.type}</span>
                      <span className="ai-action-target">{action.elementId}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Action Pending — Approval UI */}
          {state.status === 'action-pending' && state.validatedAction && (
            <div className="action-gate-section">
              <h3 className="ruling-title">🛡️ Action Gate — Approval Required</h3>
              <div className="action-gate-content">
                <div className="action-gate-description">
                  <span className="action-gate-icon">🤖</span>
                  <div>
                    <strong>AI proposes an action:</strong>
                    <p className="action-gate-text">{state.validatedAction.description}</p>
                  </div>
                </div>
                <div className="action-gate-details">
                  <div className="action-gate-detail">
                    <span className="detail-label">Target:</span>
                    <span className="detail-value">{state.validatedAction.elementId}</span>
                  </div>
                  <div className="action-gate-detail">
                    <span className="detail-label">Action:</span>
                    <span className="detail-value">{state.validatedAction.type}</span>
                  </div>
                </div>
                <div className="action-gate-buttons">
                  <button
                    className="action-approve-btn"
                    onClick={handleApproveAction}
                  >
                    ✓ Approve
                  </button>
                  <button
                    className="action-reject-btn"
                    onClick={handleRejectAction}
                  >
                    ✕ Reject
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Action Executing */}
          {state.status === 'action-executing' && (
            <div className="action-executing-section">
              <div className="spinner" />
              <span>Executing action...</span>
            </div>
          )}

          {/* Action Result */}
          {state.status === 'action-result' && state.actionResult && (
            <div className={`action-result-section ${state.actionResult.success ? 'success' : 'failure'}`}>
              <h3 className="ruling-title">
                {state.actionResult.success ? '✅ Action Completed' : '❌ Action Failed'}
              </h3>
              <div className="action-result-details">
                <div className="action-gate-detail">
                  <span className="detail-label">Action:</span>
                  <span className="detail-value">{state.actionResult.actionType}</span>
                </div>
                <div className="action-gate-detail">
                  <span className="detail-label">Element:</span>
                  <span className="detail-value">{state.actionResult.elementId}</span>
                </div>
                {state.actionResult.error && (
                  <div className="action-result-error">
                    {state.actionResult.error}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Error Display */}
          {state.status === 'error' && state.errorMessage && (
            <div className="error-box">
              <span className="error-icon">⚠️</span>
              <div>
                <strong>Error</strong>
                <p>{state.errorMessage}</p>
              </div>
            </div>
          )}

          {/* Explanation */}
          <div className="task-explanation">
            <small>{state.taskAnalysis.explanation}</small>
          </div>

          {/* Sanitized Context Count + Send to AI */}
          <div className="sanitized-count">
            <small>Sanitized context: {state.context.elements.length} elements disclosed</small>
            <button
              className="analyze-button task-analyze-btn send-ai-btn"
              onClick={handleSendToAI}
              disabled={state.status === 'sending' || state.status === 'ai-result' || state.status === 'action-pending' || state.status === 'action-executing' || state.status === 'action-result' || state.context.elements.length === 0}
            >
              {state.status === 'sending' ? 'Sending...' : state.status === 'ai-result' || state.status === 'action-pending' || state.status === 'action-executing' || state.status === 'action-result' ? 'Sent' : 'Send to AI'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
