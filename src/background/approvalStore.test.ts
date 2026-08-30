/**
 * Tests for the ApprovalStore — single-use approval token system.
 *
 * These tests verify the security invariant:
 * - No token → reject
 * - Reused token → reject
 * - Expired token → reject
 * - Mismatched elementId → reject
 * - Mismatched actionType → reject
 * - Valid token + correct match → accept (single-use, consumed)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApprovalStore } from './approvalStore';

describe('ApprovalStore', () => {
  let store: ApprovalStore;

  beforeEach(() => {
    store = new ApprovalStore();
  });

  // ─── Happy Path ──────────────────────────────────────────────────

  it('generates and verifies a valid token', () => {
    const token = store.generateToken('select-btn-3', 'CLICK');
    const result = store.verifyAndConsume(token, 'select-btn-3', 'CLICK');
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  // ─── Missing Token ──────────────────────────────────────────────

  it('rejects when no token is provided', () => {
    const result = store.verifyAndConsume(undefined, 'select-btn-3', 'CLICK');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Missing approval token');
  });

  it('rejects empty string token', () => {
    const result = store.verifyAndConsume('', 'select-btn-3', 'CLICK');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Missing approval token');
  });

  // ─── Reused Token (Single-Use Enforcement) ───────────────────────

  it('rejects a reused token (single-use enforcement)', () => {
    const token = store.generateToken('select-btn-3', 'CLICK');

    // First use: valid
    const first = store.verifyAndConsume(token, 'select-btn-3', 'CLICK');
    expect(first.valid).toBe(true);

    // Second use: rejected
    const second = store.verifyAndConsume(token, 'select-btn-3', 'CLICK');
    expect(second.valid).toBe(false);
    expect(second.error).toContain('Invalid or already-used');
  });

  // ─── Mismatched Element ID ────────────────────────────────────────

  it('rejects token with wrong elementId', () => {
    const token = store.generateToken('select-btn-3', 'CLICK');
    const result = store.verifyAndConsume(token, 'select-btn-EVIL', 'CLICK');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('issued for element "select-btn-3"');
    expect(result.error).toContain('not "select-btn-EVIL"');
  });

  // ─── Mismatched Action Type ───────────────────────────────────────

  it('rejects token with wrong actionType', () => {
    const token = store.generateToken('select-btn-3', 'CLICK');
    const result = store.verifyAndConsume(token, 'select-btn-3', 'SCROLL');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('issued for action "CLICK"');
    expect(result.error).toContain('not "SCROLL"');
  });

  // ─── Fabricated Token ─────────────────────────────────────────────

  it('rejects a completely fabricated token', () => {
    const result = store.verifyAndConsume('fabricated-token-12345', 'select-btn-3', 'CLICK');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Invalid or already-used');
  });

  // ─── Expired Token ────────────────────────────────────────────────

  it('rejects an expired token', () => {
    const token = store.generateToken('select-btn-3', 'CLICK');

    // Fast-forward time by 6 minutes (past the 5-minute expiry)
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 6 * 60 * 1000);

    const result = store.verifyAndConsume(token, 'select-btn-3', 'CLICK');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('expired');

    vi.restoreAllMocks();
  });

  // ─── Token Consumed Even On Mismatch ──────────────────────────────

  it('consumes token even when elementId mismatches (prevents retry attacks)', () => {
    const token = store.generateToken('select-btn-3', 'CLICK');

    // First attempt: wrong elementId → rejected
    const first = store.verifyAndConsume(token, 'wrong-id', 'CLICK');
    expect(first.valid).toBe(false);

    // Second attempt with correct elementId → also rejected (token consumed)
    const second = store.verifyAndConsume(token, 'select-btn-3', 'CLICK');
    expect(second.valid).toBe(false);
    expect(second.error).toContain('Invalid or already-used');
  });

  // ─── Multiple Independent Tokens ──────────────────────────────────

  it('supports multiple independent tokens', () => {
    const token1 = store.generateToken('btn-1', 'CLICK');
    const token2 = store.generateToken('btn-2', 'SCROLL');

    // Both valid independently
    const result1 = store.verifyAndConsume(token1, 'btn-1', 'CLICK');
    expect(result1.valid).toBe(true);

    const result2 = store.verifyAndConsume(token2, 'btn-2', 'SCROLL');
    expect(result2.valid).toBe(true);
  });

  // ─── Clear ─────────────────────────────────────────────────────────

  it('clear() invalidates all pending tokens', () => {
    const token = store.generateToken('select-btn-3', 'CLICK');
    expect(store.size).toBe(1);

    store.clear();
    expect(store.size).toBe(0);

    const result = store.verifyAndConsume(token, 'select-btn-3', 'CLICK');
    expect(result.valid).toBe(false);
  });

  // ─── Size Cap ──────────────────────────────────────────────────────

  it('evicts oldest token when size cap is reached', () => {
    // Generate 50 tokens (at cap)
    const tokens: string[] = [];
    for (let i = 0; i < 50; i++) {
      tokens.push(store.generateToken(`el-${i}`, 'CLICK'));
    }
    expect(store.size).toBe(50);

    // Generate 51st — should evict el-0
    store.generateToken('el-50', 'CLICK');
    expect(store.size).toBe(50);

    // el-0's token should be invalid
    const result = store.verifyAndConsume(tokens[0]!, 'el-0', 'CLICK');
    expect(result.valid).toBe(false);
  });
});
