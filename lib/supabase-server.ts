/* eslint-disable no-console */
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { SUPABASE_AUTH_STORAGE_KEY } from '@/lib/supabase'
import type { Database } from '@/lib/types/database'

function requireEnv(name: string, value: string | undefined): string {
  if (!value || value.includes('placeholder')) {
    throw new Error(`[ENV] Missing required environment variable: ${name}`)
  }

  return value
}

const supabaseUrl = requireEnv('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL)
const supabaseAnonKey = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const supabaseServiceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY)

function extractBearerToken(authorizationHeader: string | null | undefined): string | null {
  if (!authorizationHeader) {
    return null
  }

  const [scheme, token] = authorizationHeader.split(' ')
  if (scheme?.toLowerCase() !== 'bearer' || !token) {
    return null
  }

  return token
}

function extractAccessTokenFromSessionCookie(cookieValue: string | undefined): string | null {
  if (!cookieValue) {
    return null
  }

  try {
    const session = JSON.parse(cookieValue)
    return typeof session?.access_token === 'string' ? session.access_token : null
  } catch (error) {
    console.warn('[SUPABASE] Failed to parse auth session cookie:', error)
    return null
  }
}

function extractCookieValue(cookieHeader: string | null | undefined, name: string): string | null {
  if (!cookieHeader) {
    return null
  }

  const cookies = cookieHeader.split('; ')
  const cookie = cookies.find((entry) => entry.startsWith(`${name}=`))
  if (!cookie) {
    return null
  }

  return decodeURIComponent(cookie.slice(name.length + 1))
}

function buildSupabaseClient(accessToken?: string | null) {
  return createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: accessToken
      ? {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      : undefined,
  })
}

const sharedServerAuthVerifierClient = buildSupabaseClient()

export function createClient(request?: Request) {
  const bearerToken = request ? extractBearerToken(request.headers.get('authorization')) : null
  const cookieToken = extractAccessTokenFromSessionCookie(
    extractCookieValue(request?.headers.get('cookie'), SUPABASE_AUTH_STORAGE_KEY) ?? undefined
  )
  const accessToken = bearerToken ?? cookieToken

  return buildSupabaseClient(accessToken)
}

export async function createServerActionClient() {
  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get(SUPABASE_AUTH_STORAGE_KEY)?.value
  const accessToken = extractAccessTokenFromSessionCookie(sessionCookie)

  return buildSupabaseClient(accessToken)
}

export async function getServerActionAccessToken() {
  const { cookies } = await import('next/headers')
  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get(SUPABASE_AUTH_STORAGE_KEY)?.value
  return extractAccessTokenFromSessionCookie(sessionCookie)
}

export function getServerAuthVerifierClient() {
  return sharedServerAuthVerifierClient
}

export const supabaseAdmin = createSupabaseClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})
