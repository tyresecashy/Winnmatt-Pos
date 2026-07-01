/**
 * CSV Importer Service
 *
 * Deferred during production hardening. The import surface is intentionally
 * disabled so the cash-sale production path can ship without unfinished
 * ingestion dependencies.
 */

export interface CSVProduct {
  source_name: string
  source_product_id: string
  source_url?: string
  scraped_name: string
  brand?: string
  pack_size?: string
  unit?: string
  category?: string
  listed_price?: number
  currency?: string
  barcode?: string
  image_url?: string
  [key: string]: unknown
}

export interface ImportResult {
  batchId: string
  totalRecords: number
  validRecords: number
  invalidRecords: number
  errors: { row: number; field: string; message: string }[]
}

const IMPORT_DISABLED_ERROR =
  'CSV import is temporarily disabled during production hardening.'

export async function parseCSVFile(_file: File): Promise<{
  products: CSVProduct[]
  errors: { row: number; message: string }[]
}> {
  throw new Error(IMPORT_DISABLED_ERROR)
}

export async function importCSVBatch(
  _sourceName: string,
  _products: CSVProduct[]
): Promise<ImportResult> {
  throw new Error(IMPORT_DISABLED_ERROR)
}

export async function getImportBatch(_batchId: string) {
  throw new Error(IMPORT_DISABLED_ERROR)
}

export async function getRawImports(_batchId: string) {
  throw new Error(IMPORT_DISABLED_ERROR)
}

export async function getImportBatchStats(_batchId: string) {
  throw new Error(IMPORT_DISABLED_ERROR)
}
