import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_AUTH_STORAGE_KEY } from '@/lib/supabase'
import type { Database as AutoDatabase } from '@/lib/types/database'

// ---------------------------------------------------------------------------
// Extend the auto-generated Database type with tables the codegen missed.
// These are merged into the public.Tables namespace so that every
// supabaseAdmin.from('table_name') call has correct Row/Insert/Update types.
// ---------------------------------------------------------------------------
export interface Database extends AutoDatabase {
  public: AutoDatabase['public'] & {
    Tables: AutoDatabase['public']['Tables'] & {
      business_settings: {
        Row: {
          id: string; business_name: string; phone_number: string | null
          email: string | null; address: string | null; tax_pin: string | null
          business_pin: string | null; receipt_footer_text: string | null
          return_policy_text: string | null; thank_you_message: string | null
          created_at: string; updated_at: string
        }
        Insert: Record<string, unknown>
        Update: Record<string, unknown>
        Relationships: []
      }
      branch_receipt_settings: {
        Row: {
          id: string; branch_id: string; phone_number: string | null
          email: string | null; address: string | null
          receipt_header_text: string | null; created_at: string; updated_at: string
        }
        Insert: Record<string, unknown>
        Update: Record<string, unknown>
        Relationships: []
      }
      loyalty_settings: {
        Row: {
          id: string; earn_enabled: boolean; earn_threshold_cents: number
          earn_rate_cents_per_point: number; earn_minimum_basket_cents: number
          earn_on_discounted: boolean; redeem_enabled: boolean
          redeem_value_cents: number; point_value_cents: number
          redeem_minimum_points: number; redeem_minimum_basket_cents: number
          redeem_max_percent_per_sale: number; expiry_enabled: boolean
          expiry_days: number; enable_tiers: boolean; enable_birthday_bonus: boolean
          enable_holiday_bonus: boolean; enable_weekend_bonus: boolean
          tier_bronze_multiplier: number; tier_silver_multiplier: number
          tier_gold_multiplier: number; tier_platinum_multiplier: number
          holiday_multiplier: number; birthday_multiplier: number
          weekend_multiplier: number; campaign_multiplier: number
          updated_by: string | null; updated_at: string; created_at: string
        }
        Insert: Record<string, unknown>
        Update: Record<string, unknown>
        Relationships: []
      }
      supplier_payments: {
        Row: {
          id: string; supplier_id: string; amount: number; payment_date: string
          payment_method: string; reference_number: string | null; notes: string | null
          recorded_by: string | null; created_at: string
        }
        Insert: Record<string, unknown>
        Update: Record<string, unknown>
        Relationships: []
      }
      bank_reconciliation_items: {
        Row: {
          id: string; reconciliation_id: string; bank_transaction_id: string
          journal_entry_id: string; created_at: string
        }
        Insert: Record<string, unknown>
        Update: Record<string, unknown>
        Relationships: []
      }
      sale_audit_log: {
        Row: {
          id: string; sale_id: string; action: string; reason: string | null
          performed_by: string | null; details: Record<string, unknown>; created_at: string
        }
        Insert: Record<string, unknown>
        Update: Record<string, unknown>
        Relationships: []
      }
      task_categories: {
        Row: { id: string; name: string; color: string | null; icon: string | null; branch_id: string | null; created_at: string }
        Insert: Record<string, unknown>
        Update: Record<string, unknown>
        Relationships: []
      }
      tasks: {
        Row: { id: string; title: string; description: string | null; status: string; priority: string; category_id: string | null; assigned_to: string | null; branch_id: string; due_date: string | null; created_by: string | null; created_at: string; updated_at: string }
        Insert: Record<string, unknown>
        Update: Record<string, unknown>
        Relationships: []
      }
      worker_shifts: {
        Row: { id: string; employee_id: string; branch_id: string; shift_date: string; start_time: string; end_time: string; status: string; notes: string | null; created_by: string | null; created_at: string }
        Insert: Record<string, unknown>
        Update: Record<string, unknown>
        Relationships: []
      }
      automation_schedules: {
        Row: { id: string; rule_id: string; scheduled_at: string; executed_at: string | null; status: string; error: string | null; created_at: string }
        Insert: Record<string, unknown>
        Update: Record<string, unknown>
        Relationships: []
      }
      inventory_snapshots: {
        Row: {
          id: string; branch_id: string; snapshot_date: string; product_id: string
          quantity: number; reserved_stock: number | null; created_at: string
        }
        Insert: Record<string, unknown>
        Update: Record<string, unknown>
        Relationships: []
      }
      // stock_movements has extra columns from archived migrations (from_warehouse_id, to_warehouse_id)
      stock_movements: {
        Row: AutoDatabase['public']['Tables']['stock_movements']['Row'] & {
          from_warehouse_id: string | null
          to_warehouse_id: string | null
        }
        Insert: AutoDatabase['public']['Tables']['stock_movements']['Insert'] & {
          from_warehouse_id?: string | null
          to_warehouse_id?: string | null
        }
        Update: AutoDatabase['public']['Tables']['stock_movements']['Update']
        Relationships: AutoDatabase['public']['Tables']['stock_movements']['Relationships']
      }
      // ── Tables added by Wave 2+ migrations (not yet in codegen) ──────
      supplier_invoices: {
        Row: {
          id: string; invoice_number: string; supplier_id: string
          purchase_order_id: string | null; amount: number; tax_amount: number
          total_amount: number; due_date: string; status: string
          documents: Record<string, unknown> | null; notes: string | null
          created_by: string | null; approved_by: string | null
          created_at: string; updated_at: string
        }
        Insert: Record<string, unknown>
        Update: Record<string, unknown>
        Relationships: []
      }
      supplier_returns: {
        Row: {
          id: string; return_number: string; supplier_id: string
          purchase_order_id: string | null; receipt_id: string | null
          reason: string | null; status: string; credit_amount: number
          replacement_required: boolean; notes: string | null
          created_by: string | null; approved_by: string | null
          created_at: string; updated_at: string
        }
        Insert: Record<string, unknown>
        Update: Record<string, unknown>
        Relationships: []
      }
      supplier_return_items: {
        Row: {
          id: string; supplier_return_id: string; product_id: string | null
          quantity_returned: number; unit_price: number; reason: string | null
          batch_number: string | null; condition_notes: string | null
          created_at: string
        }
        Insert: Record<string, unknown>
        Update: Record<string, unknown>
        Relationships: []
      }
      warehouse_locations: {
        Row: {
          id: string; warehouse_id: string; zone: string; aisle: string | null
          row: string | null; shelf: string | null; bin: string | null
          barcode: string | null; capacity: number; is_pickable: boolean
          status: string; created_at: string; updated_at: string
        }
        Insert: Record<string, unknown>
        Update: Record<string, unknown>
        Relationships: []
      }
      purchase_requisitions: {
        Row: {
          id: string; requisition_number: string; branch_id: string
          supplier_id: string | null; requester_id: string
          approver_id: string | null; status: string; rejection_reason: string | null
          notes: string | null; expected_date: string | null
          urgency: string; created_at: string; updated_at: string
        }
        Insert: Record<string, unknown>
        Update: Record<string, unknown>
        Relationships: []
      }
      purchase_requisition_items: {
        Row: {
          id: string; requisition_id: string; product_id: string
          quantity_requested: number; quantity_approved: number | null
          unit_price_estimate: number | null; notes: string | null
          created_at: string
        }
        Insert: Record<string, unknown>
        Update: Record<string, unknown>
        Relationships: []
      }
      po_attachments: {
        Row: {
          id: string; purchase_order_id: string; file_name: string
          file_size: number; mime_type: string; storage_path: string
          uploaded_by: string | null; created_at: string
        }
        Insert: Record<string, unknown>
        Update: Record<string, unknown>
        Relationships: []
      }
      login_history: {
        Row: {
          id: string; user_id: string; ip_address: string | null
          user_agent: string | null; device_info: string | null
          location: string | null; status: string; failure_reason: string | null
          created_at: string
        }
        Insert: Record<string, unknown>
        Update: Record<string, unknown>
        Relationships: []
      }
      devices: {
        Row: {
          id: string; name: string; device_type: string; branch_id: string
          register_id: string | null; app_version: string | null
          ip_address: string | null; status: string; last_seen_at: string | null
          first_seen_at: string; metadata: Record<string, unknown>
          created_at: string; updated_at: string
        }
        Insert: Record<string, unknown>
        Update: Record<string, unknown>
        Relationships: []
      }
      campaigns: {
        Row: {
          id: string; name: string; description: string | null
          multiplier: number; start_date: string; end_date: string
          category_filters: string[] | null; tier_filters: string[] | null
          product_ids: string[] | null; branch_ids: string[] | null
          status: string; created_by: string | null; created_at: string
          updated_at: string
        }
        Insert: Record<string, unknown>
        Update: Record<string, unknown>
        Relationships: []
      }
      invoice_match_items: {
        Row: {
          id: string; invoice_id: string; po_item_id: string | null
          receipt_item_id: string | null; quantity_ordered: number
          quantity_received: number; quantity_invoiced: number
          quantity_matched: number; price_ordered: number
          price_received: number; price_invoiced: number
          match_status: string; discrepancy_notes: string | null
          created_at: string; updated_at: string
        }
        Insert: Record<string, unknown>
        Update: Record<string, unknown>
        Relationships: []
      }
      ecommerce_orders: {
        Row: {
          id: string; order_number: string; store_id: string
          customer_id: string | null; status: string
          subtotal: number; tax_amount: number; shipping_amount: number
          discount_amount: number; total_amount: number; currency: string
          payment_method: string | null; payment_status: string
          payment_reference: string | null
          shipping_address: Record<string, unknown> | null
          billing_address: Record<string, unknown> | null
          notes: string | null; created_at: string; updated_at: string
          confirmed_at: string | null; shipped_at: string | null
          delivered_at: string | null; cancelled_at: string | null
        }
        Insert: {
          store_id: string; subtotal: number; tax_amount: number
          shipping_amount: number; total_amount: number
          customer_id?: string | null; discount_amount?: number
          currency?: string; payment_method?: string | null
          payment_status?: string; payment_reference?: string | null
          shipping_address?: Record<string, unknown> | null
          billing_address?: Record<string, unknown> | null
          notes?: string | null
        }
        Update: Record<string, unknown>
        Relationships: []
      }
      ecommerce_product_sync: {
        Row: {
          id: string; product_id: string; store_id: string
          sync_status: string; last_synced_at: string | null
          online_data: Record<string, unknown> | null
          created_at: string; updated_at: string
        }
        Insert: {
          product_id: string; store_id: string
          sync_status?: string; last_synced_at?: string | null
          online_data?: Record<string, unknown> | null
        }
        Update: Record<string, unknown>
        Relationships: []
      }
      audit_log: {
        Row: {
          id: string; action: string; table_name: string | null
          record_id: string | null; actor_id: string | null
          entity_type: string | null; entity_id: string | null
          user_id: string | null; description: string | null
          details: Record<string, unknown> | null; created_at: string
        }
        Insert: Record<string, unknown>
        Update: Record<string, unknown>
        Relationships: []
      }
      health_check: {
        Row: {
          id: string; status: string; checked_at: string
        }
        Insert: Record<string, unknown>
        Update: Record<string, unknown>
        Relationships: []
      }
    }
    Functions: AutoDatabase['public']['Functions'] & {
      receive_stock_transfer: {
        Args: {
          p_transfer_id: string
          p_items: unknown
          p_received_by: string
          p_received_at?: string
        }
        Returns: { success: boolean; error?: string; itemErrors?: unknown[] }
      }
      snapshot_inventory: {
        Args: Record<string, never>
        Returns: number
      }
      get_opening_stock: {
        Args: { p_snapshot_date: string }
        Returns: Array<{ product_id: string; branch_id: string; quantity: number }>
      }
    }
  }
}

