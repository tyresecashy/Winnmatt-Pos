/**
 * Security Module — Public API
 *
 * Manages authentication, permissions, password policies, and login history.
 * Other modules should ONLY import from this file.
 *
 * Implementation: Delegates to lib/security-actions.ts and lib/permission-actions.ts.
 */

import { logger } from '@/lib/logger'
import * as securityActions from '@/lib/security-actions'
import * as permissionActions from '@/lib/permission-actions'

// ─── Type helpers ─────────────────────────────────────────────────────────────
type LoginHistoryResult = Awaited<ReturnType<typeof securityActions.getLoginHistory>>
type PermissionDefinitionRow = Awaited<ReturnType<typeof permissionActions.getPermissionDefinitions>>[number]
type RolePermissionRow = Awaited<ReturnType<typeof permissionActions.getRolePermissions>>[number]
type UserPermissionRow = Awaited<ReturnType<typeof permissionActions.getUserPermissions>>[number]

// ─── Public API - Security ──────────────────────────────────────────────────

export async function changePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
  try {
    return await securityActions.changePassword(currentPassword, newPassword)
  } catch (error) {
    logger.error('[Security Module] changePassword failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function getLoginHistory(filters?: Record<string, unknown>): Promise<LoginHistoryResult> {
  try {
    return await securityActions.getLoginHistory(filters as Parameters<typeof securityActions.getLoginHistory>[0])
  } catch (error) {
    logger.error('[Security Module] getLoginHistory failed', error instanceof Error ? error.message : String(error))
    return { data: [], count: 0 }
  }
}

export async function savePasswordPolicy(policy: Record<string, unknown>): Promise<{ success: boolean; error?: string }> {
  try {
    return await securityActions.savePasswordPolicy(policy as Parameters<typeof securityActions.savePasswordPolicy>[0])
  } catch (error) {
    logger.error('[Security Module] savePasswordPolicy failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

// ─── Public API - Permissions ───────────────────────────────────────────────

export async function getPermissionDefinitions(): Promise<PermissionDefinitionRow[]> {
  try {
    return await permissionActions.getPermissionDefinitions()
  } catch (error) {
    logger.error('[Security Module] getPermissionDefinitions failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

export async function getRolePermissions(roleId?: string): Promise<RolePermissionRow[]> {
  try {
    return await permissionActions.getRolePermissions(roleId)
  } catch (error) {
    logger.error('[Security Module] getRolePermissions failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

export async function setRolePermission(data: Record<string, unknown>): Promise<{ success: boolean; error?: string }> {
  try {
    return await permissionActions.setRolePermission(data as Parameters<typeof permissionActions.setRolePermission>[0])
  } catch (error) {
    logger.error('[Security Module] setRolePermission failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function removeRolePermission(permissionId: string): Promise<{ success: boolean; error?: string }> {
  try {
    return await permissionActions.removeRolePermission(permissionId)
  } catch (error) {
    logger.error('[Security Module] removeRolePermission failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

export async function getUserPermissions(userId: string): Promise<UserPermissionRow[]> {
  try {
    return await permissionActions.getUserPermissions(userId)
  } catch (error) {
    logger.error('[Security Module] getUserPermissions failed', error instanceof Error ? error.message : String(error))
    return []
  }
}

export async function setUserPermission(data: Record<string, unknown>): Promise<{ success: boolean; error?: string }> {
  try {
    return await permissionActions.setUserPermission(data as Parameters<typeof permissionActions.setUserPermission>[0])
  } catch (error) {
    logger.error('[Security Module] setUserPermission failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}
