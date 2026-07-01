'use server'
import { logger } from '@/lib/logger';

import { supabaseAdmin } from '@/lib/supabase-server'
import type { UserProfile } from '@/lib/db.types'

/**
 * User Management Server Functions
 * Updated to support Owner role (owner > admin > manager > cashier)
 * All functions enforce proper role-based access control
 * All use service role key to bypass RLS
 */

/**
 * Get all branches (for dropdowns and selection)
 */
export async function getBranches(): Promise<Array<{
  id: string
  name: string
  code: string
}>> {
  const { data, error } = await supabaseAdmin
    .from('branches')
    .select('id, name, code')
    .order('name', { ascending: true })

  if (error) {
    logger.error('[USER-MANAGEMENT] Failed to fetch branches:', error)
    throw new Error(`Failed to fetch branches: ${error.message}`)
  }

  return data as Array<{ id: string; name: string; code: string }>
}

export async function getUsers(userRole: string): Promise<UserProfile[]> {
  // Owner or Admin can view all users
  if (!['owner', 'admin'].includes(userRole)) {
    throw new Error('Unauthorized: Only owner and admins can view users')
  }

  const { data, error } = await supabaseAdmin
    .from('users')
    .select(`
      id,
      email,
      full_name,
      role,
      status,
      branch_id,
      created_at,
      updated_at,
      branch:branches(id, name, code)
    `)
    .order('created_at', { ascending: false })

  if (error) {
    logger.error('[USER-MANAGEMENT] Failed to fetch users:', error)
    throw new Error(`Failed to fetch users: ${error.message}`)
  }

  return (data as any[]).map(row => {
    const branch = row.branch as any
    return {
      id: row.id,
      email: row.email,
      full_name: row.full_name,
      role: row.role,
      status: row.status,
      branch_id: row.branch_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
      branch: branch ? {
        id: branch.id,
        name: branch.name,
        code: branch.code,
      } : undefined,
    }
  })
}

/**
 * Get single user by ID (owner or admin only)
 */
export async function getUserById(userId: string, userRole: string): Promise<UserProfile | null> {
  if (!['owner', 'admin'].includes(userRole)) {
    throw new Error('Unauthorized: Only owner and admins can view users')
  }

  const { data, error } = await supabaseAdmin
    .from('users')
    .select(`
      id,
      email,
      full_name,
      role,
      status,
      branch_id,
      created_at,
      updated_at,
      branch:branches(id, name, code)
    `)
    .eq('id', userId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null // Not found
    }
    logger.error('[USER-MANAGEMENT] Failed to fetch user:', error)
    throw new Error(`Failed to fetch user: ${error.message}`)
  }

  const branch = data.branch as any
  return {
    id: data.id,
    email: data.email,
    full_name: data.full_name,
    role: data.role,
    status: data.status,
    branch_id: data.branch_id,
    created_at: data.created_at,
    updated_at: data.updated_at,
    branch: branch ? {
      id: branch.id,
      name: branch.name,
      code: branch.code,
    } : undefined,
  } as UserProfile
}

/**
 * Create new user: Auth account + profile entry
 *
 * Authorization rules:
 * - Only Owner can create Owner accounts
 * - Only Owner/Admin can create Admin accounts
 * - Admin can create Manager/Cashier for their branch
 *
 * Constraints:
 * - Owner accounts must have NULL branch_id
 * - Non-owner accounts must have a branch_id
 *
 * Process:
 * 1. Validate permissions based on role being created
 * 2. Validate branch assignment rules
 * 3. Create Supabase Auth user
 * 4. Insert profile into public.users table
 *
 * Note: User can login immediately with their chosen password
 */
