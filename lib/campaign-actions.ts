'use server'
import { logger } from '@/lib/logger'
import { authenticateServerAction, authorizeInventoryControlProfile } from '@/lib/auth-helpers'
import { supabaseAdmin } from '@/lib/supabase-server'

export interface Campaign {
  id: string
  name: string
  description: string | null
  multiplier: number
  start_date: string
  end_date: string
  category_filters: string[] | null
  tier_filters: string[] | null
  product_ids: string[] | null
  branch_ids: string[] | null
  status: 'draft' | 'scheduled' | 'active' | 'ended' | 'cancelled'
  created_by: string | null
  created_at: string
  updated_at: string
}

const validStatuses = ['draft', 'scheduled', 'active', 'ended', 'cancelled'] as const

export async function getCampaigns(status?: string): Promise<Campaign[]> {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile) return []

    let query = supabaseAdmin.from('campaigns').select('*').order('start_date', { ascending: false })
    if (status && (validStatuses as readonly string[]).includes(status)) query = query.eq('status', status)
    const { data, error } = await query
    if (error) throw error
    return (data || []) as unknown as Campaign[]
  } catch (error) {
    logger.error('Error fetching campaigns:', error)
    return []
  }
}

export async function getCampaignById(id: string): Promise<Campaign | null> {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile) return null

    const { data, error } = await supabaseAdmin.from('campaigns').select('*').eq('id', id).single()
    if (error) throw error
    return data as unknown as Campaign
  } catch (error) {
    logger.error('Error fetching campaign:', error)
    return null
  }
}

export async function createCampaign(data: {
  name: string
  description?: string
  multiplier: number
  start_date: string
  end_date: string
  category_filters?: string[]
  tier_filters?: string[]
  product_ids?: string[]
  branch_ids?: string[]
  status?: string
}): Promise<Campaign | null> {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile) return null

    const { data: campaign, error } = await supabaseAdmin.from('campaigns').insert({
      name: data.name,
      description: data.description || null,
      multiplier: data.multiplier,
      start_date: data.start_date,
      end_date: data.end_date,
      category_filters: data.category_filters || [],
      tier_filters: data.tier_filters || [],
      product_ids: data.product_ids || [],
      branch_ids: data.branch_ids || [],
      status: data.status || 'draft',
      created_by: auth.profile.id,
    }).select().single()

    if (error) throw error
    return campaign as unknown as Campaign
  } catch (error) {
    logger.error('Error creating campaign:', error)
    return null
  }
}

export async function updateCampaign(id: string, data: Partial<Campaign>): Promise<Campaign | null> {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile) return null

    const { data: campaign, error } = await supabaseAdmin
      .from('campaigns')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return campaign as unknown as Campaign
  } catch (error) {
    logger.error('Error updating campaign:', error)
    return null
  }
}

export async function deleteCampaign(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const auth = await authenticateServerAction()
    if (!auth.success || !auth.profile) return { success: false, error: 'Unauthorized' }

    const { error } = await supabaseAdmin.from('campaigns').delete().eq('id', id)
    if (error) throw error
    return { success: true }
  } catch (error) {
    logger.error('Error deleting campaign:', error)
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}
