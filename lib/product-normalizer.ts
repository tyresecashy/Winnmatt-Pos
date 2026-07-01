/**
 * Product Normalization Service
 * Cleans raw CSV data: normalize units, names, extract brands
 */

import { logger } from '@/lib/logger'
import { createClient } from '@/lib/supabase-server'

const uuidv4 = () => crypto.randomUUID()

interface ProductFields {
  normalized_name?: string
  barcode?: string
  brand?: string
  image_url?: string
  category?: string
  listed_price?: number
}

interface RawProduct {
  scraped_name?: string
  brand?: string
  source_name?: string
  source_product_id?: string
  source_url?: string
  pack_size?: string
  unit?: string
  category?: string
  listed_price?: number
  currency?: string
  barcode?: string
  image_url?: string
}

export interface NormalizedProduct {
  product_id: string
  batch_id: string
  source_name: string
  source_product_id: string
  source_url?: string
  raw_name: string
  normalized_name: string
  brand?: string
  product_type?: string
  pack_size?: string
  unit?: string
  category?: string
  listed_price?: number
  currency: string
  barcode?: string
  image_url?: string
  confidence_score: number
  raw_data: Record<string, unknown>
  created_at: string
}

/**
 * Normalize unit from various formats to standard: ml, l, g, kg, pcs
 */
export function normalizeUnit(
  unit: string | undefined,
  packSize: string | undefined
): string | undefined {
  if (!unit && !packSize) return undefined

  const combined = `${packSize || ''} ${unit || ''}`.toLowerCase().trim()

  // ml (milliliters)
  if (combined.match(/\bml\b|\bmilliliters?\b/)) return 'ml'
  if (combined.match(/\b(l|liters?)\b/)) return 'l'
  if (combined.match(/\bltr\b|\blts\b/)) return 'l'

  // grams/kg
  if (combined.match(/\bg\b|\bgrams?\b/)) return 'g'
  if (combined.match(/\bkg\b|\bkilograms?\b|\bkilos?\b/)) return 'kg'

  // pieces
  if (combined.match(/\bpieces?\b|\bpcs\b|\bpk\b|\bpack\b/)) return 'pcs'
  if (combined.match(/\bbottle\b|\bbottles?\b/)) return 'pcs'
  if (combined.match(/\bcan\b|\bcans?\b/)) return 'pcs'
  if (combined.match(/\bbox\b|\bboxes?\b/)) return 'pcs'

  // Number only - assume pieces
  if (combined.match(/^\d+$/)) return 'pcs'

  return undefined
}

/**
 * Normalize product name: trim, lowercase, remove special chars, normalize spacing
 */
export function normalizeName(name: string): string {
  return (
    name
      .toLowerCase()
      .trim()
      // Remove extra whitespace
      .replace(/\s+/g, ' ')
      // Remove special characters but keep -, &
      .replace(/[^a-z0-9\s\-&]/g, '')
      .trim()
  )
}

/**
 * Extract brand from product name using common patterns
 * Examples:
 *   "Coca Cola 500ml" -> brand: "Coca Cola"
 *   "Sprite Fanta 330ml" -> brand: "Sprite" / "Fanta"
 *   "Generic Tomato Paste 200g" -> brand: undefined
 */
export function extractBrand(name: string, providedBrand?: string): string | undefined {
  if (providedBrand?.trim()) {
    return providedBrand.trim()
  }

  // Common brand patterns (Kenya market)
  const brands = [
    'coca cola',
    'sprite',
    'fanta',
    'sambaza',
    'tusker',
    'keroche',
    'kenya breweries',
    'kbl',
    'nestlé',
    'nestle',
    'cadbury',
    'brookside',
    'kimbo',
    'prestige',
    'royco',
    'blue band',
    'omo',
    'duz',
    'ariel',
    'surf',
    'sunlight',
    'dettol',
    'lifebuoy',
    'lux',
    'safeguard',
    'panadol',
    'aspirin',
    'bepanthen',
    'vaseline',
    'bond',
    'dunhill',
    'marlboro',
    'samurai',
    'backed',
    'kambi',
    'farmer choice',
    'bidco',
    'kinyui',
    'runners',
    'kaburi',
    'nandi hills',
    'githeri',
    'miji',
    'kbc',
    'superloaf',
    'jembe',
    'eveready',
    'energizer',
  ]

  const normalizedName = normalizeName(name)
  for (const brand of brands) {
    if (normalizedName.includes(brand)) {
      return brand.charAt(0).toUpperCase() + brand.slice(1)
    }
  }

  return undefined
}

