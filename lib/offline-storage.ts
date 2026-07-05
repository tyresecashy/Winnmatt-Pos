'use client'

/**
 * Offline Storage Utilities
 * 
 * Handles local storage of data for offline POS operation.
 * Uses IndexedDB for large datasets and localStorage for preferences.
 */

// ─── IndexedDB Setup ────────────────────────────────────────────────────────

const DB_NAME = 'winnmatt-offline'
const DB_VERSION = 1

const STORES = {
  products: 'products',
  customers: 'customers',
  pendingSales: 'pending-sales',
  cart: 'cart',
  settings: 'settings',
}

// ─── Database Initialization ────────────────────────────────────────────────

let db: IDBDatabase | null = null

export async function initOfflineDB(): Promise<IDBDatabase> {
  if (db) return db

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      db = request.result
      resolve(db)
    }

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result

      // Products store
      if (!database.objectStoreNames.contains(STORES.products)) {
        const productStore = database.createObjectStore(STORES.products, { keyPath: 'id' })
        productStore.createIndex('sku', 'sku', { unique: true })
        productStore.createIndex('name', 'name', { unique: false })
        productStore.createIndex('barcode', 'barcode', { unique: false })
      }

      // Customers store
      if (!database.objectStoreNames.contains(STORES.customers)) {
        const customerStore = database.createObjectStore(STORES.customers, { keyPath: 'id' })
        customerStore.createIndex('phone', 'phone', { unique: false })
        customerStore.createIndex('email', 'email', { unique: false })
      }

      // Pending sales store (for offline queue)
      if (!database.objectStoreNames.contains(STORES.pendingSales)) {
        const salesStore = database.createObjectStore(STORES.pendingSales, { keyPath: 'id' })
        salesStore.createIndex('timestamp', 'timestamp', { unique: false })
        salesStore.createIndex('status', 'status', { unique: false })
      }

      // Cart store
      if (!database.objectStoreNames.contains(STORES.cart)) {
        database.createObjectStore(STORES.cart, { keyPath: 'id' })
      }

      // Settings store
      if (!database.objectStoreNames.contains(STORES.settings)) {
        database.createObjectStore(STORES.settings, { keyPath: 'key' })
      }
    }
  })
}

// ─── Generic CRUD Operations ────────────────────────────────────────────────

async function getAll<T>(storeName: string): Promise<T[]> {
  const database = await initOfflineDB()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readonly')
    const store = transaction.objectStore(storeName)
    const request = store.getAll()
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function getById<T>(storeName: string, id: string): Promise<T | null> {
  const database = await initOfflineDB()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readonly')
    const store = transaction.objectStore(storeName)
    const request = store.get(id)
    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error)
  })
}

async function put<T>(storeName: string, data: T): Promise<void> {
  const database = await initOfflineDB()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite')
    const store = transaction.objectStore(storeName)
    const request = store.put(data)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

async function putMany<T>(storeName: string, items: T[]): Promise<void> {
  const database = await initOfflineDB()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite')
    const store = transaction.objectStore(storeName)
    
    items.forEach((item) => store.put(item))
    
    transaction.oncomplete = () => resolve()
    transaction.onerror = () => reject(transaction.error)
  })
}