function requireEnv(name: string, value: string | undefined): string {
  if (!value || value.includes('placeholder')) {
    throw new Error(`[ENV] Missing required environment variable: ${name}`)
  }
  return value
}

// ── Lazily-initialised env vars ──────────────────────────────────
// These are module-level helpers, but the actual env-var reads happen
// only when the specific client is first requested, so client-side
// imports never trigger requireEnv() for server-only env vars.

function getSupabaseUrl(): string {
  return requireEnv('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL)
}
function getSupabaseAnonKey(): string {
  return requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
}
function getSupabaseServiceRoleKey(): string {
  return requireEnv('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY)
}

// ── Shared helpers ───────────────────────────────────────────────

function extractBearerToken(authorizationHeader: string | null | undefined): string | null {
  if (!authorizationHeader) return null
  const [scheme, token] = authorizationHeader.split(' ')
  if (scheme?.toLowerCase() !== 'bearer' || !token) return null
  return token
}

function extractAccessTokenFromSessionCookie(cookieValue: string | undefined): string | null {
  if (!cookieValue) return null
  try {
    const session = JSON.parse(cookieValue)
    return typeof session?.access_token === 'string' ? session.access_token : null
  } catch {
    return null
  }
}

function extractCookieValue(cookieHeader: string | null | undefined, name: string): string | null {
  if (!cookieHeader) return null
  const cookies = cookieHeader.split('; ')
  const cookie = cookies.find((entry) => entry.startsWith(`${name}=`))
  if (!cookie) return null
  return decodeURIComponent(cookie.slice(name.length + 1))
}

function buildSupabaseClient(accessToken?: string | null) {
  return createSupabaseClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
    global: accessToken
      ? { headers: { Authorization: `Bearer ${accessToken}` } }
      : undefined,
  })
}

