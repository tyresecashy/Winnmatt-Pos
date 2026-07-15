'use server'

import { logger } from '@/lib/logger'
import { authenticateServerAction } from '@/lib/auth-helpers'
import { supabaseAdmin } from '@/lib/supabase-server'

export interface Segment {
  id: string
  name: string
  slug: string
  description: string | null
  color: string
  created_at: string
  updated_at: string
}

// ─── Segments CRUD ──────────────────────────────────────────────────────────

export async function getSegments(): Promise<Segment[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('customer_segments')
      .select('*')
      .order('name', { ascending: true })

    if (error) throw error
    return (data || []) as Segment[]
  } catch (error) {
    logger.error('[SEGMENTS] Failed to fetch segments:', error)
    return []
  }
}


// ─── Membership ─────────────────────────────────────────────────────────────

export async function getCustomerSegments(customerId: string): Promise<Segment[]> {
  try {
    // First get the segment IDs this customer belongs to
    const { data: memberships, error: membershipError } = await supabaseAdmin
      .from('customer_segment_members')
      .select('segment_id')
      .eq('customer_id', customerId)

    if (membershipError) throw membershipError
    if (!memberships || memberships.length === 0) return []

    // Then fetch the actual segments
    const ids = memberships.map((m) => m.segment_id)
    const { data: segments, error: segmentsError } = await supabaseAdmin
      .from('customer_segments')
      .select('*')
      .in('id', ids)
      .order('name', { ascending: true })

    if (segmentsError) throw segmentsError
    return (segments || []) as Segment[]
  } catch (error) {
    logger.error('[SEGMENTS] Failed to fetch customer segments:', error)
    return []
  }
}

export async function assignCustomerToSegment(
  customerId: string,
  segmentId: string,
  assignedBy?: string
): Promise<boolean> {
  try {
    const authResult = await authenticateServerAction()
    if (!authResult.success) throw new Error('Unauthorized')

    const { error } = await supabaseAdmin
      .from('customer_segment_members')
      .insert({
        customer_id: customerId,
        segment_id: segmentId,
        assigned_by: assignedBy || null,
      })

    if (error) {
      // Ignore duplicate key errors (already assigned)
      if (error.code === '23505') return true
      throw error
    }
    return true
  } catch (error) {
    logger.error('[SEGMENTS] Failed to assign segment:', error)
    return false
  }
}

export async function setCustomerSegments(
  customerId: string,
  segmentIds: string[],
  assignedBy?: string
): Promise<boolean> {
  try {
    const authResult = await authenticateServerAction()
    if (!authResult.success) throw new Error('Unauthorized')

    // Remove all existing assignments
    const { error: deleteError } = await supabaseAdmin
      .from('customer_segment_members')
      .delete()
      .eq('customer_id', customerId)

    if (deleteError) throw deleteError

    // Insert new assignments
    if (segmentIds.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from('customer_segment_members')
        .insert(
          segmentIds.map((segmentId) => ({
            customer_id: customerId,
            segment_id: segmentId,
            assigned_by: assignedBy || null,
          }))
        )

      if (insertError) throw insertError
    }

    return true
  } catch (error) {
    logger.error('[SEGMENTS] Failed to set customer segments:', error)
    return false
  }
}
