/**
 * Approval Store — one-time approval tokens for action execution.
 *
 * ═══════════════════════════════════════════════════════════════════════
 * SECURITY INVARIANT:
 *
 * The approval gate must be enforced by mechanism, not by convention.
 * When the user clicks "Approve" in the side panel, the background
 * generates a single-use cryptographic token tied to the specific
 * action (elementId + actionType). EXECUTE_ACTION messages must
 * include this token; the background verifies it before forwarding
 * to the content script, then invalidates it.
 *
 * No token → no execution.
 * Reused token → no execution.
 * Mismatched elementId/actionType → no execution.
 * ═══════════════════════════════════════════════════════════════════════
 */

/** Maximum age of an approval token in milliseconds (5 minutes). */
const TOKEN_MAX_AGE_MS = 5 * 60 * 1000;

/** Maximum number of pending approvals to prevent unbounded memory growth. */
const MAX_PENDING_APPROVALS = 50;

export interface PendingApproval {
  elementId: string;
  actionType: string;
  createdAt: number;
}

/**
 * Manages single-use approval tokens for action execution.
 * Tokens are generated when the user approves an action, verified
 * when EXECUTE_ACTION arrives, and invalidated after a single use.
 */
export class ApprovalStore {
  private pendingApprovals = new Map<string, PendingApproval>();

  /**
   * Generate a single-use approval token for a specific action.
   * @returns The generated token string.
   */
  generateToken(elementId: string, actionType: string): string {
    // Evict expired tokens first
    this.evictExpired();

    // Enforce size cap
    if (this.pendingApprovals.size >= MAX_PENDING_APPROVALS) {
      // Remove oldest entry
      const oldestKey = this.pendingApprovals.keys().next().value;
      if (oldestKey) {
        this.pendingApprovals.delete(oldestKey);
      }
    }

    const token = this.createToken();
    this.pendingApprovals.set(token, {
      elementId,
      actionType,
      createdAt: Date.now(),
    });

    return token;
  }

  /**
   * Verify and consume an approval token.
   * Returns true if the token is valid, matches the elementId/actionType,
   * and has not expired. The token is invalidated (single-use) regardless
   * of whether it matches.
   *
   * @returns An object with `valid` and optional `error` message.
   */
  verifyAndConsume(
    token: string | undefined,
    elementId: string,
    actionType: string,
  ): { valid: boolean; error?: string } {
    if (!token) {
      return { valid: false, error: 'Missing approval token — action rejected' };
    }

    const approval = this.pendingApprovals.get(token);

    // Always delete the token after lookup (prevents reuse even on mismatch)
    this.pendingApprovals.delete(token);

    if (!approval) {
      return { valid: false, error: 'Invalid or already-used approval token — action rejected' };
    }

    // Check expiry
    if (Date.now() - approval.createdAt > TOKEN_MAX_AGE_MS) {
      return { valid: false, error: 'Approval token has expired — action rejected' };
    }

    // Check elementId match
    if (approval.elementId !== elementId) {
      return {
        valid: false,
        error: `Approval token was issued for element "${approval.elementId}", ` +
               `not "${elementId}" — action rejected`,
      };
    }

    // Check actionType match
    if (approval.actionType !== actionType) {
      return {
        valid: false,
        error: `Approval token was issued for action "${approval.actionType}", ` +
               `not "${actionType}" — action rejected`,
      };
    }

    return { valid: true };
  }

  /**
   * Clear all pending approvals (e.g., on page navigation).
   */
  clear(): void {
    this.pendingApprovals.clear();
  }

  /**
   * Get the number of pending approvals (for testing/diagnostics).
   */
  get size(): number {
    return this.pendingApprovals.size;
  }

  /**
   * Remove expired tokens.
   */
  private evictExpired(): void {
    const now = Date.now();
    for (const [token, approval] of this.pendingApprovals) {
      if (now - approval.createdAt > TOKEN_MAX_AGE_MS) {
        this.pendingApprovals.delete(token);
      }
    }
  }

  /**
   * Create a cryptographically random token string.
   */
  private createToken(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    // Fallback for environments without crypto.randomUUID
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }
}
