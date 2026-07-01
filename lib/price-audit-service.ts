// Price protection and audit service
// Detects anomalies, flags suspicious prices, manages review workflow

import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/db.types'

const createClient = () => supabase

// TODO: These tables don't exist in current schema - file is legacy/unused
// type PriceAnomaly = Database['public']['Tables']['price_anomalies']['Row']
// type PriceAuditLog = Database['public']['Tables']['price_audit_log']['Row']
// type PriceProtection = Database['public']['Tables']['price_protections']['Row']

// =============================================================================
// ANOMALY DETECTION
// =============================================================================

export interface DetectedAnomaly {
  productId: string
  anomalyType: string
  description: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  currentSellingPrice: number
  currentPurchasePrice: number
  suggestedSellingPrice?: number
  suggestedPurchasePrice?: number
  suggestionReason?: string
  blocksApproval: boolean
}

const ANOMALY_RULES = {
  HIGH_RETAIL_PRICE: {
    threshold: 5000,
    description: 'Selling price appears unrealistically high (>5000 KES)',
    severity: 'high' as const,
    blocksApproval: true,
  },
  HIGH_COST_PRICE: {
    threshold: 3000,
    description: 'Cost price appears unrealistically high (>3000 KES)',
    severity: 'medium' as const,
    blocksApproval: false,
  },
  COST_GT_SELLING: {
    description: 'Cost price is higher than selling price (losing money)',
    severity: 'critical' as const,
    blocksApproval: true,
  },
  EXCESSIVE_MARGIN: {
    threshold: 300, // 300%
    description: 'Profit margin is extremely high (>300%)',
    severity: 'high' as const,
    blocksApproval: true,
  },
  LOW_MARGIN: {
    threshold: 10, // 10%
    description: 'Profit margin is very low (<10%)',
    severity: 'medium' as const,
    blocksApproval: false,
  },
}

