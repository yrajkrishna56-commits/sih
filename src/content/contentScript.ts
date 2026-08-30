/**
 * Content script entry point.
 *
 * Runs on every page (document_idle) but does NO work until it receives
 * a message from the background service worker. This is on-demand only —
 * no MutationObserver, no polling, no continuous extraction.
 *
 * SECURITY INVARIANT: All data stays within the extension messaging boundary.
 * No network calls. No data leaves the window context except through
 * structured Chrome extension messages.
 */

import { extractPageRepresentation } from './domExtractor';
import { highlightElement, clearHighlight } from './highlighter';
import { detectPII } from '../privacy/piiDetector';
import type { ExtensionMessage } from '../shared/messages';
import type { ValidatedAction } from '../action/actionTypes';

/**
 * Message handler — responds to messages from the background service worker.
 */
chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void,
  ) => {
    try {
      switch (message.type) {
        case 'ANALYZE_PAGE': {
          console.log('[PPBA] Analysis requested — extracting page representation...');
          const representation = extractPageRepresentation();
          console.log(
            `[PPBA] Extraction complete: ${representation.summary.totalElements} elements ` +
            `(${representation.summary.visibleElements} visible)`
          );

          // Phase 2: Run privacy classification
          console.log('[PPBA] Running privacy classification...');
          const privacyAnalysis = detectPII(representation);
          console.log(
            `[PPBA] Privacy analysis complete: ${privacyAnalysis.piiCount} PII fields ` +
            `(${privacyAnalysis.secretCount} secret, ${privacyAnalysis.personalCount} personal)`
          );

          sendResponse({
            type: 'PAGE_ANALYSIS_RESULT',
            payload: representation,
            privacyAnalysis,
          });
          return false; // synchronous response
        }

        case 'HIGHLIGHT_ELEMENT': {
          const success = highlightElement(message.elementId, message.color);
          sendResponse({ success });
          return false;
        }

        case 'CLEAR_HIGHLIGHT': {
          clearHighlight();
          sendResponse({ success: true });
          return false;
        }

        case 'GET_PAGE_INFO': {
          // Lightweight page info without full extraction
          sendResponse({
            url: window.location.href,
            title: document.title,
          });
          return false;
        }

        case 'EXECUTE_ACTION': {
          const action = message.action as ValidatedAction;
          console.log(`[PPBA] Executing action: ${action.type} on ${action.elementId}`);

          // Find the element in the DOM
          const element = document.querySelector(
            `[data-ppba-id="${CSS.escape(action.elementId)}"]`
          );

          if (!element) {
            sendResponse({
              type: 'ACTION_RESULT',
              result: {
                success: false,
                actionType: action.type,
                elementId: action.elementId,
                executedAt: Date.now(),
                error: `Element "${action.elementId}" not found in DOM`,
              },
            });
            return false;
          }

          try {
            switch (action.type) {
              case 'CLICK':
                (element as HTMLElement).click();
                break;
              case 'SCROLL':
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                break;
              case 'SELECT':
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                break;
              default:
                throw new Error(`Unsupported action type: ${action.type}`);
            }

            sendResponse({
              type: 'ACTION_RESULT',
              result: {
                success: true,
                actionType: action.type,
                elementId: action.elementId,
                executedAt: Date.now(),
              },
            });
          } catch (error) {
            sendResponse({
              type: 'ACTION_RESULT',
              result: {
                success: false,
                actionType: action.type,
                elementId: action.elementId,
                executedAt: Date.now(),
                error: `Execution failed: ${error instanceof Error ? error.message : String(error)}`,
              },
            });
          }
          return false;
        }

        default: {
          // Structurally impossible with discriminated union, but handle
          // runtime edge cases (stale/unexpected messages)
          console.warn('[PPBA] Unexpected message type:', message);
          sendResponse({ error: 'Unknown message type' });
          return false;
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[PPBA] Content script error:', errorMessage);
      sendResponse({
        type: 'ERROR',
        message: `Content script error: ${errorMessage}`,
        context: 'contentScript',
      });
      return false;
    }
  },
);

console.log('[PPBA] Content script loaded. Awaiting analysis requests.');
