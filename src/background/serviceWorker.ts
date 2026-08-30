/**
 * Background service worker — message router only.
 *
 * This file routes messages between the side panel and content scripts.
 * It contains NO business logic, NO extraction code, NO AI calls.
 *
 * SECURITY INVARIANT: No network calls. No data leaves the extension
 * messaging boundary.
 */

import type { ExtensionMessage } from '../shared/messages';
import { sendTaskReasoningRequest } from './networkClient';
import { validateResponse } from '../network/responseValidator';
import type { SanitizedContext, TaskAnalysisResult } from '../task/taskTypes';
import type { PageRepresentation } from '../shared/types';
import type { ValidatedAction } from '../action/actionTypes';

/**
 * Opens the side panel for the current active tab.
 */
async function openSidePanel(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) {
    await chrome.sidePanel.open({ tabId: tab.id });
  }
}

/**
 * Routes a message to the active tab's content script and returns the response.
 */
async function routeToContentScript(
  message: ExtensionMessage,
): Promise<unknown> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!tab?.id) {
    return {
      type: 'ERROR',
      message: 'No active tab found. Please navigate to a webpage.',
      context: 'background',
    };
  }

  // Check if we can access the tab (restricted pages block content scripts)
  const url = tab.url || '';
  if (
    url.startsWith('chrome://') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('about:') ||
    url.startsWith('https://chrome.google.com/webstore')
  ) {
    return {
      type: 'ERROR',
      message: `Cannot analyze "${url}" — content scripts are blocked on this page type. Try a regular webpage.`,
      context: 'background',
    };
  }

  try {
    const response = await chrome.tabs.sendMessage(tab.id, message);
    return response;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      type: 'ERROR',
      message: `Could not reach content script: ${errorMessage}. Try refreshing the page.`,
      context: 'background',
    };
  }
}

/**
 * Open side panel when the extension icon is clicked.
 */
chrome.action.onClicked.addListener(() => {
  openSidePanel();
});

/**
 * Store for pending network requests.
 * Maps requestId → set of elementIds disclosed in that request.
 */
const pendingRequests = new Map<string, Set<string>>();

/**
 * Store for page representations (for response validation).
 */
let currentPageRepresentation: PageRepresentation | null = null;

/**
 * Store for last disclosed element IDs (for action gate validation).
 */
let lastDisclosedIds: Set<string> | null = null;

/**
 * Store for last sanitized context (for action gate validation).
 */
let lastSanitizedContext: SanitizedContext | null = null;

/**
 * Handle messages from the side panel.
 */
chrome.runtime.onMessage.addListener(
  (
    message: ExtensionMessage,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void,
  ) => {
    // Only route messages from the side panel (not from content scripts)
    if (sender.tab) {
      // Message from a content script — don't route it back
      return false;
    }

    // Handle SEND_TO_AI message
    if (message.type === 'SEND_TO_AI') {
      const sanitizedContext = message.sanitizedContext as SanitizedContext;
      const taskAnalysis = message.taskAnalysis as TaskAnalysisResult;

      // Send to server via network client
      sendTaskReasoningRequest(sanitizedContext, taskAnalysis)
        .then(({ request, response }) => {
          // Store pending request for validation
          const disclosedIds = new Set(
            request.allowedContext.map(el => el.elementId)
          );
          pendingRequests.set(request.requestId, disclosedIds);

          // Store disclosed IDs for action gate validation
          lastDisclosedIds = disclosedIds;
          lastSanitizedContext = sanitizedContext;

          // Validate response
          if (!currentPageRepresentation) {
            throw new Error('No page representation available for validation');
          }

          const approved = validateResponse(
            response,
            request.requestId,
            disclosedIds,
            currentPageRepresentation,
          );

          // Clean up pending request
          pendingRequests.delete(request.requestId);

          sendResponse({
            type: 'AI_RESPONSE',
            response: approved,
          });
        })
        .catch(error => {
          sendResponse({
            type: 'ERROR',
            message: `AI request failed: ${error instanceof Error ? error.message : String(error)}`,
            context: 'networkClient',
          });
        });

      return true; // async response
    }

    // Handle EXECUTE_ACTION message
    if (message.type === 'EXECUTE_ACTION') {
      const action = message.action as ValidatedAction;

      // Route to content script for execution
      routeToContentScript({
        type: 'EXECUTE_ACTION',
        action,
      } as ExtensionMessage).then(sendResponse);

      return true; // async response
    }

    // Handle PAGE_ANALYSIS_RESULT — store for later validation
    if (message.type === 'PAGE_ANALYSIS_RESULT') {
      currentPageRepresentation = message.payload;
    }

    // Route to content script
    routeToContentScript(message).then(sendResponse);
    return true; // async response
  },
);

console.log('[PPBA] Background service worker loaded.');
