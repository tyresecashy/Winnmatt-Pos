/**
 * Product Ingestion System - TypeScript Types & Models
 * Phase 2: Schemas, Interfaces, and Utilities
 */

// ============================================================================
// SECTION 1: PRODUCT SOURCES
// ============================================================================

export type ProductSourceType = 'csv_upload' | 'api' | 'web_scraper' | 'manual_csv' | 'other'

export interface ProductSource {
  id: string
  name: string
  description?: string
  source_type: ProductSourceType
  is_active: boolean
  config?: Record<string, any>
  created_at: string
  updated_at: string
}

// ============================================================================
// SECTION 2: IMPORT BATCHES
// ============================================================================

export type ImportBatchStatus =
  | 'pending'
  | 'normalizing'
  | 'deduplicating'
  | 'reviewing'
  | 'staged'
  | 'approved'
  | 'published'
  | 'failed'
  | 'cancelled'

export interface ProductImportBatch {
  id: string
  source_id: string
  status: ImportBatchStatus
  total_records: number
  processed_records: number
  failed_records: number
  duplicates_found: number
  batch_hash?: string
  error_log?: Record<string, any>
  imported_by: string
  started_at: string
  completed_at?: string
  published_at?: string
  published_by?: string
  notes?: string
  created_at: string
  updated_at: string
}

// ============================================================================
// SECTION 3: RAW IMPORTS
// ============================================================================

export type RawImportProcessingStatus =
  | 'pending'
  | 'normalized'
  | 'duplicate_flagged'
  | 'merged'
  | 'failed'
  | 'skipped'

export interface RawProductImport {
  id: string
  batch_id: string
  source_product_id: string
  raw_data: Record<string, any>
  source_name?: string
  source_brand?: string
  source_category?: string
  source_sku?: string
  source_barcode?: string
  source_unit?: string
  source_size_value?: number
  source_size_unit?: string
  source_retail_price?: number
  source_currency: string
  source_url?: string
  source_image_url?: string
  fetched_at?: string
  processing_status: RawImportProcessingStatus
  processing_error?: string
  created_at: string
}

// ============================================================================
// SECTION 4: STAGING PRODUCTS (Main Review Table)
// ============================================================================

export type StagingReviewStatus = 'pending' | 'needs_review' | 'approved' | 'rejected' | 'merged'

export interface StagingProduct {
  id: string
  batch_id: string
  import_ids: string[]

  // Normalized data
  normalized_sku?: string
  normalized_name: string
  normalized_brand?: string
  normalized_category_id?: string
  normalized_unit?: string
  normalized_barcode?: string
  normalized_image_url?: string

  // Pricing from sources
  min_seen_price?: number
  max_seen_price?: number
  avg_seen_price?: number
  median_seen_price?: number
  source_count: number

  // Calculated suggestions
  suggested_selling_price?: number
  suggested_purchase_price?: number
  price_calculation_method?: string

  // Anomaly detection
  price_anomaly: boolean
  anomaly_reason?: string
  confidence_score?: number

  // Deduplication
  possible_duplicate_of_product_id?: string
  duplicate_confidence?: number
  fuzzy_match_reason?: string

  // Review
  review_status: StagingReviewStatus
  reviewed_by?: string
  reviewed_at?: string
  review_notes?: string

  created_at: string
  updated_at: string
}

// ============================================================================
// SECTION 5: DEDUPLICATION RECORDS
// ============================================================================

export type DeduplicationMethod = 'exact_match' | 'fuzzy_match' | 'manual' | 'barcode'

export interface ProductDeduplication {
  id: string
  canonical_product_id: string
  duplicate_product_id: string
  dedup_method: DeduplicationMethod
  confidence?: number
  match_reason?: string
  merged_by: string
  merged_at: string
  created_at: string
}

// ============================================================================
// SECTION 6: PRICE HISTORY
// ============================================================================

export type PriceChangeReason = 'import' | 'manual_edit' | 'price_refresh' | 'approval' | 'system_adjustment'

export interface ProductPriceHistory {
  id: string
  product_id: string
  previous_selling_price?: number
  new_selling_price?: number
  previous_purchase_price?: number
  new_purchase_price?: number
  change_reason: PriceChangeReason
  source_batch_id?: string
  changed_by: string
  change_notes?: string
  created_at: string
}

// ============================================================================
// SECTION 7: PRICING SUGGESTIONS
// ============================================================================

export interface PricingSuggestion {
  id: string
  product_id: string
  source_id: string
  batch_id: string
  observed_retail_price?: number
  min_price?: number
  max_price?: number
  avg_price?: number
  median_price?: number
  observation_count: number
  suggested_margin_percent?: number
  suggested_selling_price?: number
  created_at: string
  updated_at: string
}

// ============================================================================
// SECTION 8: PRICE ANOMALIES
// ============================================================================

