/**
 * Server tests — request validation, response validation, mock provider.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import reasonRouter from '../routes/reason';
import type { Server } from 'http';

// Create a fresh server for tests (don't import the production server)
const testApp = express();
testApp.use(express.json({ limit: '100kb' }));
testApp.use('/', reasonRouter);
testApp.get('/health', (_req, res) => {
  res.json({ status: 'ok', provider: 'mock' });
});

let testServer: Server;
let testPort: number;

beforeAll(async () => {
  await new Promise<void>((resolve) => {
    testServer = testApp.listen(0, () => {
      const addr = testServer.address();
      if (addr && typeof addr === 'object') {
        testPort = addr.port;
      }
      resolve();
    });
  });
});

afterAll(async () => {
  await new Promise<void>((resolve) => {
    testServer.close(() => resolve());
  });
});

describe('POST /reason', () => {
  const validRequest = {
    requestId: '12345678-1234-4123-8123-123456789abc',
    task: 'Find the cheapest flight from Mumbai to Delhi',
    intent: 'FLIGHT_SEARCH',
    entities: { origin: 'Mumbai', destination: 'Delhi' },
    allowedContext: [
      {
        elementId: 'price-1',
        concept: 'PRICE',
        tagName: 'SPAN',
        publicText: '₹4,250',
        label: 'Price',
        disclosureLevel: 'ALLOW',
      },
      {
        elementId: 'airline-1',
        concept: 'AIRLINE',
        tagName: 'SPAN',
        publicText: 'SkyBook Airways',
        disclosureLevel: 'ALLOW',
      },
      {
        elementId: 'flight-1',
        concept: 'FLIGHT_NUMBER',
        tagName: 'SPAN',
        publicText: 'SB 101',
        disclosureLevel: 'ALLOW',
      },
      {
        elementId: 'select-1',
        concept: 'SELECTION_CONTROL',
        tagName: 'BUTTON',
        publicText: 'Select Flight',
        disclosureLevel: 'ALLOW',
      },
    ],
  };

  it('accepts a valid request and returns a valid response', async () => {
    const response = await fetch(`http://localhost:${testPort}/reason`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validRequest),
    });

    expect(response.ok).toBe(true);
    const body = await response.json();
    expect(body).toHaveProperty('requestId', validRequest.requestId);
    expect(body).toHaveProperty('success', true);
    expect(body).toHaveProperty('taskInterpretation');
    expect(body).toHaveProperty('selectedElements');
    expect(body).toHaveProperty('proposedActions');
  });

  it('rejects a request missing required fields', async () => {
    const response = await fetch(`http://localhost:${testPort}/reason`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requestId: '12345678-1234-4123-8123-123456789abc' }), // Missing fields
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  it('rejects a request with unexpected extra top-level fields', async () => {
    const response = await fetch(`http://localhost:${testPort}/reason`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validRequest, evilField: 'should not be here' }),
    });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body).toHaveProperty('error');
  });

  it('rejects a request with invalid UUID format', async () => {
    const response = await fetch(`http://localhost:${testPort}/reason`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validRequest, requestId: 'not-a-uuid' }),
    });

    expect(response.status).toBe(400);
  });

  it('rejects a request with empty task', async () => {
    const response = await fetch(`http://localhost:${testPort}/reason`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...validRequest, task: '' }),
    });

    expect(response.status).toBe(400);
  });

  it('returns deterministic response for same input', async () => {
    const response1 = await fetch(`http://localhost:${testPort}/reason`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validRequest),
    });
    const body1 = await response1.json();

    const response2 = await fetch(`http://localhost:${testPort}/reason`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validRequest),
    });
    const body2 = await response2.json();

    // Same taskInterpretation (deterministic)
    expect(body1.taskInterpretation).toBe(body2.taskInterpretation);
    // Same selected elements
    expect(body1.selectedElements).toEqual(body2.selectedElements);
    // Same proposed actions
    expect(body1.proposedActions).toEqual(body2.proposedActions);
  });
});

describe('GET /health', () => {
  it('returns health status', async () => {
    const response = await fetch(`http://localhost:${testPort}/health`);
    expect(response.ok).toBe(true);
    const body = await response.json();
    expect(body).toHaveProperty('status', 'ok');
    expect(body).toHaveProperty('provider', 'mock');
  });
});
