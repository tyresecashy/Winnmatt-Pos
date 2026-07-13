// @ts-nocheck — archived mobile app, not part of active build
/**
 * Mobile Offline Sync Service
 * 
 * Handles offline data storage and synchronization for the React Native mobile app.
 * Uses SQLite for local storage and Supabase for cloud sync.
 */

/* eslint-disable no-console */
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as Network from 'expo-network'
import { supabase } from './supabase'

// ─── Types ──────────────────────────────────────────────────────────────────

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
  stock_quantity: number
  last_synced: string
}

export interface OfflineCustomer {
  id: string
  name: string
  phone: string | null
  email: string | null
  loyalty_points: number
  tier: string | null
  last_synced: string
}

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

export interface SyncStatus {
  isOnline: boolean
  lastSyncTime: string | null
  pendingSales: number
  pendingSync: boolean
}

// ─── Storage Keys ───────────────────────────────────────────────────────────

const STORAGE_KEYS = {
  PRODUCTS: '@winnmatt_products',
  CUSTOMERS: '@winnmatt_customers',
  PENDING_SALES: '@winnmatt_pending_sales',
  LAST_SYNC: '@winnmatt_last_sync',
  SETTINGS: '@winnmatt_settings',
  CART: '@winnmatt_cart',
}

// ─── Offline Sync Service ───────────────────────────────────────────────────

export class OfflineSyncService {
  private static instance: OfflineSyncService
  private syncInterval: ReturnType<typeof setInterval> | null = null
  private listeners: Array<(status: SyncStatus) => void> = []

  static getInstance(): OfflineSyncService {
    if (!OfflineSyncService.instance) {
      OfflineSyncService.instance = new OfflineSyncService()
    }
    return OfflineSyncService.instance
  }