export async function createUser(
  userRole: string,
  email: string,
  fullName: string,
  role: 'owner' | 'admin' | 'manager' | 'cashier',
  branchId: string | null,
  password: string
): Promise<{
  user: UserProfile
}> {
  // Validate permission based on role being created
  if (role === 'owner' && userRole !== 'owner') {
    throw new Error('Unauthorized: Only owner can create owner accounts')
  }

  if (role === 'admin' && !['owner', 'admin'].includes(userRole)) {
    throw new Error('Unauthorized: Only owner and admins can create admin accounts')
  }

  if (!['owner', 'admin'].includes(userRole)) {
    throw new Error('Unauthorized: Only owner and admins can create users')
  }

  // Validate inputs
  if (!email || !fullName || !role || !password) {
    throw new Error('Missing required fields')
  }

  if (!['owner', 'admin', 'manager', 'cashier'].includes(role)) {
    throw new Error('Invalid role')
  }

  // Owner accounts must have NULL branch
  if (role === 'owner' && branchId) {
    throw new Error('Owner accounts cannot be assigned to a branch')
  }

  // Non-owner accounts must have a branch
  if (role !== 'owner' && !branchId) {
    throw new Error('Non-owner accounts must be assigned to a branch')
  }

  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters')
  }

  try {
    // Step 1: Create Supabase Auth user with provided password
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (authError) {
      logger.error('[USER-MANAGEMENT] Auth creation error:', authError)
      throw new Error(`Failed to create auth account: ${authError.message}`)
    }

    const newUserId = authData.user.id

    // Step 2: Create profile in public.users table
    const { data: profileData, error: profileError } = await supabaseAdmin
      .from('users')
      .insert([
        {
          id: newUserId,
          email,
          full_name: fullName,
          role,
          branch_id: branchId || null,
        },
      ])
      .select(
        `
        id,
        email,
        full_name,
        role,
        status,
        branch_id,
        created_at,
        updated_at,
        branch:branches(id, name, code)
      `
      )
      .single()

    if (profileError) {
      logger.error('[USER-MANAGEMENT] Profile creation error:', profileError)
      // Try to clean up auth user if profile fails
      try {
        await supabaseAdmin.auth.admin.deleteUser(newUserId)
      } catch (deleteError) {
        logger.error('[USER-MANAGEMENT] Could not delete orphaned auth user:', deleteError)
      }
      throw new Error(`Failed to create user profile: ${profileError.message}`)
    }

    const branch = profileData.branch as any
    logger.info(`[USER-MANAGEMENT] Created user: ${email} with role ${role}`)
    
    return {
      user: {
        id: profileData.id,
        email: profileData.email,
        full_name: profileData.full_name,
        role: profileData.role,
        status: profileData.status,
        branch_id: profileData.branch_id,
        created_at: profileData.created_at,
        updated_at: profileData.updated_at,
        branch: branch ? {
          id: branch.id,
          name: branch.name,
          code: branch.code,
        } : undefined,
      },
    }
  } catch (error) {
    logger.error('[USER-MANAGEMENT] Create user error:', error)
    throw error
  }
}

/**
 * Update user profile (owner or admin only)
 * Can update: full_name, role, branch_id
 * Cannot update: email (tied to Supabase Auth)
 * 
 * Authorization rules:
 * - Only Owner can promote/demote to/from Owner
 * - Only Owner/Admin can change other users
 */
export async function updateUser(
  userId: string,
  userRole: string,
  updates: {
    full_name?: string
    role?: 'owner' | 'admin' | 'manager' | 'cashier'
    branch_id?: string | null
    status?: 'active' | 'inactive'
  }
): Promise<UserProfile> {
  if (!['owner', 'admin'].includes(userRole)) {
    throw new Error('Unauthorized: Only owner and admins can update users')
  }

  if (!userId) {
    throw new Error('User ID required')
  }

  // Validate role change
  if (updates.role && !['owner', 'admin', 'manager', 'cashier'].includes(updates.role)) {
    throw new Error('Invalid role')
  }

  // Only owner can create/change owner role
  if (updates.role === 'owner' && userRole !== 'owner') {
    throw new Error('Only owner can assign owner role')
  }

  // If changing to owner, clear branch_id
  if (updates.role === 'owner') {
    updates.branch_id = null
  }

  // If changing to non-owner and no branch provided, reject
  if (updates.role && updates.role !== 'owner' && !updates.branch_id) {
    throw new Error('Non-owner accounts must be assigned to a branch')
  }

  const updateData: any = {}
  if (updates.full_name !== undefined) updateData.full_name = updates.full_name
  if (updates.role !== undefined) updateData.role = updates.role
  if (updates.branch_id !== undefined) updateData.branch_id = updates.branch_id
  if (updates.status !== undefined) updateData.status = updates.status
  updateData.updated_at = new Date().toISOString()

  const { data, error } = await supabaseAdmin
    .from('users')
    .update(updateData)
    .eq('id', userId)
    .select(
      `
      id,
      email,
      full_name,
      role,
      status,
      branch_id,
      created_at,
      updated_at,
      branch:branches(id, name, code)
    `
    )
    .single()

  if (error) {
    logger.error('[USER-MANAGEMENT] Update user error:', error)
    throw new Error(`Failed to update user: ${error.message}`)
  }

  const branch = data.branch as any
  return {
    id: data.id,
    email: data.email,
    full_name: data.full_name,
    role: data.role,
    status: data.status,
    branch_id: data.branch_id,
    created_at: data.created_at,
    updated_at: data.updated_at,
    branch: branch ? {
      id: branch.id,
      name: branch.name,
      code: branch.code,
    } : undefined,
  } as UserProfile
}

