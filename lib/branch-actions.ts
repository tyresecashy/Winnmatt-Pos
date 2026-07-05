'use server'
import { logger } from '@/lib/logger';

import { authenticateServerAction } from '@/lib/auth-helpers'
import { supabaseAdmin } from '@/lib/supabase-server'

export interface BranchRow {
  id: string
  name: string
  code: string
  location: string | null
  phone: string | null
  email: string | null
  latitude: number | null
  longitude: number | null
  open_time: string | null
  close_time: string | null
  tax_id: string | null
  tax_rate: number | null
  manager_id: string | null
  manager_name: string | null
  timezone: string
  type: 'main' | 'branch' | 'warehouse'
  status: 'active' | 'inactive'
  is_main: boolean
  created_at: string
  updated_at: string
}

function mapBranch(raw: Record<string, unknown>): BranchRow {
  const manager = raw.manager as { full_name?: string } | null | undefined
  return {
    id: raw.id as string,
    name: raw.name as string,
    code: raw.code as string,
    location: (raw.location as string) ?? null,
    phone: (raw.phone as string) ?? null,
    email: (raw.email as string) ?? null,
    latitude: (raw.latitude as number) ?? null,
    longitude: (raw.longitude as number) ?? null,
    open_time: (raw.open_time as string) ?? null,
    close_time: (raw.close_time as string) ?? null,
    tax_id: (raw.tax_id as string) ?? null,
    tax_rate: (raw.tax_rate as number) ?? null,
    manager_id: (raw.manager_id as string) ?? null,
    manager_name: manager?.full_name ?? null,
    timezone: (raw.timezone as string) ?? 'Africa/Nairobi',
    type: (raw.type as 'main' | 'branch' | 'warehouse') ?? 'branch',
    status: (raw.status as 'active' | 'inactive') ?? 'active',
    is_main: (raw.is_main as boolean) ?? false,
    created_at: raw.created_at as string,
    updated_at: (raw.updated_at as string) ?? raw.created_at as string,
  }
}

export async function getBranches(): Promise<BranchRow[]> {
  try {
    const authResult = await authenticateServerAction()
    if (!authResult.success || !authResult.profile) {
      logger.warn('[BRANCH] Fetch denied:', { error: authResult.error })
      return []
    }

    const { data, error } = await supabaseAdmin
      .from('branches')
      .select(`*, manager:users!manager_id(full_name)`)
      .order('name')

    if (error) throw error

    return (data || []).map((raw: unknown) => mapBranch(raw as Record<string, unknown>))
  } catch (error) {
    logger.error('[BRANCH] Error fetching branches:', error)
    return []
  }
}

export async function getBranchById(id: string): Promise<BranchRow | null> {
  try {
    const authResult = await authenticateServerAction()
    if (!authResult.success || !authResult.profile) {
      logger.warn('[BRANCH] Fetch by ID denied:', { error: authResult.error })
      return null
    }

    const { data, error } = await supabaseAdmin
      .from('branches')
      .select(`*, manager:users!manager_id(full_name)`)
      .eq('id', id)
      .single()

    if (error) throw error
    return data ? mapBranch(data as Record<string, unknown>) : null
  } catch (error) {
    logger.error('[BRANCH] Error fetching branch:', error)
    return null
  }
}

type CreateBranchData = {
  name: string
  code: string
  location?: string | null
  phone?: string | null
  email?: string | null
  latitude?: number | null
  longitude?: number | null
  open_time?: string | null
  close_time?: string | null
  tax_id?: string | null
  tax_rate?: number | null
  manager_id?: string | null
  timezone?: string
  type?: 'main' | 'branch' | 'warehouse'
  is_main?: boolean
}

export async function createBranch(data: CreateBranchData): Promise<BranchRow | null> {
  try {
    const authResult = await authenticateServerAction()
    if (!authResult.success || !authResult.profile) {
      logger.warn('[BRANCH] Create denied:', { error: authResult.error })
      return null
    }

    if (!['super_admin', 'admin'].includes(authResult.profile.role)) {
      logger.warn('[BRANCH] Create access denied:', { role: authResult.profile.role })
      return null
    }

    const now = new Date().toISOString()

    const { data: branch, error } = await supabaseAdmin
      .from('branches')
      .insert({
        name: data.name,
        code: data.code.toUpperCase(),
        location: data.location ?? null,
        phone: data.phone ?? null,
        email: data.email ?? null,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        open_time: data.open_time ?? null,
        close_time: data.close_time ?? null,
        tax_id: data.tax_id ?? null,
        tax_rate: data.tax_rate ?? null,
        manager_id: data.manager_id ?? null,
        timezone: data.timezone ?? 'Africa/Nairobi',
        type: data.type ?? 'branch',
        status: 'active',
        is_main: data.is_main ?? false,
        updated_at: now,
      })
      .select(`*, manager:users!manager_id(full_name)`)
      .single()

    if (error) throw error
    return branch ? mapBranch(branch as Record<string, unknown>) : null
  } catch (error) {
    logger.error('[BRANCH] Error creating branch:', error)
    return null
  }
}

type UpdateBranchData = Partial<CreateBranchData & { status?: 'active' | 'inactive' }>

export async function updateBranch(id: string, data: UpdateBranchData): Promise<BranchRow | null> {
  try {
    const authResult = await authenticateServerAction()
    if (!authResult.success || !authResult.profile) {
      logger.warn('[BRANCH] Update denied:', { error: authResult.error })
      return null
    }

    if (!['super_admin', 'admin'].includes(authResult.profile.role)) {
      logger.warn('[BRANCH] Update access denied:', { role: authResult.profile.role })
      return null
    }

    const updateData: Record<string, unknown> = { ...data, updated_at: new Date().toISOString() }

    if (updateData.code) {
      updateData.code = (updateData.code as string).toUpperCase()
    }

    const { data: branch, error } = await supabaseAdmin
      .from('branches')
      .update(updateData)
      .eq('id', id)
      .select(`*, manager:users!manager_id(full_name)`)
      .single()

    if (error) throw error
    return branch ? mapBranch(branch as Record<string, unknown>) : null
  } catch (error) {
    logger.error('[BRANCH] Error updating branch:', error)
    return null
  }
}

export async function toggleBranchStatus(id: string, isActive: boolean): Promise<BranchRow | null> {
  return updateBranch(id, { status: isActive ? 'active' : 'inactive' })
}

export async function getBranchManagers(): Promise<Array<{ id: string; full_name: string }>> {
  try {
    const authResult = await authenticateServerAction()
    if (!authResult.success || !authResult.profile) {
      return []
    }

    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id, full_name')
      .in('role', ['super_admin', 'admin', 'manager'])
      .eq('status', 'active')
      .order('full_name')

    if (error) throw error
    return data || []
  } catch (error) {
    logger.error('[BRANCH] Error fetching managers:', error)
    return []
  }
}