// ── Public API ───────────────────────────────────────────────────

export function createClient(request?: Request) {
  const bearerToken = request ? extractBearerToken(request.headers.get('authorization')) : null
  const cookieToken = extractAccessTokenFromSessionCookie(
    extractCookieValue(request?.headers.get('cookie'), SUPABASE_AUTH_STORAGE_KEY) ?? undefined,
  )
  return buildSupabaseClient(bearerToken ?? cookieToken)
}

export async function createServerActionClient() {
  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get(SUPABASE_AUTH_STORAGE_KEY)?.value
  return buildSupabaseClient(extractAccessTokenFromSessionCookie(sessionCookie))
}

export async function getServerActionAccessToken() {
  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get(SUPABASE_AUTH_STORAGE_KEY)?.value
  return extractAccessTokenFromSessionCookie(sessionCookie)
}

// ── Server-auth verifier client (lazy) ───────────────────────────
let _verifierClient: ReturnType<typeof buildSupabaseClient> | null = null

export function getServerAuthVerifierClient() {
  if (!_verifierClient) {
    _verifierClient = buildSupabaseClient()
  }
  return _verifierClient
}

// ── Service-role admin client (lazy) ─────────────────────────────
// Uses the service_role key to bypass RLS. Only call from server actions / API routes.
let _adminClient: ReturnType<typeof createSupabaseClient<Database>> | null = null

export function getSupabaseAdmin(): ReturnType<typeof createSupabaseClient<Database>> {
  if (!_adminClient) {
    _adminClient = createSupabaseClient<Database>(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
      auth: { autoRefreshToken: false, persistSession: false },
    })
  }
  return _adminClient
}

/**
 * Legacy re-export.
 *
 * This is a Proxy that lazily delegates to getSupabaseAdmin() so that
 * importing this file from a client component does NOT trigger requireEnv()
 * for server-only env vars at module-evaluation time.
 *
 * @deprecated Import getSupabaseAdmin() instead.
 */
export const supabaseAdmin = new Proxy(
  {},
  {
    get(_target, prop, receiver) {
      const client = getSupabaseAdmin()
      const value = Reflect.get(client, prop, receiver)
      return typeof value === 'function' ? value.bind(client) : value
    },
    set(_target, prop, value, receiver) {
      return Reflect.set(getSupabaseAdmin(), prop, value, receiver)
    },
  },
) as ReturnType<typeof createSupabaseClient<Database>>
