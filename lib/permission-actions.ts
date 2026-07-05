'use server'

import { authenticateServerAction } from '@/lib/auth-helpers'
import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

export async function getPermissionDefinitions() {
  try {
    const { data, error } = await supabaseAdmin
      .from('permission_definitions')
      .select('*')
      .order('category')
      .order('label')

    if (error) throw error
    return data || []
  } catch (error) {
    logger.error('Error fetching permissions:', error)
    return []
  }
}

export async function getRolePermissions(role?: string) {
  try {
    let query = supabaseAdmin
      .from('role_permissions')
      .select(`
        *,
        permission:permission_definitions!permission_code(code, label, category)
      `)

    if (role) query = query.eq('role', role)

    const { data, error } = await query
    if (error) throw error
    return data || []
  } catch (error) {
    logger.error('Error fetching role permissions:', error)
    return []
  }
}

export async function setRolePermission(data: {
  role: string
  permission_code: string
  grant_type: 'allow' | 'deny'
  branch_id?: string
  max_value?: number
  expires_at?: string
  requires_approval?: boolean
}) {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile || !['super_admin', 'admin'].includes(auth.profile.role)) {
      return { success: false, error: 'Unauthorized' }
    }

    // Upsert
    const { error } = await supabaseAdmin.from('role_permissions').upsert(
      { ...data, created_by: auth.profile.id },
      { onConflict: 'role,permission_code,branch_id' }
    )

    if (error) throw new Error(error.message)
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to set permission' }
  }
}

export async function removeRolePermission(id: string) {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile || !['super_admin', 'admin'].includes(auth.profile.role)) {
      return { success: false, error: 'Unauthorized' }
    }

    const { error } = await supabaseAdmin.from('role_permissions').delete().eq('id', id)
    if (error) throw new Error(error.message)
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to remove permission' }
  }
}

export async function getUserPermissions(userId: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from('user_permissions')
      .select(`*, permission:permission_definitions!permission_code(code, label, category)`)
      .eq('user_id', userId)

    if (error) throw error
    return data || []
  } catch (error) {
    logger.error('Error fetching user permissions:', error)
    return []
  }
}

export async function setUserPermission(data: {
  user_id: string
  permission_code: string
  grant_type: 'allow' | 'deny'
  branch_id?: string
  max_value?: number
  expires_at?: string
  requires_approval?: boolean
}) {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile || !['super_admin', 'admin'].includes(auth.profile.role)) {
      return { success: false, error: 'Unauthorized' }
    }

    const { error } = await supabaseAdmin.from('user_permissions').upsert(
      { ...data, granted_by: auth.profile.id },
      { onConflict: 'user_id,permission_code,branch_id' }
    )

    if (error) throw new Error(error.message)
    return { success: true }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to set permission' }
  }
}
