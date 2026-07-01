/**
 * Pricing Analyzer Service
 * Detects price anomalies and calculates pricing suggestions
 */

import { createClient } from '@/lib/supabase-server'
import {
  ANOMALY_THRESHOLDS,
  type AnomalyType,
  type AnomalySeverity,
} from '@/lib/product-ingestion.types'

const uuidv4 = () => crypto.randomUUID()

/**
 * Analyze price for anomalies
 */
export function analyzePriceAnomalies(
  price: number | undefined,
  product: any
): Array<{
  type: AnomalyType
  severity: AnomalySeverity
  message: string
}> {
  const anomalies: Array<{
    type: AnomalyType
    severity: AnomalySeverity
    message: string
  }> = []

  if (!price) {
    anomalies.push({
      type: 'missing_data',
      severity: 'warning',
      message: 'Listed price is missing - will need manual estimation',
    })
    return anomalies
  }

  // Missing brand
  if (!product.brand) {
    anomalies.push({
      type: 'missing_data',
      severity: 'info',
      message: 'Brand not detected - may indicate generic or unrecognized product',
    })
  }

  // Missing unit
  if (!product.unit) {
    anomalies.push({
      type: 'missing_data',
      severity: 'info',
      message: 'Unit not detected - volume/weight could not be determined',
    })
  }

  // Price too low (CRITICAL)
  if (price < ANOMALY_THRESHOLDS.MIN_PRICE_KES) {
    anomalies.push({
      type: 'outlier',
      severity: 'critical',
      message: `Price KES ${price} is below minimum threshold of KES ${ANOMALY_THRESHOLDS.MIN_PRICE_KES}`,
    })
  }

  // Price too high (CRITICAL)
  if (price > ANOMALY_THRESHOLDS.MAX_PRICE_KES) {
    anomalies.push({
      type: 'outlier',
      severity: 'critical',
      message: `Price KES ${price} exceeds maximum threshold of KES ${ANOMALY_THRESHOLDS.MAX_PRICE_KES}`,
    })
  }

  // Non-numeric or invalid
  if (!Number.isInteger(price) || price < 0) {
    anomalies.push({
      type: 'non_numeric',
      severity: 'critical',
      message: 'Price must be a positive integer',
    })
  }

  return anomalies
}

/**
 * Get pricing statistics from product sources
 * (built-in prices and sources - used for comparison)
 */
export async function getPricingStatistics(
  normalizedName: string,
  brand?: string
): Promise<{
  minPrice: number | null
  maxPrice: number | null
  avgPrice: number | null
  medianPrice: number | null
  sourceCount: number
}> {
  const supabase = await createClient()

  // Query pricing_suggestions for similar products
  let query = supabase
    .from('pricing_suggestions')
    .select('*')

  // Try to find suggestions for this product
  const { data: suggestions, error } = await query

  if (error || !suggestions || suggestions.length === 0) {
    return {
      minPrice: null,
      maxPrice: null,
      avgPrice: null,
      medianPrice: null,
      sourceCount: 0,
    }
  }

  // Filter by normalized name or brand
  const filtered = suggestions
    .filter(
      (s: any) =>
        s.normalized_name === normalizedName ||
        (brand && s.brand === brand)
    )

  if (filtered.length === 0) {
    return {
      minPrice: null,
      maxPrice: null,
      avgPrice: null,
      medianPrice: null,
      sourceCount: 0,
    }
  }

  const prices = filtered
    .map((s: any) => s.min_price || s.max_price || s.avg_price)
    .filter((p: any) => p)

  if (prices.length === 0) {
    return {
      minPrice: null,
      maxPrice: null,
      avgPrice: null,
      medianPrice: null,
      sourceCount: filtered.length,
    }
  }

  prices.sort((a: number, b: number) => a - b)

  const avg = prices.reduce((a: number, b: number) => a + b, 0) / prices.length
  const median =
    prices.length % 2 === 0
      ? (prices[prices.length / 2 - 1] + prices[prices.length / 2]) / 2
      : prices[Math.floor(prices.length / 2)]

  return {
    minPrice: prices[0],
    maxPrice: prices[prices.length - 1],
    avgPrice: Math.round(avg),
    medianPrice: Math.round(median),
    sourceCount: filtered.length,
  }
}