export async function detectPriceAnomalies(
  sellingPrice: number,
  purchasePrice: number,
  productId?: string,
  productName?: string
): Promise<DetectedAnomaly[]> {
  const anomalies: DetectedAnomaly[] = []

  // Check HIGH_RETAIL_PRICE
  if (sellingPrice > ANOMALY_RULES.HIGH_RETAIL_PRICE.threshold) {
    anomalies.push({
      productId: productId || 'unknown',
      anomalyType: 'HIGH_RETAIL_PRICE',
      description: ANOMALY_RULES.HIGH_RETAIL_PRICE.description,
      severity: ANOMALY_RULES.HIGH_RETAIL_PRICE.severity,
      currentSellingPrice: sellingPrice,
      currentPurchasePrice: purchasePrice,
      blocksApproval: ANOMALY_RULES.HIGH_RETAIL_PRICE.blocksApproval,
      suggestedSellingPrice: Math.round(sellingPrice / 30), // Divide by ~30 if seed data
      suggestionReason: 'Price appears to be 30-50x too high (likely seed data error)',
    })
  }

  // Check HIGH_COST_PRICE
  if (purchasePrice > ANOMALY_RULES.HIGH_COST_PRICE.threshold) {
    anomalies.push({
      productId: productId || 'unknown',
      anomalyType: 'HIGH_COST_PRICE',
      description: ANOMALY_RULES.HIGH_COST_PRICE.description,
      severity: ANOMALY_RULES.HIGH_COST_PRICE.severity,
      currentSellingPrice: sellingPrice,
      currentPurchasePrice: purchasePrice,
      blocksApproval: ANOMALY_RULES.HIGH_COST_PRICE.blocksApproval,
    })
  }

  // Check COST_GT_SELLING
  if (purchasePrice > sellingPrice && purchasePrice > 0) {
    anomalies.push({
      productId: productId || 'unknown',
      anomalyType: 'COST_GT_SELLING',
      description: ANOMALY_RULES.COST_GT_SELLING.description,
      severity: ANOMALY_RULES.COST_GT_SELLING.severity,
      currentSellingPrice: sellingPrice,
      currentPurchasePrice: purchasePrice,
      blocksApproval: ANOMALY_RULES.COST_GT_SELLING.blocksApproval,
      suggestedSellingPrice: Math.round(purchasePrice * 1.25), // 25% markup minimum
      suggestionReason: 'Cost > Selling: Suggest 25-50% markup on cost',
    })
  }

  // Check margins
  if (purchasePrice > 0) {
    const marginPercent = ((sellingPrice - purchasePrice) / purchasePrice) * 100

    // EXCESSIVE_MARGIN
    if (marginPercent > ANOMALY_RULES.EXCESSIVE_MARGIN.threshold) {
      anomalies.push({
        productId: productId || 'unknown',
        anomalyType: 'EXCESSIVE_MARGIN',
        description: ANOMALY_RULES.EXCESSIVE_MARGIN.description,
        severity: ANOMALY_RULES.EXCESSIVE_MARGIN.severity,
        currentSellingPrice: sellingPrice,
        currentPurchasePrice: purchasePrice,
        blocksApproval: ANOMALY_RULES.EXCESSIVE_MARGIN.blocksApproval,
        suggestedSellingPrice: Math.round(purchasePrice * 2), // 100% markup
        suggestionReason: `Current margin is ${Math.round(marginPercent)}%, typical retail is 25-100%`,
      })
    }

    // LOW_MARGIN
    if (marginPercent < ANOMALY_RULES.LOW_MARGIN.threshold) {
      anomalies.push({
        productId: productId || 'unknown',
        anomalyType: 'LOW_MARGIN',
        description: ANOMALY_RULES.LOW_MARGIN.description,
        severity: ANOMALY_RULES.LOW_MARGIN.severity,
        currentSellingPrice: sellingPrice,
        currentPurchasePrice: purchasePrice,
        blocksApproval: ANOMALY_RULES.LOW_MARGIN.blocksApproval,
        suggestedSellingPrice: Math.round(purchasePrice * 1.25), // 25% minimum
        suggestionReason: `Current margin is only ${Math.round(marginPercent)}%, recommend at least 15-25%`,
      })
    }
  }

  return anomalies
}

// =============================================================================
// PRICE PROTECTION CHECKS
// =============================================================================

export async function checkPriceProtection(productId: string) {
  const supabase = createClient()

  const { data: protection, error } = await supabase
    .from('price_protections')
    .select('*')
    .eq('product_id', productId)
    .maybeSingle()

  if (error && error.code !== 'PGRST116') {
    throw error
  }

  return protection
}

export async function isPriceProtected(productId: string): Promise<boolean> {
  const protection = await checkPriceProtection(productId)
  if (!protection) return false

  // Check if protection has expired
  if (protection.expires_at && new Date(protection.expires_at) < new Date()) {
    return false
  }

  return protection.protection_level === 'high'
}

// =============================================================================
// ADMIN REVIEW WORKFLOW
// =============================================================================

export async function flagProductForReview(
  productId: string,
  anomalies: DetectedAnomaly[],
  batchId?: string
) {
  const supabase = createClient()
  const anomalyInserts = anomalies.map((a) => ({
    product_id: productId,
    batch_id: batchId || null,
    anomaly_type: a.anomalyType,
    description: a.description,
    severity: a.severity,
    current_selling_price: a.currentSellingPrice,
    current_purchase_price: a.currentPurchasePrice,
    suggested_selling_price: a.suggestedSellingPrice || null,
    suggested_purchase_price: a.suggestedPurchasePrice || null,
    suggestion_reason: a.suggestionReason || null,
    status: 'flagged',
  }))

  const { error } = await supabase
    .from('price_anomalies')
    .insert(anomalyInserts)

  if (error) throw error

  // Update product status to flagged
  await supabase
    .from('products')
    .update({
      price_review_status: 'flagged',
      price_trust_level: 'low',
    })
    .eq('id', productId)
}