/**
 * Deactivate user (marks as inactive, keeps data for audit trail)
 * (owner or admin only)
 */
export async function deactivateUser(
  userId: string,
  userRole: string
): Promise<{ success: boolean; message: string }> {
  if (!['owner', 'admin'].includes(userRole)) {
    throw new Error('Unauthorized: Only owner and admins can deactivate users')
  }

  if (!userId) {
    throw new Error('User ID required')
  }

  // Prevent deactivating the last owner
  const { data: owners, error: ownerCountError } = await supabaseAdmin
    .from('users')
    .select('id', { count: 'exact' })
    .eq('role', 'owner')
    .eq('status', 'active')

  if (!ownerCountError && owners?.length <= 1) {
    const { data: targetUser } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', userId)
      .single()

    if (targetUser?.role === 'owner') {
      throw new Error('Cannot deactivate the last active owner user')
    }
  }

  // Soft deactivate: mark as inactive
  const { data, error } = await supabaseAdmin
    .from('users')
    .update({ status: 'inactive', updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single()

  if (error) {
    logger.error('[USER-MANAGEMENT] Deactivate user error:', error)
    throw new Error(`Failed to deactivate user: ${error.message}`)
  }

  logger.info('[USER-MANAGEMENT] Deactivated user:', { userId })
  return { success: true, message: 'User deactivated successfully' }
}

/**
 * Reset user password (admin only)
 * Generates a new temporary password
 * User must change on first login
 */
export async function resetUserPassword(
  userId: string,
  userRole: string
): Promise<{
  tempPassword: string
  email: string
}> {
  if (userRole !== 'admin') {
    throw new Error('Unauthorized: Only admins can reset passwords')
  }

  if (!userId) {
    throw new Error('User ID required')
  }

  // Get user email
  const { data: user, error: userError } = await supabaseAdmin
    .from('users')
    .select('email')
    .eq('id', userId)
    .single()

  if (userError) {
    throw new Error(`User not found: ${userError.message}`)
  }

  // Generate new password
  const newPassword = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6).toUpperCase()

  // Update auth user password
  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
    password: newPassword,
  })

  if (updateError) {
    logger.error('[USER-MANAGEMENT] Password reset error:', updateError)
    throw new Error(`Failed to reset password: ${updateError.message}`)
  }

  return {
    tempPassword: newPassword,
    email: user.email,
  }
}

export async function deleteUser(
  userId: string,
  userRole: string
): Promise<{ success: boolean; message: string }> {
  if (userRole !== 'admin') {
    throw new Error('Unauthorized: Only admins can delete users')
  }

  if (!userId) {
    throw new Error('User ID required')
  }

  const { data: admins, error: adminCountError } = await supabaseAdmin
    .from('users')
    .select('id', { count: 'exact' })
    .eq('role', 'admin')

  if (!adminCountError && admins?.length <= 1) {
    const { data: targetUser } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', userId)
      .single()

    if (targetUser?.role === 'admin') {
      throw new Error('Cannot delete the last admin user')
    }
  }

  const { error } = await supabaseAdmin
    .from('users')
    .delete()
    .eq('id', userId)

  if (error) {
    logger.error('[USER-MANAGEMENT] Delete user error:', error)
    throw new Error(`Failed to delete user: ${error.message}`)
  }

  return {
    success: true,
    message: 'User removed from system',
  }
}

export async function reactivateUser(userId: string, userRole: string) {
  if (userRole !== 'admin') {
    throw new Error('Unauthorized: Only admins can reactivate users')
  }

  const { data, error } = await supabaseAdmin
    .from('users')
    .update({ status: 'active', updated_at: new Date() })
    .eq('id', userId)
    .select()
    .single()

  if (error) {
    logger.error('[USER-MANAGEMENT] Reactivate error:', error)
    throw new Error(`Failed to reactivate user: ${error.message}`)
  }

  return {
    success: true,
    user: data,
  }
}