/**
 * Calculate suggested retail/selling price
 * Based on listed price and market data
 */
export function calculateSuggestedPrice(
  listedPrice: number | undefined,
  stats: {
    minPrice: number | null
    maxPrice: number | null
    avgPrice: number | null
    medianPrice: number | null
  },
  defaultMarkup = 1.25 // 25% markup by default
): number | null {
  // If we have listed price, use with markup
  if (listedPrice && listedPrice > 0) {
    // If prices from sources exist, check if listed price is reasonable
    if (stats.medianPrice) {
      // If listed price is very different from median, use median-based suggestion
      const ratio = listedPrice / stats.medianPrice
      if (ratio < 0.5 || ratio > 2) {
        // Listed price seems off - use market data
        return Math.round(stats.medianPrice * defaultMarkup)
      }
    }
    return Math.round(listedPrice * defaultMarkup)
  }

  // Fall back to market data
  if (stats.medianPrice) {
    return Math.round(stats.medianPrice * defaultMarkup)
  }

  if (stats.avgPrice) {
    return Math.round(stats.avgPrice * defaultMarkup)
  }

  return null
}

/**
 * Record a price anomaly for a staging product
 */
export async function recordAnomalies(
  batchId: string,
  stagingProductId: string,
  anomalies: Array<{
    type: AnomalyType
    severity: AnomalySeverity
    message: string
  }>
): Promise<number> {
  if (anomalies.length === 0) return 0

  const supabase = await createClient()

  const records = anomalies.map((anomaly) => ({
    id: uuidv4(),
    batch_id: batchId,
    staging_product_id: stagingProductId,
    anomaly_type: anomaly.type,
    severity: anomaly.severity,
    message: anomaly.message,
    created_at: new Date().toISOString(),
  }))

  const { error } = await supabase.from('price_anomalies').insert(records)

  if (error) {
    throw new Error(`Failed to record anomalies: ${error.message}`)
  }

  // Update staging product to mark as having anomalies
  if (anomalies.some((a) => a.severity === 'critical')) {
    await supabase
      .from('products_staging')
      .update({ has_critical_anomaly: true })
      .eq('product_id', stagingProductId)
  }

  return anomalies.length
}

/**
 * Analyze and price all staging products in a batch
 */
export async function analyzeAndPriceBatch(batchId: string): Promise<{
  analyzed: number
  anomalies: number
  withSuggestedPrice: number
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
    return { analyzed: 0, anomalies: 0, withSuggestedPrice: 0 }
  }

  let anomalyCount = 0
  let withPriceCount = 0

  // Analyze each product
  for (const product of stagingProducts) {
    // Check for price anomalies
    const anomalies = analyzePriceAnomalies(product.listed_price, product)
    if (anomalies.length > 0) {
      await recordAnomalies(batchId, product.product_id, anomalies)
      anomalyCount += anomalies.length
    }

    // Calculate suggested price
    const stats = await getPricingStatistics(product.normalized_name, product.brand)
    const suggestedPrice = calculateSuggestedPrice(product.listed_price, stats)

    if (suggestedPrice) {
      await supabase
        .from('products_staging')
        .update({
          suggested_selling_price: suggestedPrice,
          confidence_score: product.confidence_score + 10, // Boost confidence if we have price
        })
        .eq('product_id', product.product_id)

      withPriceCount++
    }
  }

  console.log(
    `Analysis complete: ${anomalyCount} anomalies, ${withPriceCount} with suggested prices`
  )

  return {
    analyzed: stagingProducts.length,
    anomalies: anomalyCount,
    withSuggestedPrice: withPriceCount,
  }
}

/**
 * Get anomalies for a staging product
 */
export async function getStagingAnomalies(stagingProductId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('price_anomalies')
    .select('*')
    .eq('staging_product_id', stagingProductId)
    .order('severity', { ascending: false })

  if (error) {
    throw new Error(`Failed to get anomalies: ${error.message}`)
  }

  return data || []
}

/**
 * Get all critical anomalies in a batch
 */
export async function getBatchCriticalAnomalies(batchId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('price_anomalies')
    .select('*')
    .eq('batch_id', batchId)
    .eq('severity', 'critical')
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to get critical anomalies: ${error.message}`)
  }

  return data || []
}