/**
 * Calculate confidence score for a normalized product
 * Factors: required fields present, brand detected, price valid, image url present
 */
export function calculateConfidenceScore(product: ProductFields): number {
  let score = 50 // baseline

  // Required fields (+30)
  if (product.normalized_name?.trim()) score += 10
  if (product.barcode?.trim()) score += 10
  if (product.brand?.trim()) score += 10

  // Optional fields (+10)
  if (product.image_url?.trim()) score += 5
  if (product.category?.trim()) score += 5

  // Price validity
  if (product.listed_price && product.listed_price > 0) {
    if (product.listed_price >= 10 && product.listed_price <= 500000) {
      score += 10
    }
  }

  return Math.min(100, score)
}

/**
 * Normalize a raw imported product
 */
export function normalizeProduct(rawProduct: RawProduct, batchId: string): NormalizedProduct {
  const normalizedName = normalizeName(rawProduct.scraped_name || '')
  const extractedBrand = extractBrand(
    rawProduct.scraped_name || '',
    rawProduct.brand
  )
  const normalizedUnit = normalizeUnit(rawProduct.unit, rawProduct.pack_size)

  const normalized: NormalizedProduct = {
    product_id: uuidv4(),
    batch_id: batchId,
    source_name: rawProduct.source_name || 'unknown',
    source_product_id: rawProduct.source_product_id || '',
    source_url: rawProduct.source_url,
    raw_name: rawProduct.scraped_name || '',
    normalized_name: normalizedName,
    brand: extractedBrand || rawProduct.brand,
    product_type: undefined, // Could be enhanced with ML later
    pack_size: rawProduct.pack_size,
    unit: normalizedUnit,
    category: rawProduct.category,
    listed_price: rawProduct.listed_price,
    currency: rawProduct.currency || 'KES',
    barcode: rawProduct.barcode,
    image_url: rawProduct.image_url,
    confidence_score: 0, // Will calculate after
    raw_data: rawProduct as Record<string, unknown>,
    created_at: new Date().toISOString(),
  }

  normalized.confidence_score = calculateConfidenceScore(normalized)

  return normalized
}

/**
 * Normalize all raw imports for a batch and insert into products_staging
 */
export async function normalizeImportBatch(batchId: string): Promise<number> {
  const supabase = await createClient()

  // Get all raw imports for this batch
  const { data: rawImports, error: fetchError } = await supabase
    .from('product_imports')
    .select('*')
    .eq('batch_id', batchId)

  if (fetchError) {
    throw new Error(`Failed to fetch imports: ${fetchError.message}`)
  }

  if (!rawImports || rawImports.length === 0) {
    logger.info('No raw imports found for batch', { batchId })
    return 0
  }

  // Normalize each product
  const normalizedProducts = rawImports.map((raw) =>
    normalizeProduct(raw.raw_data, batchId)
  )

  // Insert into products_staging
  const { error: insertError, data: inserted } = await supabase
    .from('products_staging')
    .insert(normalizedProducts)
    .select()

  if (insertError) {
    throw new Error(`Failed to insert normalized products: ${insertError.message}`)
  }

  // Update batch status
  await supabase
    .from('product_import_batches')
    .update({ status: 'deduplicating' })
    .eq('id', batchId)

  const count = inserted?.length || 0
  logger.info(`Normalized ${count} products for batch ${batchId}`)

  return count
}

/**
 * Get normalized staging products for a batch
 */
export async function getStagingProducts(
  batchId: string,
  filters?: {
    reviewStatus?: string
    hasAnomalies?: boolean
    searchTerm?: string
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

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to get staging products: ${error.message}`)
  }

  return data || []
}
