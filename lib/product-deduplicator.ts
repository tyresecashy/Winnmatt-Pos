/**
 * Product Deduplication Service
 * Identifies duplicate products using deterministic and fuzzy matching
 */

import { createClient } from '@/lib/supabase-server'

const uuidv4 = () => crypto.randomUUID()

/**
 * Simple Levenshtein distance for fuzzy matching
 * Returns similarity score 0-100
 */
export function levenshteinSimilarity(str1: string, str2: string): number {
  const len1 = str1.length
  const len2 = str2.length
  const matrix: number[][] = []

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i]
  }

  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j] + 1, // deletion
        matrix[i - 1][j - 1] + cost // substitution
      )
    }
  }

  const distance = matrix[len1][len2]
  const maxLen = Math.max(len1, len2)
  return 100 - (distance / maxLen) * 100
}

/**
 * Check if two products match deterministically
 * Exact match: same source + same source_product_id
 * Same normalized name + brand + unit
 */
export function isDeterministicMatch(
  product1: any,
  product2: any,
  existingProduct?: any
): boolean {
  // Same source & source ID = definite duplicate from same source
  if (
    product1.source_name === product2.source_name &&
    product1.source_product_id === product2.source_product_id
  ) {
    return true
  }

  // Check against existing live products
  if (existingProduct) {
    // Exact barcode match (high confidence)
    if (
      product1.barcode &&
      product2.barcode &&
      product1.barcode === product2.barcode
    ) {
      return true
    }

    // Exact normalized name + brand + unit match
    if (
      product1.normalized_name === product2.normalized_name &&
      product1.brand === product2.brand &&
      product1.unit === product2.unit
    ) {
      return true
    }
  }

  return false
}

/**
 * Check if two products might be a fuzzy match
 * Similar names + same brand + same unit = possible duplicate
 */
export function isFuzzyMatch(
  product1: any,
  product2: any,
  threshold = 85
): {
  isMatch: boolean
  similarity: number
  reason: string
} {
  // Same source as existing products - fuzzy match less reliable
  if (product1.source_name === 'web_scraper' && product2.source_name === 'csv_import') {
    // Different sources, increase threshold
    threshold = 90
  }

  const similarity = levenshteinSimilarity(
    product1.normalized_name,
    product2.normalized_name
  )

  // Similar names
  if (similarity >= threshold) {
    // Also must have:
    // - Same or both empty brand
    // - Same or both empty unit
    const brandMatch = (product1.brand || '') === (product2.brand || '')
    const unitMatch = (product1.unit || '') === (product2.unit || '')

    if (brandMatch && unitMatch) {
      return {
        isMatch: true,
        similarity: Math.round(similarity),
        reason: `Name similarity ${Math.round(similarity)}% + matching brand/unit`,
      }
    }
  }

  return {
    isMatch: false,
    similarity: Math.round(similarity),
    reason: `Name similarity only ${Math.round(similarity)}%`,
  }
}

/**
 * Find potential duplicates for a staging product
 */
export async function findPotentialDuplicates(
  stagingProduct: any,
  batchId: string
): Promise<
  Array<{
    matchedProductId: string
    matchType: 'deterministic' | 'fuzzy'
    confidence: number
    reason: string
  }>