export type AnomalySeverity = 'info' | 'warning' | 'critical'
export type AnomalyType =
  | 'outlier'
  | 'missing_data'
  | 'unit_mismatch'
  | 'extreme_margin'
  | 'non_numeric'
  | 'category_unknown'

export interface PriceAnomaly {
  id: string
  batch_id: string
  staging_product_id?: string
  product_id?: string
  anomaly_type: AnomalyType
  severity: AnomalySeverity
  description: string
  flagged_value?: string
  expected_range?: string
  resolved: boolean
  resolution_notes?: string
  resolved_by?: string
  resolved_at?: string
  created_at: string
  updated_at: string
}

// ============================================================================
// SECTION 9: NORMALIZATION UNITS
// ============================================================================

export interface NormalizationUnit {
  id: string
  unit_category: string
  standard_unit: string
  conversions?: Record<string, number>
  display_name?: string
  created_at: string
}

// ============================================================================
// SECTION 10: ENHANCED PRODUCT (With new fields)
// ============================================================================

export interface EnhancedProduct {
  id: string
  sku: string
  name: string
  description?: string
  category_id?: string
  purchase_price: number
  selling_price: number
  reorder_level: number

  // New fields from Phase 2
  brand?: string
  unit?: string
  barcode?: string
  image_url?: string
  status: 'active' | 'discontinued' | 'staging' | 'archived'
  source_product_id?: string
  source_id?: string
  suggested_selling_price?: number
  approved_at?: string
  approved_by?: string

  created_at: string
  updated_at: string
}

// ============================================================================
// SECTION 11: IMPORT REQUEST/RESPONSE TYPES
// ============================================================================

export interface CSVProductRow {
  name: string
  brand?: string
  sku?: string
  barcode?: string
  category?: string
  unit?: string
  size_value?: string
  size_unit?: string
  retail_price?: string
  image_url?: string
  url?: string
  [key: string]: any
}

export interface ImportProgressUpdate {
  batch_id: string
  status: ImportBatchStatus
  processed: number
  total: number
  failed: number
  duplicates: number
  percent_complete: number
}

export interface ApprovalRequest {
  staging_product_ids: string[]
  approved_by: string
  notes?: string
  apply_to_live: boolean // Should it update the live products table?
}

export interface PublishRequest {
  batch_id: string
  approved_staging_ids: string[]
  published_by: string
  notes?: string
}

// ============================================================================
// SECTION 12: VALIDATION & ANOMALY DETECTION
// ============================================================================

export interface ValidationResult {
  is_valid: boolean
  errors: string[]
  warnings: string[]
  anomalies: AnomalyType[]
}

export interface PriceAnomalyCheck {
  has_anomaly: boolean
  anomaly_type?: AnomalyType
  severity?: AnomalySeverity
  reason?: string
  flagged_value?: any
  suggested_action?: string
}

// Anomaly thresholds
export const ANOMALY_THRESHOLDS = {
  EXTREME_PRICE_RATIO: 5, // Price is 5x the average
  MIN_PRICE_KES: 10, // Minimum sensible price in Kenya
  MAX_PRICE_KES: 500000, // Maximum for single retail item
  MISSING_FIELDS_MAX: ['name', 'unit', 'category'], // Critical fields
  MISSING_CATEGORY_SEVERITY: 'warning' as const,
  MISSING_UNIT_SEVERITY: 'info' as const,
  OUTLIER_PRICE_SEVERITY: 'critical' as const,
}

// ============================================================================
// SECTION 13: DEDUPLICATION MATCHING
// ============================================================================

export interface DuplicateMatch {
  canonical_product_id: string
  duplicate_product_id: string
  method: DeduplicationMethod
  confidence: number
  evidence: string[]
}

export interface DuplicateDetectionConfig {
  use_sku: boolean
  use_barcode: boolean
  use_fuzzy_name: boolean
  fuzzy_similarity_threshold: number // 0-1
  brand_match_required: boolean
  unit_match_required: boolean
}

// ============================================================================
// SECTION 14: AUDIT & PERMISSIONS
// ============================================================================

export interface AuditEntry {
  id?: string
  action: string
  entity_type: string
  entity_id: string
  user_id: string
  changes: Record<string, { old: any; new: any }>
  timestamp: string
}

export interface UserPermissions {
  can_import: boolean
  can_review_staging: boolean
  can_approve_staging: boolean
  can_publish_to_live: boolean
  can_edit_live_products: boolean
  can_view_audit_logs: boolean
}

// ============================================================================
// SECTION 15: RESULT TYPES
// ============================================================================

export interface ImportResult<T> {
  success: boolean
  data?: T
  error?: string
  warnings?: string[]
  stats?: {
    processed: number
    created: number
    updated: number
    failed: number
    duplicates: number
  }
}
