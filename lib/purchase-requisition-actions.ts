'use server'

import { logger } from '@/lib/logger'

import { supabaseAdmin } from '@/lib/supabase-server'
import { authenticateServerAction } from '@/lib/auth-helpers'

export type RequisitionStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'cancelled'
export type RequisitionUrgency = 'low' | 'normal' | 'high' | 'urgent'

export interface PurchaseRequisition {
  id: string
  requisition_number: string
  branch_id: string
  supplier_id: string | null
  requester_id: string
  approver_id: string | null
  status: RequisitionStatus
  rejection_reason: string | null
  notes: string | null
  expected_date: string | null
  urgency: RequisitionUrgency
  created_at: string
  updated_at: string
}

export interface PurchaseRequisitionItem {
  id: string
  requisition_id: string
  product_id: string
  quantity_requested: number
  quantity_approved: number | null
  unit_price_estimate: number | null
  notes: string | null
  created_at: string
}

// ─── List ──────────────────────────────────────────────────

export async function getRequisitions(options?: { status?: RequisitionStatus; branchId?: string; limit?: number }) {
  await authenticateServerAction()

  let query = supabaseAdmin
    .from('purchase_requisitions')
    .select(`
      *,
      requester:users!requester_id(id, full_name),
      approver:users!approver_id(id, full_name),
      branch:branches(id, name),
      supplier:suppliers(id, company_name)
    `)
    .order('created_at', { ascending: false })
    .limit(options?.limit || 100)

  if (options?.status) query = query.eq('status', options.status)
  if (options?.branchId) query = query.eq('branch_id', options.branchId)

  const { data, error } = await query
  if (error) {
    if (error) logger.error('Operation failed', { error: error })
    throw new Error('Operation failed')
  }
  return data || []
}

export async function getRequisitionById(id: string) {
  await authenticateServerAction()

  const { data: req, error: reqErr } = await supabaseAdmin
    .from('purchase_requisitions')
    .select(`
      *,
      requester:users!requester_id(id, full_name),
      approver:users!approver_id(id, full_name),
      branch:branches(id, name),
      supplier:suppliers(id, company_name)
    `)
    .eq('id', id)
    .single()

  if (reqErr) {
        if (reqErr) logger.error('Operation failed', { error: reqErr })
        throw new Error('Operation failed')
      }

  const { data: items, error: itemsErr } = await supabaseAdmin
    .from('purchase_requisition_items')
    .select(`
      *,
      product:products(id, name, sku, unit_price)
    `)
    .eq('requisition_id', id)

  if (itemsErr) {
    logger.error('Operation failed', { error: itemsErr })
    throw new Error('Operation failed')
  }

  return { ...req, items: items || [] }
}

// ─── CRUD ──────────────────────────────────────────────────

export async function createRequisition(data: {
  branch_id: string
  supplier_id?: string
  notes?: string
  expected_date?: string
  urgency?: RequisitionUrgency
  items: Array<{
    product_id: string
    quantity_requested: number
    unit_price_estimate?: number
    notes?: string
  }>
}) {
  const { profile } = await authenticateServerAction()
  if (!profile) throw new Error('Unauthorized')

  // Create the requisition header
  const { data: req, error: reqErr } = await supabaseAdmin
    .from('purchase_requisitions')
    .insert({
      branch_id: data.branch_id,
      supplier_id: data.supplier_id || null,
      requester_id: profile.id,
      status: 'draft',
      notes: data.notes || null,
      expected_date: data.expected_date || null,
      urgency: data.urgency || 'normal',
    })
    .select()
    .single()

  if (reqErr) {
    logger.error('Operation failed', { error: reqErr })
    throw new Error('Operation failed')
  }

  if (!req) throw new Error('Operation failed')

  // Insert items
  if (data.items.length > 0) {
    const itemsToInsert = data.items.map(item => ({
      requisition_id: req!.id,
      product_id: item.product_id,
      quantity_requested: item.quantity_requested,
      unit_price_estimate: item.unit_price_estimate || null,
      notes: item.notes || null,
    }))

    const { error: itemsErr } = await supabaseAdmin
      .from('purchase_requisition_items')
      .insert(itemsToInsert)

    if (itemsErr) {
      logger.error('Operation failed', { error: itemsErr })
      throw new Error('Operation failed')
    }
  }

  return { success: true, id: req.id, requisition_number: req.requisition_number }
}