> {
  const supabase = await createClient()
  const matches: Array<{
    matchedProductId: string
    matchType: 'deterministic' | 'fuzzy'
    confidence: number
    reason: string
  }> = []

  // 1. Check other staging products from same batch
  const { data: otherStaging } = await supabase
    .from('products_staging')
    .select('*')
    .eq('batch_id', batchId)
    .neq('product_id', stagingProduct.product_id)

  if (otherStaging) {
    for (const other of otherStaging) {
      if (isDeterministicMatch(stagingProduct, other)) {
        matches.push({
          matchedProductId: other.product_id,
          matchType: 'deterministic',
          confidence: 100,
          reason: 'Exact match on source/source_id or normalized fields',
        })
      } else {
        const fuzzy = isFuzzyMatch(stagingProduct, other, 85)
        if (fuzzy.isMatch) {
          matches.push({
            matchedProductId: other.product_id,
            matchType: 'fuzzy',
            confidence: fuzzy.similarity,
            reason: fuzzy.reason,
          })
        }
      }
    }
  }

  // 2. Check against live products (only deterministic for now)
  const { data: liveProducts } = await supabase
    .from('products')
    .select('*')
    .eq('status', 'active')

  if (liveProducts) {
    for (const live of liveProducts) {
      // Convert live product to comparable format
      const liveFormatted = {
        normalized_name: live.name?.toLowerCase().replace(/\s+/g, ' ').trim(),
        brand: live.brand,
        unit: live.unit,
        barcode: live.barcode,
      }

      if (isDeterministicMatch(stagingProduct, liveFormatted, live)) {
        matches.push({
          matchedProductId: live.id,
          matchType: 'deterministic',
          confidence: 100,
          reason: 'Exact match with existing live product',
        })
      }
    }
  }

  return matches
}

/**
 * Record deduplication event (for audit trail)
 */
export async function recordDeduplication(
  batchId: string,
  stagingProductId: string,
  matchedProductId: string,
  matchType: 'deterministic' | 'fuzzy',
  confidence: number,
  reason: string,
  action: 'merged' | 'flagged' | 'ignored'
) {
  const supabase = await createClient()

  const { error } = await supabase.from('product_deduplications').insert({
    id: uuidv4(),
    batch_id: batchId,
    staging_product_id: stagingProductId,
    matched_product_id: matchedProductId,
    match_type: matchType,
    confidence,
    reason,
    action,
    created_at: new Date().toISOString(),
  })

  if (error) {
    throw new Error(`Failed to record deduplication: ${error.message}`)
  }
}

/**
 * Process deduplication for entire batch
 * - Mark deterministic matches as 'duplicate'
 * - Flag fuzzy matches for manual review
 */
export async function dedupImportBatch(batchId: string): Promise<{
  deterministic: number
  fuzzy: number
  processed: number
}> {
  const supabase = await createClient()

  const { data: stagingProducts, error: fetchError } = await supabase
    .from('products_staging')
    .select('*')
    .eq('batch_id', batchId)

  if (fetchError) {
    throw new Error(`Failed to fetch staging products: ${fetchError.message}`)
  }

  if (!stagingProducts || stagingProducts.length === 0) {
    return { deterministic: 0, fuzzy: 0, processed: 0 }
  }

  let deterministicCount = 0
  let fuzzyCount = 0

  // Process each product
  for (const product of stagingProducts) {
    const duplicates = await findPotentialDuplicates(product, batchId)

    for (const dup of duplicates) {
      await recordDeduplication(
        batchId,
        product.product_id,
        dup.matchedProductId,
        dup.matchType,
        dup.confidence,
        dup.reason,
        'flagged' // Flag for manual review
      )

      if (dup.matchType === 'deterministic') {
        deterministicCount++
        // Mark as suspect
        await supabase
          .from('products_staging')
          .update({ review_status: 'suspect_duplicate' })
          .eq('product_id', product.product_id)
      } else {
        fuzzyCount++
        // Leave as pending for manual review
      }
    }
  }

  // Update batch status
  await supabase
    .from('product_import_batches')
    .update({ status: 'reviewing' })
    .eq('id', batchId)

  console.log(
    `Deduplication complete: ${deterministicCount} deterministic, ${fuzzyCount} fuzzy`
  )

  return {
    deterministic: deterministicCount,
    fuzzy: fuzzyCount,
    processed: stagingProducts.length,
  }
}

/**
 * Get deduplication matches for a staging product
 */
export async function getDeduplicationMatches(stagingProductId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('product_deduplications')
    .select('*')
    .eq('staging_product_id', stagingProductId)
    .order('confidence', { ascending: false })

  if (error) {
    throw new Error(`Failed to get duplicates: ${error.message}`)
  }

  return data || []
}
