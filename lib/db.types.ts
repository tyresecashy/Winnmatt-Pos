// Generated types for database schema
export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          email: string
          full_name: string
          branch_id: string | null
          role: 'super_admin' | 'admin' | 'manager' | 'cashier'
          status: 'active' | 'inactive'
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['users']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['users']['Insert']>
      }
      branches: {
        Row: {
          id: string
          name: string
          code: string
          location: string
          is_main: boolean
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['branches']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['branches']['Insert']>
      }
      categories: {
        Row: {
          id: string
          name: string
          description: string | null
          icon: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['categories']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['categories']['Insert']>
      }
      products: {
        Row: {
          id: string
          sku: string
          name: string
          description: string | null
          category_id: string
          purchase_price: number
          selling_price: number
          reorder_level: number
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['products']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['products']['Insert']>
      }
      inventory: {
        Row: {
          id: string
          product_id: string
          branch_id: string
          quantity: number
          last_counted_at: string
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['inventory']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['inventory']['Insert']>
      }
      customers: {
        Row: {
          id: string
          name: string
          phone: string
          email: string | null
          type: 'retail' | 'wholesale' | 'business'
          loyalty_points: number
          credit_limit: number
          credit_balance: number
          tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'vip'
          birthday: string | null
          total_lifetime_spend_cents: number
          total_visits: number
          last_purchase_date: string | null
          notes: string | null
          tags: string[]
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['customers']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['customers']['Insert']>
      }
      suppliers: {
        Row: {
          id: string
          name: string
          contact_person: string
          phone: string
          email: string | null
          payment_terms: string
          balance: number
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['suppliers']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['suppliers']['Insert']>
      }
      warehouses: {
        Row: {
          id: string
          name: string
          code: string
          branch_id: string | null
          location: string | null
          manager_id: string | null
          type: 'central' | 'branch' | 'regional'
          status: 'active' | 'inactive'
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['warehouses']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['warehouses']['Insert']>
      }
      sales: {
        Row: {
          id: string
          branch_id: string
          cashier_id: string
          customer_id: string | null
          subtotal: number
          discount_amount: number
          tax_amount: number
          total_amount: number
          payment_method: 'cash' | 'card' | 'bank_transfer' | 'cheque' | 'credit' | 'mpesa'
          payment_status: 'pending' | 'completed' | 'failed'
          receipt_number: string
          notes: string | null
          sale_status: 'completed' | 'voided' | 'returned' | 'on_hold' | null
          hold_notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['sales']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['sales']['Insert']>
      }
      sale_items: {
        Row: {
          id: string
          sale_id: string
          product_id: string
          quantity: number
          unit_price: number
          discount_percent: number
          line_total: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['sale_items']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['sale_items']['Insert']>
      }
      stock_movements: {
        Row: {
          id: string
          product_id: string
          branch_id: string
          from_warehouse_id: string | null
          to_warehouse_id: string | null
          type: 'sale' | 'receipt' | 'transfer' | 'adjustment' | 'damage' | 'receive' | 'issue'
          quantity: number
          reference_type: string | null
          reference_id: string | null
          notes: string | null
          created_by: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['stock_movements']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['stock_movements']['Insert']>
      }
      purchase_orders: {
        Row: {
          id: string
          supplier_id: string
          branch_id: string
          status: 'draft' | 'pending' | 'approved' | 'received' | 'cancelled'
          subtotal: number
          tax_amount: number
          total_amount: number
          expected_delivery: string
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['purchase_orders']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['purchase_orders']['Insert']>
      }
      purchase_order_items: {
        Row: {
          id: string
          purchase_order_id: string
          product_id: string
          quantity: number
          unit_price: number
          line_total: number
          received_quantity: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['purchase_order_items']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['purchase_order_items']['Insert']>
      }
      purchase_receipts: {
        Row: {
          id: string
          purchase_order_id: string
          supplier_id: string
          received_by: string
          notes: string | null
          status: 'draft' | 'completed' | 'cancelled'
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['purchase_receipts']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['purchase_receipts']['Insert']>
      }
      purchase_receipt_items: {
        Row: {
          id: string
          purchase_receipt_id: string
          product_id: string
          quantity_received: number
          unit_cost: number
          batch_number: string | null
          expiry_date: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['purchase_receipt_items']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['purchase_receipt_items']['Insert']>
      }
      stock_transfers: {
        Row: {
          id: string
          from_branch_id: string
          to_branch_id: string
          status: 'pending' | 'in_transit' | 'received' | 'cancelled'
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['stock_transfers']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['stock_transfers']['Insert']>
      }
      stock_transfer_items: {
        Row: {
          id: string
          stock_transfer_id: string
          product_id: string
          quantity: number
          received_quantity: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['stock_transfer_items']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['stock_transfer_items']['Insert']>
      }
      business_settings: {
        Row: {
          id: string
          business_name: string
          phone_number: string | null
          email: string | null
          address: string | null
          tax_pin: string | null
          business_pin: string | null
          receipt_footer_text: string | null
          return_policy_text: string | null
          thank_you_message: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['business_settings']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['business_settings']['Insert']>
      }
      branch_receipt_settings: {
        Row: {
          id: string
          branch_id: string
          phone_number: string | null
          email: string | null
          address: string | null
          receipt_header_text: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['branch_receipt_settings']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['branch_receipt_settings']['Insert']>
      }
    }
  }
}

// ============================================================================
// APP-LEVEL TYPES (Non-database, for convenience)
// ============================================================================

export type BusinessSettings = Database['public']['Tables']['business_settings']['Row']

export type BranchReceiptSettings = Database['public']['Tables']['branch_receipt_settings']['Row']

/**
 * Merged view: Global settings + branch overrides (if any)
 * Branch overrides take precedence over global values.
 * Used throughout the app to get effective receipt settings.
 */
export type MergedReceiptSettings = BusinessSettings & {
  branchSettings?: BranchReceiptSettings
  // Computed effective values (branch override OR global fallback)
  effectivePhoneNumber: string | null
  effectiveEmail: string | null
  effectiveAddress: string | null
}

/**
 * User Profile: Extended user info with branch details
 * Used in auth context and user management
 */
export interface UserProfile {
  id: string
  email: string
  full_name: string
  branch_id: string | null
  role: 'super_admin' | 'admin' | 'manager' | 'cashier'
  status: 'active' | 'inactive'
  created_at: string
  updated_at: string
  branch?: {
    id: string
    name: string
    code: string
  }
}

/**
 * Loyalty Settings: Singleton configuration for customer loyalty points
 * Only one row exists in the database with ID 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
 */
export interface LoyaltySettings {
  id: string
  earn_enabled: boolean
  earn_threshold_cents: number // 1 point per X cents (e.g., 15000 = 1 point per 150 KSh)
  earn_rate_cents_per_point: number // New earn rate field (default 15000)
  earn_minimum_basket_cents: number // Min basket to earn (0 = no minimum)
  earn_on_discounted: boolean // Earn on discounted items
  redeem_enabled: boolean // Enable/disable redemption
  redeem_value_cents: number // 1 point = X cents (e.g., 50 = 0.5 KSh per point)
  point_value_cents: number // New point value field (default 50)
  redeem_minimum_points: number // Minimum points required to redeem (e.g., 25)
  redeem_minimum_basket_cents: number // Minimum basket to allow redemption (e.g., 0 cents)
  redeem_max_percent_per_sale: number // Max percentage of sale total that can be redeemed (0-100)
  expiry_enabled: boolean
  expiry_days: number // Points expire after N days (default 365)
  enable_tiers: boolean // Enable/disable tier multipliers
  enable_birthday_bonus: boolean // Enable/disable birthday multiplier
  enable_holiday_bonus: boolean // Enable/disable holiday multiplier
  enable_weekend_bonus: boolean // Enable/disable weekend multiplier
  tier_bronze_multiplier: number // Bronze tier point multiplier (default 1.0)
  tier_silver_multiplier: number // Silver tier point multiplier (default 1.25)
  tier_gold_multiplier: number // Gold tier point multiplier (default 1.5)
  tier_platinum_multiplier: number // Platinum tier point multiplier (default 2.0)
  holiday_multiplier: number // Holiday bonus multiplier (default 2.0)
  birthday_multiplier: number // Birthday bonus multiplier (default 3.0)
  weekend_multiplier: number // Weekend bonus multiplier (default 1.5)
  campaign_multiplier: number // Campaign bonus multiplier (default 2.0)
  updated_by: string | null
  updated_at: string
  created_at: string
}

/**
 * Loyalty Transaction: Immutable record of point movements
 * Links to customer and optionally to a sale
 * Used for audit trail and balance verification
 */
export interface LoyaltyTransaction {
  id: string
  customer_id: string
  type: 'earn_sale' | 'earn_admin' | 'redeem_sale' | 'reverse_void' | 'reverse_return' | 'expire' | 'admin_adjust'
  sale_id: string | null
  points_delta: number // Positive = earned, negative = used/reversed
  balance_before: number
  balance_after: number
  reason: string | null
  branch_id: string
  created_by: string | null
  created_at: string
}

/**
 * Audit Log: Record of important system actions
 * Used for compliance and owner visibility
 */
export interface AuditLog {
  id: string
  actor_id: string
  action: string // e.g., 'create_user', 'void_sale', 'update_loyalty_settings'
  resource_type: string | null // e.g., 'user', 'sale', 'loyalty_settings'
  resource_id: string | null
  old_value: Record<string, any> | null
  new_value: Record<string, any> | null
  branch_id: string | null
  details: string | null
  created_at: string
}
