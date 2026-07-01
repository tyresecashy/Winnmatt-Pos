import { logger } from '@/lib/logger';
/**
 * Staging Actions
 * Server actions for admin staging review and publish workflow
 */

'use server'

import { createClient } from '@/lib/supabase-server'
import {
  normalizeImportBatch,
  getStagingProducts,
} from '@/lib/product-normalizer'
import { dedupImportBatch } from '@/lib/product-deduplicator'
import { analyzeAndPriceBatch } from '@/lib/pricing-analyzer'

const uuidv4 = () => crypto.randomUUID()

/**
 * Start full processing pipeline for a batch
 * 1. Normalize raw imports
 * 2. Detect duplicates
 * 3. Analyze prices and detect anomalies
 */
export async function processBatch(batchId: string) {
  const supabase = await createClient()

  try {
    // Get batch
    const { data: batch } = await supabase
      .from('product_import_batches')
      .select('*')
      .eq('id', batchId)
      .single()

    if (!batch) {
      throw new Error('Batch not found')
    }

    // Step 1: Normalize
    logger.info('Step 1: Normalizing...')
    const normalizedCount = await normalizeImportBatch(batchId)

    // Step 2: Deduplicate
    logger.info('Step 2: Deduplicating...')
    const dedup = await dedupImportBatch(batchId)

    // Step 3: Analyze & Price
    logger.info('Step 3: Analyzing prices...')
    const pricing = await analyzeAndPriceBatch(batchId)

    // Update batch status to ready for review
    await supabase
      .from('product_import_batches')
      .update({
        status: 'staged',
        normalized_records: normalizedCount,
        completed_at: new Date().toISOString(),
      })
      .eq('id', batchId)

    return {
      success: true,
      normalized: normalizedCount,
      deduplication: dedup,
      pricing: pricing,
    }
  } catch (error: any) {
    logger.error('Batch processing failed:', error)

    // Mark batch as failed
    await supabase
      .from('product_import_batches')
      .update({ status: 'failed' })
      .eq('id', batchId)

    throw new Error(`Processing failed: ${error.message}`)
  }
}

/**
 * Update a staging product's suggested price
 * Admin can override the automatic suggestion
 */
export async function updateStagingPrice(
  stagingProductId: string,
  suggestedPrice: number
) {
  const supabase = await createClient()

  // Validate price
  if (!Number.isInteger(suggestedPrice) || suggestedPrice < 10 || suggestedPrice > 500000) {
    throw new Error('Price must be between 10 and 500000 KES')
  }

  const { error } = await supabase
    .from('products_staging')
    .update({
      suggested_selling_price: suggestedPrice,
      review_status: 'pending', // Mark as needing review
    })
    .eq('product_id', stagingProductId)

  if (error) {
    throw new Error(`Failed to update price: ${error.message}`)
  }

  return { success: true }
}

/**
 * Approve a staging product for publishing to live
 */
export async function approveStagingProduct(
  stagingProductId: string,
  approverUserId: string
) {
  const supabase = await createClient()

  const { data: staging } = await supabase
    .from('products_staging')
    .select('*')
    .eq('product_id', stagingProductId)
    .single()

  if (!staging) {
    throw new Error('Staging product not found')
  }

  // Check for critical anomalies - must be resolved before approval
  const { data: criticalAnomalies } = await supabase
    .from('price_anomalies')
    .select('*')
    .eq('staging_product_id', stagingProductId)
    .eq('severity', 'critical')

  if (criticalAnomalies && criticalAnomalies.length > 0) {
    throw new Error(
      `Cannot approve: product has ${criticalAnomalies.length} critical anomalies`
    )
  }

  // Mark as approved
  const { error } = await supabase
    .from('products_staging')
    .update({
      review_status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: approverUserId,
    })
    .eq('product_id', stagingProductId)

  if (error) {
    throw new Error(`Failed to approve: ${error.message}`)
  }

  return { success: true }
}

/**
 * Reject a staging product - keep for audit but don't publish
 */
export async function rejectStagingProduct(
  stagingProductId: string,
  reason: string,
  approverUserId: string
) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('products_staging')
    .update({
      review_status: 'rejected',
      rejection_reason: reason,
      approved_by: approverUserId,
    })
    .eq('product_id', stagingProductId)

  if (error) {
    throw new Error(`Failed to reject: ${error.message}`)
  }

  return { success: true }
}

/**
 * Publish approved staging products to live products table
 * DO NOT publish products with critical anomalies
 * DO NOT overwrite existing live prices unless explicitly approved
 */
