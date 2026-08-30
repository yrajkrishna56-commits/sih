/**
 * Mock AI Provider — deterministic rule-based reasoning for demo.
 *
 * This is a rules engine standing in for an LLM, not a random-choice stub.
 * The demo should look intentional, not lucky.
 *
 * Logic: parse allowedContext for elements tagged with flight-domain concepts,
 * pick the lowest-price option, return a fixed-shape response referencing
 * that element's elementId.
 *
 * Deterministic: no Math.random(), no timing-dependent branching.
 */

import type { AIProvider } from './aiProvider';
import type { TaskReasoningRequest } from '../schemas/request';
import type { RawAIResponse } from '../schemas/response';

export class MockAIProvider implements AIProvider {
  async generate(request: TaskReasoningRequest): Promise<RawAIResponse> {
    const { allowedContext, intent, task, entities } = request;

    // Find price elements
    const priceElements = allowedContext.filter(el => el.concept === 'PRICE');

    // Find flight number elements
    const flightElements = allowedContext.filter(el => el.concept === 'FLIGHT_NUMBER');

    // Find airline elements
    const airlineElements = allowedContext.filter(el => el.concept === 'AIRLINE');

    // Find selection controls
    const selectionControls = allowedContext.filter(el => el.concept === 'SELECTION_CONTROL');

    // Parse prices to find cheapest
    let cheapestPrice: { elementId: string; value: number } | null = null;
    for (const el of priceElements) {
      if (el.publicText) {
        // Extract numeric value from price text (e.g., "₹4,250" → 4250)
        const match = el.publicText.replace(/[^\d]/g, '');
        const value = parseInt(match, 10);
        if (!isNaN(value)) {
          if (!cheapestPrice || value < cheapestPrice.value) {
            cheapestPrice = { elementId: el.elementId, value };
          }
        }
      }
    }

    // Build interpretation
    let interpretation: string;
    const selectedElements: Array<{ elementId: string; reason: string }> = [];
    const proposedActions: Array<{ type: 'SELECT_ELEMENT' | 'CLICK_TARGET' | 'SCROLL_TARGET' | 'CLICK'; elementId: string }> = [];

    if (intent === 'FLIGHT_SEARCH') {
      interpretation = `Found ${priceElements.length} flight option(s)`;
      if (entities.origin && entities.destination) {
        interpretation += ` from ${entities.origin} to ${entities.destination}`;
      }
      interpretation += '. ';

      if (cheapestPrice) {
        const cheapestFlight = flightElements.find(f =>
          f.boundingBox && priceElements.find(p =>
            p.elementId === cheapestPrice.elementId &&
            f.boundingBox && p.boundingBox &&
            Math.abs(f.boundingBox.y - p.boundingBox.y) < 50
          )
        );

        interpretation += `The cheapest option is ₹${cheapestPrice.value.toLocaleString()}`;
        if (cheapestFlight) {
          interpretation += ` (flight ${cheapestFlight.publicText || cheapestFlight.label || 'unknown'})`;
          selectedElements.push({
            elementId: cheapestFlight.elementId,
            reason: 'Cheapest flight number',
          });
        }

        selectedElements.push({
          elementId: cheapestPrice.elementId,
          reason: 'Lowest price found',
        });

        // Find the corresponding select button
        if (cheapestFlight && selectionControls.length > 0) {
          // Find the select button closest to the cheapest flight
          const selectButton = selectionControls.find(btn =>
            btn.boundingBox && cheapestFlight.boundingBox &&
            Math.abs(btn.boundingBox.y - cheapestFlight.boundingBox.y) < 100
          );
          if (selectButton) {
            proposedActions.push({
              type: 'CLICK',
              elementId: selectButton.elementId,
            });
          }
        }
      } else {
        interpretation += 'Could not determine prices from the available data.';
      }
    } else if (intent === 'FLIGHT_SELECTION') {
      interpretation = `Analyzing flight selection options. Found ${flightElements.length} flights and ${selectionControls.length} selection controls.`;
      if (selectionControls.length > 0) {
        proposedActions.push({
          type: 'CLICK',
          elementId: selectionControls[0]!.elementId,
        });
        selectedElements.push({
          elementId: selectionControls[0]!.elementId,
          reason: 'First available selection control',
        });
      }
    } else {
      interpretation = `Task: "${task}". Analyzed ${allowedContext.length} elements with allowed access.`;
    }

    return {
      requestId: request.requestId,
      success: true,
      taskInterpretation: interpretation,
      selectedElements,
      proposedActions,
    };
  }
}
