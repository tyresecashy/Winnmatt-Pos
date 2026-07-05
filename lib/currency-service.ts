'use server'

import { supabaseAdmin } from '@/lib/supabase-server'
import { logger } from '@/lib/logger'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ExchangeRate {
  id: string
  from_currency: string
  to_currency: string
  rate: number
  source: 'manual' | 'api' | 'central_bank'
  valid_from: string
  valid_to: string | null
  created_at: string
  created_by: string | null
}

export interface CurrencyInfo {
  code: string
  name: string
  symbol: string
  decimals: number
}

// ─── Supported Currencies ───────────────────────────────────────────────────

export const SUPPORTED_CURRENCIES: CurrencyInfo[] = [
  { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh', decimals: 0 },
  { code: 'USD', name: 'US Dollar', symbol: '$', decimals: 2 },
  { code: 'EUR', name: 'Euro', symbol: '€', decimals: 2 },
  { code: 'GBP', name: 'British Pound', symbol: '£', decimals: 2 },
  { code: 'UGX', name: 'Ugandan Shilling', symbol: 'USh', decimals: 0 },
  { code: 'TZS', name: 'Tanzanian Shilling', symbol: 'TSh', decimals: 0 },
  { code: 'RWF', name: 'Rwandan Franc', symbol: 'RF', decimals: 0 },
  { code: 'NGN', name: 'Nigerian Naira', symbol: '₦', decimals: 2 },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R', decimals: 2 },
]

// ─── Currency Helpers ───────────────────────────────────────────────────────

export function getCurrencyInfo(code: string): CurrencyInfo | undefined {
  return SUPPORTED_CURRENCIES.find(c => c.code === code)
}

export function formatCurrencyAmount(amount: number, currencyCode: string): string {
  const info = getCurrencyInfo(currencyCode)
  if (!info) {
    return `${currencyCode} ${amount.toFixed(2)}`
  }
  
  const formatted = amount.toLocaleString('en-KE', {
    minimumFractionDigits: info.decimals,
    maximumFractionDigits: info.decimals,
  })
  
  return `${info.symbol} ${formatted}`
}

// ─── Exchange Rate Service ──────────────────────────────────────────────────

/**
 * Get the current exchange rate between two currencies.
 */
export async function getExchangeRate(
  fromCurrency: string,
  toCurrency: string
): Promise<number | null> {
  try {
    // Same currency = 1:1
    if (fromCurrency === toCurrency) {
      return 1
    }

    const { data, error } = await supabaseAdmin
      .rpc('get_exchange_rate', {
        from_curr: fromCurrency,
        to_curr: toCurrency,
      })

    if (error) {
      logger.error('[Currency] Failed to get exchange rate:', error)
      return null
    }

    return data
  } catch (error) {
    logger.error('[Currency] Error getting exchange rate:', error)
    return null
  }
}

/**
 * Convert an amount from one currency to another.
 */
export async function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string
): Promise<number | null> {
  try {
    // Same currency = 1:1
    if (fromCurrency === toCurrency) {
      return amount
    }

    const { data, error } = await supabaseAdmin
      .rpc('convert_currency', {
        amount,
        from_curr: fromCurrency,
        to_curr: toCurrency,
      })

    if (error) {
      logger.error('[Currency] Failed to convert currency:', error)
      return null
    }

    return data
  } catch (error) {
    logger.error('[Currency] Error converting currency:', error)
    return null
  }
}

/**
 * Get all exchange rates for a base currency.
 */
export async function getExchangeRatesForBase(
  baseCurrency: string = 'KES'
): Promise<ExchangeRate[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('exchange_rates')
      .select('*')
      .eq('to_currency', baseCurrency)
      .is('valid_to', null)
      .order('from_currency')

    if (error) throw error
    return (data || []) as ExchangeRate[]
  } catch (error) {
    logger.error('[Currency] Failed to get exchange rates:', error)
    return []
  }
}

/**
 * Create or update an exchange rate.
 */
export async function setExchangeRate(
  fromCurrency: string,
  toCurrency: string,
  rate: number,
  source: 'manual' | 'api' | 'central_bank' = 'manual'
): Promise<{ success: boolean; error?: string }> {
  try {
    // First, expire any existing rate for this pair
    await supabaseAdmin
      .from('exchange_rates')
      .update({ valid_to: new Date().toISOString() })
      .eq('from_currency', fromCurrency)
      .eq('to_currency', toCurrency)
      .is('valid_to', null)

    // Insert new rate
    const { error } = await supabaseAdmin
      .from('exchange_rates')
      .insert({
        from_currency: fromCurrency,
        to_currency: toCurrency,
        rate,
        source,
        valid_from: new Date().toISOString(),
      })

    if (error) throw error

    return { success: true }
  } catch (error) {
    logger.error('[Currency] Failed to set exchange rate:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

/**
 * Get exchange rate history for a currency pair.
 */
export async function getExchangeRateHistory(
  fromCurrency: string,
  toCurrency: string,
  limit: number = 50
): Promise<ExchangeRate[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('exchange_rates')
      .select('*')
      .eq('from_currency', fromCurrency)
      .eq('to_currency', toCurrency)
      .order('valid_from', { ascending: false })
      .limit(limit)

    if (error) throw error
    return (data || []) as ExchangeRate[]
  } catch (error) {
    logger.error('[Currency] Failed to get exchange rate history:', error)
    return []
  }
}

/**
 * Bulk update exchange rates (e.g., from API).
 */
export async function bulkUpdateExchangeRates(
  rates: { from: string; to: string; rate: number }[],
  source: 'api' | 'central_bank' = 'api'
): Promise<{ success: boolean; updated: number; error?: string }> {
  try {
    let updated = 0

    for (const { from, to, rate } of rates) {
      const result = await setExchangeRate(from, to, rate, source)
      if (result.success) {
        updated++
      }
    }

    return { success: true, updated }
  } catch (error) {
    logger.error('[Currency] Failed to bulk update rates:', error)
    return { success: false, updated: 0, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}