export async function updateRequisition(id: string, data: {
  supplier_id?: string | null
  notes?: string | null
  expected_date?: string | null
  urgency?: RequisitionUrgency
  items?: Array<{
    id?: string
    product_id: string
    quantity_requested: number
    unit_price_estimate?: number
    notes?: string
  }>
}) {
  const { profile } = await authenticateServerAction()
  if (!profile) throw new Error('Unauthorized')

  // Update header fields
  const updateData: Record<string, unknown> = {}
  if (data.supplier_id !== undefined) updateData.supplier_id = data.supplier_id
  if (data.notes !== undefined) updateData.notes = data.notes
  if (data.expected_date !== undefined) updateData.expected_date = data.expected_date
  if (data.urgency !== undefined) updateData.urgency = data.urgency

  if (Object.keys(updateData).length > 0) {
    const { error: hdrErr } = await supabaseAdmin
      .from('purchase_requisitions')
      .update(updateData)
      .eq('id', id)

    if (hdrErr) {
        if (hdrErr) logger.error('Operation failed', { error: hdrErr })
        throw new Error('Operation failed')
      }
  }

  // Replace items if provided
  if (data.items) {
    await supabaseAdmin.from('purchase_requisition_items').delete().eq('requisition_id', id)

    const itemsToInsert = data.items.map(item => ({
      requisition_id: id,
      product_id: item.product_id,
      quantity_requested: item.quantity_requested,
      unit_price_estimate: item.unit_price_estimate || null,
      notes: item.notes || null,
    }))

    const { error: itemsErr } = await supabaseAdmin
      .from('purchase_requisition_items')
      .insert(itemsToInsert)

    if (itemsErr) {
      logger.error('Operation failed', { error: itemsErr })
      throw new Error('Operation failed')
    }
  }

  return { success: true }
}

export async function deleteRequisition(id: string) {
  const { profile } = await authenticateServerAction()
  if (!profile) throw new Error('Unauthorized')

  // Only allow deletion of draft requisitions
  const { data: req } = await supabaseAdmin
    .from('purchase_requisitions')
    .select('status')
    .eq('id', id)
    .single()

  if (!req) throw new Error('Requisition not found')
  if (req.status !== 'draft') throw new Error('Only draft requisitions can be deleted')

  const { error } = await supabaseAdmin.from('purchase_requisitions').delete().eq('id', id)
  if (error) {
    if (error) logger.error('Operation failed', { error: error })
    throw new Error('Operation failed')
  }
  return { success: true }
}

// ─── Workflow ──────────────────────────────────────────────

export async function submitRequisition(id: string) {
  const { profile } = await authenticateServerAction()
  if (!profile) throw new Error('Unauthorized')

  const { error } = await supabaseAdmin
    .from('purchase_requisitions')
    .update({
      status: 'pending_approval',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'draft')

  if (error) {
    if (error) logger.error('Operation failed', { error: error })
    throw new Error('Operation failed')
  }
  return { success: true }
}

export async function approveRequisition(id: string, items?: Array<{ item_id: string; quantity_approved: number }>) {
  const { profile } = await authenticateServerAction()
  if (!profile) throw new Error('Unauthorized')

  const { error: reqErr } = await supabaseAdmin
    .from('purchase_requisitions')
    .update({
      status: 'approved',
      approver_id: profile.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'pending_approval')

  if (reqErr) {
        if (reqErr) logger.error('Operation failed', { error: reqErr })
        throw new Error('Operation failed')
      }

  // Update per-item approved quantities if provided
  if (items && items.length > 0) {
    for (const item of items) {
      await supabaseAdmin
        .from('purchase_requisition_items')
        .update({ quantity_approved: item.quantity_approved })
        .eq('id', item.item_id)
    }
  }

  return { success: true }
}

export async function rejectRequisition(id: string, reason: string) {
  const { profile } = await authenticateServerAction()
  if (!profile) throw new Error('Unauthorized')

  const { error } = await supabaseAdmin
    .from('purchase_requisitions')
    .update({
      status: 'rejected',
      approver_id: profile.id,
      rejection_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('status', 'pending_approval')

  if (error) {
    if (error) logger.error('Operation failed', { error: error })
    throw new Error('Operation failed')
  }
  return { success: true }
}

export async function cancelRequisition(id: string) {
  await authenticateServerAction()

  const { error } = await supabaseAdmin
    .from('purchase_requisitions')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', id)
    .in('status', ['draft', 'pending_approval'])

  if (error) {
    if (error) logger.error('Operation failed', { error: error })
    throw new Error('Operation failed')
  }
  return { success: true }
}

// ─── Create PO from Requisition ────────────────────────────

export async function getRequisitionForPO(id: string) {
  const { profile } = await authenticateServerAction()
  if (!profile) throw new Error('Unauthorized')

  const req = await getRequisitionById(id)
  if (req.status !== 'approved') throw new Error('Requisition must be approved before creating a PO')

  return {
    supplier_id: req.supplier_id,
    notes: req.notes,
    expected_date: req.expected_date,
    items: ((req.items || []) as Record<string, unknown>[]).map((item) => ({
      product_id: item.product_id as string,
      product_name: ((item.product as Record<string, unknown>)?.name as string) || '',
      sku: ((item.product as Record<string, unknown>)?.sku as string) || '',
      quantity: (item.quantity_approved as number) || (item.quantity_requested as number),
      unit_price: (item.unit_price_estimate as number) || ((item.product as Record<string, unknown>)?.unit_price as number) || 0,
      notes: item.notes as string,
    })),
  }
}
