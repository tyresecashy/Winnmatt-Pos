/**
 * Currency utilities for KSh formatting and loyalty point conversions
 * All monetary values are in KES (Kenyan Shillings) — no cents.
 * 
 * Multi-currency support is available via the currency-service module.
 */

/**
 * Format amount in KSh
 * @param amount Amount in KES (e.g., 120 = KSh 120)
 * @returns Formatted string (e.g., "KSh 120")
 */
export const formatKSh = (amount: number): string => {
  return `KSh ${Math.round(amount).toLocaleString('en-KE')}`
}

/**
 * Format amount in KSh with decimals
 * @param amount Amount in KES
 * @returns Formatted string (e.g., "KSh 120.00")
 */
export const formatKShDecimal = (amount: number): string => {
  return `KSh ${amount.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * Convert loyalty points to KSh value
 * @param points Number of loyalty points
 * @param redeemValuePerPoint KSh value per point (e.g., 0.50 = 50 cents per point)
 * @returns Amount in KES
 */
export const pointsToKSh = (points: number, redeemValuePerPoint: number = 0.50): number => {
  return Math.round(points * redeemValuePerPoint)
}

/**
 * Format amount in any currency
 * @param amount Amount in the currency
 * @param currencyCode Currency code (e.g., 'KES', 'USD', 'EUR')
 * @returns Formatted string (e.g., "KSh 120", "$ 10.50")
 */
export const formatCurrency = (amount: number, currencyCode: string = 'KES'): string => {
  const currencyFormats: Record<string, { symbol: string; decimals: number }> = {
    KES: { symbol: 'KSh', decimals: 0 },
    USD: { symbol: '$', decimals: 2 },
    EUR: { symbol: '€', decimals: 2 },
    GBP: { symbol: '£', decimals: 2 },
    UGX: { symbol: 'USh', decimals: 0 },
    TZS: { symbol: 'TSh', decimals: 0 },
    RWF: { symbol: 'RF', decimals: 0 },
    NGN: { symbol: '₦', decimals: 2 },
    ZAR: { symbol: 'R', decimals: 2 },
  }

  const format = currencyFormats[currencyCode] || { symbol: currencyCode, decimals: 2 }
  
  const formatted = amount.toLocaleString('en-KE', {
    minimumFractionDigits: format.decimals,
    maximumFractionDigits: format.decimals,
  })
  
  return `${format.symbol} ${formatted}`
}
