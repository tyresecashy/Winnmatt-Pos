'use server'

import { logger } from '@/lib/logger';
import { supabaseAdmin } from '@/lib/supabase-server'

export async function getUserProfile(userId: string) {
  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select(`
        id,
        email,
        full_name,
        role,
        branch_id,
        branch:branches!branch_id(id, name, code)
      `)
      .eq('id', userId)
      .single()

    if (error) throw error
    return data
  } catch (error) {
    logger.error('Error fetching user profile:', error)
    return null
  }
}

export async function createUserProfile(userId: string, email: string, fullName: string, branchId: string, role: 'cashier' | 'manager' | 'admin' = 'cashier') {
  try {
    const { data, error } = await supabaseAdmin
      .from('users')
      .insert({
        id: userId,
        email,
        full_name: fullName,
        branch_id: branchId,
        role,
      })
      .select()
      .single()

    if (error) throw error
    return data
  } catch (error) {
    logger.error('Error creating user profile:', error)
    return null
  }
}

export async function getBranches() {
  try {
    const { data, error } = await supabaseAdmin
      .from('branches')
      .select('*')
      .order('is_main', { ascending: false })

    if (error) throw error
    return data || []
  } catch (error) {
    logger.error('Error fetching branches:', error)
    return []
  }
}

export async function getMainBranch() {
  try {
    const { data, error } = await supabaseAdmin
      .from('branches')
      .select('*')
      .eq('is_main', true)
      .single()

    if (error) throw error
    return data
  } catch (error) {
    logger.error('Error fetching main branch:', error)
    return null
  }
}
