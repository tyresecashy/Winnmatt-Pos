'use client'

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import en from '../messages/en.json'
import sw from '../messages/sw.json'

// ─── Types ──────────────────────────────────────────────────────────────────

export type Locale = 'en' | 'sw'

export interface I18nContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: string, params?: Record<string, string | number>) => string
  formatDate: (date: Date | string) => string
  formatTime: (date: Date | string) => string
  formatNumber: (num: number) => string
  formatCurrency: (amount: number) => string
}

// ─── Translations ───────────────────────────────────────────────────────────

const translations: Record<Locale, Record<string, unknown>> = {
  en,
  sw,
}

// ─── Helper to get nested value ─────────────────────────────────────────────

function getNestedValue(obj: Record<string, unknown>, path: string): string | undefined {
  const keys = path.split('.')
  let current: unknown = obj
  
  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined
    }
    current = (current as Record<string, unknown>)[key]
  }
  
  return typeof current === 'string' ? current : undefined
}

// ─── Helper to replace params in string ─────────────────────────────────────

function replaceParams(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return params[key] !== undefined ? String(params[key]) : `{{${key}}}`
  })
}

// ─── Context ────────────────────────────────────────────────────────────────

const I18nContext = createContext<I18nContextValue | null>(null)

// ─── Provider ───────────────────────────────────────────────────────────────

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('winnmatt_locale') as Locale) || 'en'
    }
    return 'en'
  })

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale)
    localStorage.setItem('winnmatt_locale', newLocale)
    document.documentElement.lang = newLocale
  }, [])

  // Set html lang on mount
  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    const value = getNestedValue(translations[locale], key)
    if (!value) {
      // Fallback to English
      const fallback = getNestedValue(translations.en, key)
      if (!fallback) {
        console.warn(`Translation key not found: ${key}`)
        return key
      }
      return params ? replaceParams(fallback, params) : fallback
    }
    return params ? replaceParams(value, params) : value
  }, [locale])

  const formatDate = useCallback((date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleDateString(locale === 'sw' ? 'sw-KE' : 'en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }, [locale])

  const formatTime = useCallback((date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleTimeString(locale === 'sw' ? 'sw-KE' : 'en-KE', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }, [locale])

  const formatNumber = useCallback((num: number): string => {
    return num.toLocaleString(locale === 'sw' ? 'sw-KE' : 'en-KE')
  }, [locale])

  const formatCurrency = useCallback((amount: number): string => {
    return new Intl.NumberFormat(locale === 'sw' ? 'sw-KE' : 'en-KE', {
      style: 'currency',
      currency: 'KES',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }, [locale])

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, formatDate, formatTime, formatNumber, formatCurrency }}>
      {children}
    </I18nContext.Provider>
  )
}

// ─── Hook ───────────────────────────────────────────────────────────────────

/**
 * Hook to access i18n context.
 * 
 * Usage:
 * ```tsx
 * const { t, locale, setLocale } = useI18n()
 * return <h1>{t('dashboard.title')}</h1>
 * ```
 */
export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider')
  }
  return context
}

/**
 * Simple hook to just get translations (without locale switching).
 * 
 * Usage:
 * ```tsx
 * const t = useTranslations()
 * return <h1>{t('dashboard.title')}</h1>
 * ```
 */
export function useTranslations() {
  const { t } = useI18n()
  return t
}
