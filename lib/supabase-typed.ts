/**
 * Typed Supabase Client
 *
 * Provides type-safe access to the Supabase database.
 * Import types from '@/lib/types/database' for type annotations.
 */

import { createClient } from '@supabase/supabase-js'
import type { Database } from './types/database'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/**
 * Browser-side Supabase client (uses anon key, respects RLS).
 */
export function createBrowserClient() {
  return createClient<Database>(supabaseUrl, supabaseAnonKey)
}

/**
 * Server-side Supabase client (uses service role key, bypasses RLS).
 * Only use in server actions and API routes.
 */
export function createServerClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