async function deleteById(storeName: string, id: string): Promise<void> {
  const database = await initOfflineDB()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite')
    const store = transaction.objectStore(storeName)
    const request = store.delete(id)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

async function clearStore(storeName: string): Promise<void> {
  const database = await initOfflineDB()
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, 'readwrite')
    const store = transaction.objectStore(storeName)
    const request = store.clear()
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

// ─── Products Operations ────────────────────────────────────────────────────

export interface OfflineProduct {
  id: string
  name: string
  sku: string
  barcode: string | null
  selling_price: number
  purchase_price: number
  category_id: string | null
  status: string
  image_url: string | null
  branch_id: string
  last_synced: string
}

export async function cacheProducts(products: OfflineProduct[]): Promise<void> {
  const items = products.map(p => ({
    ...p,
    last_synced: new Date().toISOString(),
  }))
  await putMany(STORES.products, items)
}

export async function getCachedProducts(): Promise<OfflineProduct[]> {
  return getAll<OfflineProduct>(STORES.products)
}

export async function searchCachedProducts(query: string): Promise<OfflineProduct[]> {
  const all = await getCachedProducts()
  const lowerQuery = query.toLowerCase()
  
  return all.filter(p => 
    p.name.toLowerCase().includes(lowerQuery) ||
    p.sku.toLowerCase().includes(lowerQuery) ||
    (p.barcode && p.barcode.includes(query))
  )
}

export async function getProductByBarcode(barcode: string): Promise<OfflineProduct | null> {
  const all = await getCachedProducts()
  return all.find(p => p.barcode === barcode) || null
}

// ─── Customers Operations ───────────────────────────────────────────────────

export interface OfflineCustomer {
  id: string
  name: string
  phone: string | null
  email: string | null
  loyalty_points: number
  tier: string | null
  last_synced: string
}

export async function cacheCustomers(customers: OfflineCustomer[]): Promise<void> {
  const items = customers.map(c => ({
    ...c,
    last_synced: new Date().toISOString(),
  }))
  await putMany(STORES.customers, items)
}

export async function getCachedCustomers(): Promise<OfflineCustomer[]> {
  return getAll<OfflineCustomer>(STORES.customers)
}

export async function searchCachedCustomers(query: string): Promise<OfflineCustomer[]> {
  const all = await getCachedCustomers()
  const lowerQuery = query.toLowerCase()
  
  return all.filter(c => 
    c.name.toLowerCase().includes(lowerQuery) ||
    (c.phone && c.phone.includes(query)) ||
    (c.email && c.email.toLowerCase().includes(lowerQuery))
  )
}

// ─── Pending Sales Operations ───────────────────────────────────────────────

export interface PendingSale {
  id: string
  branch_id: string
  cashier_id: string
  items: Array<{
    product_id: string
    quantity: number
    unit_price: number
    total: number
  }>
  subtotal: number
  tax: number
  total: number
  payment_method: string
  amount_tendered: number
  change: number
  status: 'pending' | 'syncing' | 'synced' | 'failed'
  timestamp: string
  retry_count: number
  last_error?: string
}

export async function queuePendingSale(sale: PendingSale): Promise<void> {
  await put(STORES.pendingSales, {
    ...sale,
    status: 'pending',
    timestamp: new Date().toISOString(),
    retry_count: 0,
  })
}

export async function getPendingSales(): Promise<PendingSale[]> {
  return getAll<PendingSale>(STORES.pendingSales)
}

export async function getPendingSalesCount(): Promise<number> {
  const sales = await getPendingSales()
  return sales.filter(s => s.status === 'pending').length
}

export async function updatePendingSaleStatus(
  id: string,
  status: PendingSale['status'],
  error?: string
): Promise<void> {
  const sale = await getById<PendingSale>(STORES.pendingSales, id)
  if (sale) {
    await put(STORES.pendingSales, {
      ...sale,
      status,
      last_error: error,
      retry_count: sale.retry_count + 1,
    })
  }
}

export async function removePendingSale(id: string): Promise<void> {
  await deleteById(STORES.pendingSales, id)
}

export async function clearSyncedSales(): Promise<void> {
  const sales = await getPendingSales()
  const synced = sales.filter(s => s.status === 'synced')
  
  for (const sale of synced) {
    await deleteById(STORES.pendingSales, sale.id)
  }
}

// ─── Cart Operations ────────────────────────────────────────────────────────

export interface CartItem {
  id: string
  product_id: string
  name: string
  sku: string
  quantity: number
  unit_price: number
  total: number
}

export interface OfflineCart {
  id: string
  items: CartItem[]
  customer_id: string | null
  subtotal: number
  tax: number
  total: number
  updated_at: string
}

export async function saveCart(cart: OfflineCart): Promise<void> {
  await put(STORES.cart, {
    ...cart,
    updated_at: new Date().toISOString(),
  })
}

export async function getCart(): Promise<OfflineCart | null> {
  const carts = await getAll<OfflineCart>(STORES.cart)
  return carts[0] || null
}

export async function clearCart(): Promise<void> {
  await clearStore(STORES.cart)
}

// ─── Settings Operations ────────────────────────────────────────────────────

export async function getSetting(key: string): Promise<string | null> {
  const result = await getById<{ key: string; value: string }>(STORES.settings, key)
  return result?.value || null
}

export async function setSetting(key: string, value: string): Promise<void> {
  await put(STORES.settings, { key, value })
}

// ─── Sync Utilities ─────────────────────────────────────────────────────────

export async function isOnline(): Promise<boolean> {
  return navigator.onLine
}

export async function waitForOnline(): Promise<void> {
  return new Promise((resolve) => {
    if (navigator.onLine) {
      resolve()
      return
    }
    
    const handler = () => {
      window.removeEventListener('online', handler)
      resolve()
    }
    
    window.addEventListener('online', handler)
  })
}

export async function syncPendingSales(
  syncFunction: (sale: PendingSale) => Promise<boolean>
): Promise<{ synced: number; failed: number }> {
  const pending = await getPendingSales()
  let synced = 0
  let failed = 0

  for (const sale of pending) {
    if (sale.status === 'pending' || (sale.status === 'failed' && sale.retry_count < 3)) {
      try {
        await updatePendingSaleStatus(sale.id, 'syncing')
        const success = await syncFunction(sale)
        
        if (success) {
          await updatePendingSaleStatus(sale.id, 'synced')
          synced++
        } else {
          await updatePendingSaleStatus(sale.id, 'failed', 'Sync failed')
          failed++
        }
      } catch (error) {
        await updatePendingSaleStatus(
          sale.id,
          'failed',
          error instanceof Error ? error.message : 'Unknown error'
        )
        failed++
      }
    }
  }

  return { synced, failed }
}