export async function publishBatchToLive(batchId: string, publisherUserId: string) {
  const supabase = await createClient()

  try {
    // Get all approved products in batch
    const { data: approved } = await supabase
      .from('products_staging')
      .select('*')
      .eq('batch_id', batchId)
      .eq('review_status', 'approved')

    if (!approved || approved.length === 0) {
      return {
        published: 0,
        updated: 0,
        error: 'No approved products to publish',
      }
    }

    let publishedCount = 0
    let updatedCount = 0
    const publishedIds: string[] = []

    // Publish each approved product
    for (const staging of approved) {
      // Check if product exists in live (by source_product_id + source combo)
      const { data: existing } = await supabase
        .from('products')
        .select('*')
        .eq('source_product_id', staging.source_product_id)
        .eq('source_id', staging.source_name)
        .maybeSingle()

      if (existing) {
        // Update existing product
        const { error } = await supabase
          .from('products')
          .update({
            name: staging.normalized_name,
            brand: staging.brand,
            unit: staging.unit,
            barcode: staging.barcode,
            image_url: staging.image_url,
            selling_price: staging.suggested_selling_price || existing.selling_price,
            status: 'active',
            source_id: staging.source_name,
            source_product_id: staging.source_product_id,
            approved_at: new Date().toISOString(),
            approved_by: publisherUserId,
          })
          .eq('id', existing.id)

        if (!error) updatedCount++
      } else {
        // Create new product
        const newProduct = {
          id: uuidv4(),
          name: staging.normalized_name,
          sku: `${staging.source_name}-${staging.source_product_id}`.toLowerCase(),
          brand: staging.brand,
          unit: staging.unit,
          barcode: staging.barcode,
          image_url: staging.image_url,
          cost_price: staging.listed_price,
          selling_price: staging.suggested_selling_price || staging.listed_price,
          status: 'active',
          source_id: staging.source_name,
          source_product_id: staging.source_product_id,
          approved_at: new Date().toISOString(),
          approved_by: publisherUserId,
          created_at: new Date().toISOString(),
        }

        const { error } = await supabase.from('products').insert(newProduct)
        if (!error) publishedCount++
      }

      publishedIds.push(staging.product_id)
    }

    // Mark staged products as published
    if (publishedIds.length > 0) {
      await supabase
        .from('products_staging')
        .update({
          review_status: 'published',
          published_at: new Date().toISOString(),
        })
        .in('product_id', publishedIds)
    }

    // Update batch status
    await supabase
      .from('product_import_batches')
      .update({
        status: 'published',
        published_at: new Date().toISOString(),
      })
      .eq('id', batchId)

    return {
      published: publishedCount,
      updated: updatedCount,
      total: publishedCount + updatedCount,
      success: true,
    }
  } catch (error: any) {
    logger.error('Publish failed:', error)
    throw new Error(`Publish failed: ${error.message}`)
  }
}

/**
 * Get staging products for batch with all related data
 */
export async function getBatchStagingWithRelated(
  batchId: string,
  filters?: {
    reviewStatus?: string
    hasCriticalAnomalies?: boolean
  }
) {
  const supabase = await createClient()

  let query = supabase
    .from('products_staging')
    .select('*')
    .eq('batch_id', batchId)

  if (filters?.reviewStatus) {
    query = query.eq('review_status', filters.reviewStatus)
  }

  const { data: staging, error: stagingError } = await query.order('confidence_score', {
    ascending: false,
  })

  if (stagingError) {
    throw new Error(`Failed to get staging: ${stagingError.message}`)
  }

  // Fetch related data for each product
  const withRelated = await Promise.all(
    (staging || []).map(async (product) => {
      // Get anomalies
      const { data: anomalies } = await supabase
        .from('price_anomalies')
        .select('*')
        .eq('staging_product_id', product.product_id)

      // Get deduplication matches
      const { data: dedups } = await supabase
        .from('product_deduplications')
        .select('*')
        .eq('staging_product_id', product.product_id)

      return {
        ...product,
        anomalies: anomalies || [],
        deduplications: dedups || [],
      }
    })
  )

  return withRelated
}

/**
 * Get batch summary stats
 */
export async function getBatchSummary(batchId: string) {
  const supabase = await createClient()

  // Basic batch info
  const { data: batch } = await supabase
    .from('product_import_batches')
    .select('*')
    .eq('id', batchId)
    .single()

  if (!batch) {
    throw new Error('Batch not found')
  }

  // Count by review status
  const { count: pending } = await supabase
    .from('products_staging')
    .select('id', { count: 'exact', head: true })
    .eq('batch_id', batchId)
    .eq('review_status', 'pending')

  const { count: approved } = await supabase
    .from('products_staging')
    .select('id', { count: 'exact', head: true })
    .eq('batch_id', batchId)
    .eq('review_status', 'approved')

  const { count: published } = await supabase
    .from('products_staging')
    .select('id', { count: 'exact', head: true })
    .eq('batch_id', batchId)
    .eq('review_status', 'published')

  // Count anomalies by severity
  const { count: criticalAnomalies } = await supabase
    .from('price_anomalies')
    .select('id', { count: 'exact', head: true })
    .eq('batch_id', batchId)
    .eq('severity', 'critical')

  const { count: warningAnomalies } = await supabase
    .from('price_anomalies')
    .select('id', { count: 'exact', head: true })
    .eq('batch_id', batchId)
    .eq('severity', 'warning')

  return {
    batch,
    staging: {
      pending: pending || 0,
      approved: approved || 0,
      published: published || 0,
      total:
        (pending || 0) + (approved || 0) + (published || 0),
    },
    anomalies: {
      critical: criticalAnomalies || 0,
      warning: warningAnomalies || 0,
      total: (criticalAnomalies || 0) + (warningAnomalies || 0),
    },
  }
}
