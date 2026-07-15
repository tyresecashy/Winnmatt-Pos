/**
 * Identity Context — Who, where, and what is performing this operation
 *
 * Provides the current user, branch, role, and device for audit
 * and authorization hooks in the repository layer. In production
 * these values would be propagated via AsyncLocalStorage or
 * request context. For now returns placeholder values.
 *
 * Constitution Reference: §5 (Module Architecture)
 */

// ─── Module-level identity holders ──────────────────────────────────────────

let _userId: string | null = null
let _branchId: string | null = null
let _role: string | null = null
let _deviceId: string | null = null

/**
 * Set the identity context for the current operation.
 * In production this would be invoked by middleware.
 */
export function setIdentityContext(ctx: {
  userId?: string | null
  branchId?: string | null
  role?: string | null
  deviceId?: string | null
}): void {
  _userId = ctx.userId ?? _userId
  _branchId = ctx.branchId ?? _branchId
  _role = ctx.role ?? _role
  _deviceId = ctx.deviceId ?? _deviceId
}

/**
 * Clear the identity context (e.g. after request completes).
 */
export function clearIdentityContext(): void {
  _userId = null
  _branchId = null
  _role = null
  _deviceId = null
}

export function getCurrentUserId(): string | null {
  return _userId
}

export function getCurrentBranchId(): string | null {
  return _branchId
}

export function getCurrentRole(): string | null {
  return _role
}

export function getCurrentDeviceId(): string | null {
  return _deviceId
}
