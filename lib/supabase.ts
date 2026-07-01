import { logger } from '@/lib/logger';
import { createClient } from '@supabase/supabase-js'

function requirePublicEnv(name: string, value: string | undefined): string {
  if (!value || value.includes('placeholder')) {
    throw new Error(`[ENV] Missing required environment variable: ${name}`)
  }

  return value
}

const supabaseUrl = requirePublicEnv('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL)
const supabaseAnonKey = requirePublicEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

export const SUPABASE_AUTH_STORAGE_KEY = 'sb-winnmatt-pos-auth-token'

function getCookieValue(name: string): string | null {
  if (typeof document === 'undefined') {
    return null
  }

  const cookie = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(`${name}=`))

  if (!cookie) {
    return null
  }

  return decodeURIComponent(cookie.slice(name.length + 1))
}

function setCookieValue(name: string, value: string) {
  if (typeof document === 'undefined') {
    return
  }

  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; SameSite=Lax; Max-Age=31536000${secure}`
}

function removeCookieValue(name: string) {
  if (typeof document === 'undefined') {
    return
  }

  document.cookie = `${name}=; Path=/; SameSite=Lax; Max-Age=0`
}

const browserSessionStorage = {
  getItem(key: string) {
    if (typeof window === 'undefined') {
      return null
    }

    try {
      const localValue = window.localStorage.getItem(key)
      if (localValue) {
        return localValue
      }
    } catch (error) {
      logger.warn('[SUPABASE] Failed reading session from localStorage:', { error })
    }

    return getCookieValue(key)
  },
  setItem(key: string, value: string) {
    if (typeof window === 'undefined') {
      return
    }

    try {
      window.localStorage.setItem(key, value)
    } catch (error) {
      logger.warn('[SUPABASE] Failed writing session to localStorage:', { error })
    }

    setCookieValue(key, value)
  },
  removeItem(key: string) {
    if (typeof window === 'undefined') {
      return
    }

    try {
      window.localStorage.removeItem(key)
    } catch (error) {
      logger.warn('[SUPABASE] Failed removing session from localStorage:', { error })
    }

    removeCookieValue(key)
  },
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storageKey: SUPABASE_AUTH_STORAGE_KEY,
    storage: browserSessionStorage,
  },
})