export async function approvePriceReview(
  productId: string,
  reviewedBy: string,
  notes?: string
) {
  const supabase = createClient()

  // Update product
  const { error: updateError } = await supabase
    .from('products')
    .update({
      price_review_status: 'approved',
      price_reviewed_by: reviewedBy,
      price_reviewed_at: new Date().toISOString(),
      price_review_notes: notes,
    })
    .eq('id', productId)

  if (updateError) throw updateError

  // Mark all anomalies as approved
  const { error: anomalyError } = await supabase
    .from('price_anomalies')
    .update({
      status: 'approved',
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
      admin_notes: notes,
    })
    .eq('product_id', productId)
    .eq('status', 'flagged')

  if (anomalyError) throw anomalyError
}

export async function rejectPriceReview(
  productId: string,
  newSellingPrice: number,
  newPurchasePrice: number,
  reviewedBy: string,
  reason: string
) {
  const supabase = createClient()

  // Get current product for audit log
  const { data: product } = await supabase
    .from('products')
    .select('*')
    .eq('id', productId)
    .single()

  if (!product) throw new Error('Product not found')

  // Update product with corrected prices
  const { error: updateError } = await supabase
    .from('products')
    .update({
      selling_price: newSellingPrice,
      purchase_price: newPurchasePrice,
      price_review_status: 'approved',
      price_reviewed_by: reviewedBy,
      price_reviewed_at: new Date().toISOString(),
      price_review_notes: reason,
    })
    .eq('id', productId)

  if (updateError) throw updateError

  // Log the change
  await supabase.from('price_audit_log').insert({
    product_id: productId,
    previous_selling_price: product.selling_price,
    previous_purchase_price: product.purchase_price,
    previous_price_source: product.price_source,
    previous_price_review_status: product.price_review_status,
    new_selling_price: newSellingPrice,
    new_purchase_price: newPurchasePrice,
    new_price_source: 'manual',
    new_price_review_status: 'approved',
    change_type: 'correction',
    change_reason: reason,
    reviewed_by: reviewedBy,
  })

  // Mark anomalies as corrected
  await supabase
    .from('price_anomalies')
    .update({
      status: 'corrected',
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
      admin_notes: reason,
    })
    .eq('product_id', productId)
    .eq('status', 'flagged')
}

export async function protectPrice(
  productId: string,
  protectedBy: string,
  protectionLevel: 'high' | 'medium' = 'high',
  reason?: string,
  expiresAt?: Date
) {
  const supabase = createClient()

  const { error } = await supabase.from('price_protections').insert({
    product_id: productId,
    protection_level: protectionLevel,
    reason: reason,
    protected_by: protectedBy,
    protected_at: new Date().toISOString(),
    expires_at: expiresAt?.toISOString() || null,
  })

  if (error) throw error
}

// =============================================================================
// REVIEW STATUS QUERIES
// =============================================================================

export async function getProductsNeedingReview(limit = 50) {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('products')
    .select(
      `
      id, sku, name, 
      selling_price, purchase_price,
      price_review_status,
      price_trust_level,
      category_id,
      created_at
    `
    )
    .eq('price_review_status', 'needs_review')
    .limit(limit)

  if (error) throw error
  return data
}

export async function getFlaggedProducts(limit = 100) {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('price_anomalies')
    .select(
      `
      id,
      product_id,
      anomaly_type,
      description,
      severity,
      current_selling_price,
      current_purchase_price,
      suggested_selling_price,
      suggested_purchase_price,
      suggestion_reason,
      products(id, sku, name, category_id)
    `
    )
    .eq('status', 'flagged')
    .order('severity', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data
}

export async function getAnomalySummary() {
  const supabase = createClient()

  const { data, error } = await supabase
    .from('price_anomalies')
    .select('severity, status', { count: 'exact' })

  if (error) throw error

  const summary = {
    total: 0,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    flagged: 0,
    approved: 0,
    rejected: 0,
  }

  data?.forEach((row: any) => {
    summary.total++
    ;(summary as any)[row.severity]++
    ;(summary as any)[row.status]++
  })

  return summary
}