  /**
   * Initialize the sync service
   */
  async initialize(): Promise<void> {
    // Start periodic sync check
    this.syncInterval = setInterval(() => {
      this.checkAndSync()
    }, 30000) // Check every 30 seconds

    // Initial sync
    await this.checkAndSync()
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval)
    }
  }

  /**
   * Subscribe to sync status changes
   */
  subscribe(listener: (status: SyncStatus) => void): () => void {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener)
    }
  }

  /**
   * Notify listeners of status change
   */
  private async notifyListeners(): Promise<void> {
    const status = await this.getSyncStatus()
    this.listeners.forEach(listener => listener(status))
  }

  /**
   * Get current sync status
   */
  async getSyncStatus(): Promise<SyncStatus> {
    const isOnline = await Network.getNetworkStateAsync()
    const lastSyncTime = await AsyncStorage.getItem(STORAGE_KEYS.LAST_SYNC)
    const pendingSales = await this.getPendingSales()

    return {
      isOnline: isOnline.isConnected ?? false,
      lastSyncTime,
      pendingSales: pendingSales.filter(s => s.status === 'pending').length,
      pendingSync: pendingSales.some(s => s.status === 'pending'),
    }
  }

  // ─── Products ─────────────────────────────────────────────────────────────

  /**
   * Cache products for offline use
   */
  async cacheProducts(products: OfflineProduct[]): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products))
  }

  /**
   * Get cached products
   */
  async getCachedProducts(): Promise<OfflineProduct[]> {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.PRODUCTS)
    return data ? JSON.parse(data) : []
  }

  /**
   * Search cached products
   */
  async searchProducts(query: string): Promise<OfflineProduct[]> {
    const products = await this.getCachedProducts()
    const lowerQuery = query.toLowerCase()

    return products.filter(p =>
      p.name.toLowerCase().includes(lowerQuery) ||
      p.sku.toLowerCase().includes(lowerQuery) ||
      (p.barcode && p.barcode.includes(query))
    )
  }

  /**
   * Get product by barcode
   */
  async getProductByBarcode(barcode: string): Promise<OfflineProduct | null> {
    const products = await this.getCachedProducts()
    return products.find(p => p.barcode === barcode) || null
  }

  // ─── Customers ────────────────────────────────────────────────────────────

  /**
   * Cache customers for offline use
   */
  async cacheCustomers(customers: OfflineCustomer[]): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers))
  }

  /**
   * Get cached customers
   */
  async getCachedCustomers(): Promise<OfflineCustomer[]> {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.CUSTOMERS)
    return data ? JSON.parse(data) : []
  }

  /**
   * Search cached customers
   */
  async searchCustomers(query: string): Promise<OfflineCustomer[]> {
    const customers = await this.getCachedCustomers()
    const lowerQuery = query.toLowerCase()

    return customers.filter(c =>
      c.name.toLowerCase().includes(lowerQuery) ||
      (c.phone && c.phone.includes(query)) ||
      (c.email && c.email.toLowerCase().includes(lowerQuery))
    )
  }

  // ─── Pending Sales ────────────────────────────────────────────────────────

  /**
   * Queue a sale for sync
   */
  async queuePendingSale(sale: Omit<PendingSale, 'id' | 'status' | 'timestamp' | 'retry_count'>): Promise<string> {
    const pendingSales = await this.getPendingSales()
    const newSale: PendingSale = {
      ...sale,
      id: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      status: 'pending',
      timestamp: new Date().toISOString(),
      retry_count: 0,
    }

    pendingSales.push(newSale)
    await AsyncStorage.setItem(STORAGE_KEYS.PENDING_SALES, JSON.stringify(pendingSales))
    
    await this.notifyListeners()
    
    // Try to sync immediately if online
    await this.checkAndSync()

    return newSale.id
  }

  /**
   * Get all pending sales
   */
  async getPendingSales(): Promise<PendingSale[]> {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.PENDING_SALES)
    return data ? JSON.parse(data) : []
  }

  /**
   * Update pending sale status
   */
  async updatePendingSaleStatus(
    id: string,
    status: PendingSale['status'],
    error?: string
  ): Promise<void> {
    const pendingSales = await this.getPendingSales()
    const index = pendingSales.findIndex(s => s.id === id)

    if (index !== -1) {
      pendingSales[index] = {
        ...pendingSales[index],
        status,
        last_error: error,
        retry_count: pendingSales[index].retry_count + 1,
      }

      await AsyncStorage.setItem(STORAGE_KEYS.PENDING_SALES, JSON.stringify(pendingSales))
      await this.notifyListeners()
    }
  }

  /**
   * Remove a pending sale
   */
  async removePendingSale(id: string): Promise<void> {
    const pendingSales = await this.getPendingSales()
    const filtered = pendingSales.filter(s => s.id !== id)
    await AsyncStorage.setItem(STORAGE_KEYS.PENDING_SALES, JSON.stringify(filtered))
    await this.notifyListeners()
  }

  /**
   * Clear synced sales
   */
  async clearSyncedSales(): Promise<void> {
    const pendingSales = await this.getPendingSales()
    const pending = pendingSales.filter(s => s.status !== 'synced')
    await AsyncStorage.setItem(STORAGE_KEYS.PENDING_SALES, JSON.stringify(pending))
    await this.notifyListeners()
  }

  // ─── Cart ─────────────────────────────────────────────────────────────────

  /**
   * Save cart for offline recovery
   */
  async saveCart(cart: unknown): Promise<void> {
    await AsyncStorage.setItem(STORAGE_KEYS.CART, JSON.stringify(cart))
  }

  /**
   * Get saved cart
   */
  async getCart(): Promise<unknown> {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.CART)
    return data ? JSON.parse(data) : null
  }

  /**
   * Clear saved cart
   */
  async clearCart(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEYS.CART)
  }

  // ─── Settings ─────────────────────────────────────────────────────────────

  /**
   * Save a setting
   */
  async saveSetting(key: string, value: string): Promise<void> {
    const settings = await this.getSettings()
    settings[key] = value
    await AsyncStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings))
  }

  /**
   * Get a setting
   */
  async getSetting(key: string): Promise<string | null> {
    const settings = await this.getSettings()
    return settings[key] || null
  }

  /**
   * Get all settings
   */
  async getSettings(): Promise<Record<string, string>> {
    const data = await AsyncStorage.getItem(STORAGE_KEYS.SETTINGS)
    return data ? JSON.parse(data) : {}
  }

  // ─── Sync Operations ──────────────────────────────────────────────────────

  /**
   * Check if online and sync pending data
   */
  async checkAndSync(): Promise<void> {
    const networkState = await Network.getNetworkStateAsync()
    
    if (!networkState.isConnected) {
      return
    }

    await this.syncPendingSales()
    await this.syncProducts()
    await this.syncCustomers()
    
    await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC, new Date().toISOString())
    await this.notifyListeners()
  }

  /**
   * Sync pending sales to server
   */
  private async syncPendingSales(): Promise<void> {
    const pendingSales = await this.getPendingSales()
    const pending = pendingSales.filter(s => s.status === 'pending')

    for (const sale of pending) {
      try {
        await this.updatePendingSaleStatus(sale.id, 'syncing')

        // Call server action to create sale
        const { data, error } = await supabase.rpc('create_offline_sale', {
          p_branch_id: sale.branch_id,
          p_cashier_id: sale.cashier_id,
          p_items: sale.items,
          p_subtotal: sale.subtotal,
          p_tax: sale.tax,
          p_total: sale.total,
          p_payment_method: sale.payment_method,
          p_amount_tendered: sale.amount_tendered,
          p_change: sale.change,
          p_offline_id: sale.id,
        })

        if (error) throw error

        await this.updatePendingSaleStatus(sale.id, 'synced')
        console.log(`[Sync] Sale ${sale.id} synced successfully`)
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        await this.updatePendingSaleStatus(sale.id, 'failed', errorMessage)
        console.error(`[Sync] Failed to sync sale ${sale.id}:`, error)
      }
    }
  }

  /**
   * Sync products from server
   */
  private async syncProducts(): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('status', 'active')
        .order('name')

      if (error) throw error

      const products: OfflineProduct[] = (data || []).map(p => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        barcode: p.barcode,
        selling_price: p.selling_price,
        purchase_price: p.purchase_price,
        category_id: p.category_id,
        status: p.status,
        image_url: p.image_url,
        branch_id: p.branch_id,
        stock_quantity: p.stock_quantity || 0,
        last_synced: new Date().toISOString(),
      }))

      await this.cacheProducts(products)
      console.log(`[Sync] Cached ${products.length} products`)
    } catch (error) {
      console.error('[Sync] Failed to sync products:', error)
    }
  }

  /**
   * Sync customers from server
   */
  private async syncCustomers(): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('name')

      if (error) throw error

      const customers: OfflineCustomer[] = (data || []).map(c => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        loyalty_points: c.loyalty_points || 0,
        tier: c.tier,
        last_synced: new Date().toISOString(),
      }))

      await this.cacheCustomers(customers)
      console.log(`[Sync] Cached ${customers.length} customers`)
    } catch (error) {
      console.error('[Sync] Failed to sync customers:', error)
    }
  }
}

// Export singleton
export const offlineSync = OfflineSyncService.getInstance()
