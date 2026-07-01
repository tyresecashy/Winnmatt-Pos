/**
 * Currency utilities for KSh formatting and loyalty point conversions
 */

/**
 * Format amount in KSh with proper locale
 * @param amount Amount in whole KSh (e.g., 78 means KSh 78.00)
 * @returns Formatted string (e.g., "KSh 78")
 */
export const formatKSh = (amount: number): string => {
  return `KSh ${amount.toLocaleString('en-KE')}`
}

/**
 * Convert loyalty points to KSh value
 * @param points Number of loyalty points
 * @param redeemValueCents Value per point in cents (e.g., 50 = 0.5 KSh per point)
 * @returns Amount in KSh (whole number)
 */
export const pointsToKSh = (points: number, redeemValueCents: number = 50): number => {
  return Math.round((points * redeemValueCents) / 100)
}

/**
 * Calculate new loyalty balance after transaction
 * newBalance = currentPoints - redeemedPoints + earnedPoints
 * @param currentPoints Current loyalty point balance
 * @param redeemedPoints Points being redeemed (0 if not redeeming)
 * @param earnedPoints Points being earned from this transaction
 * @returns New loyalty balance
 */
export const calculateNewLoyaltyBalance = (
  currentPoints: number,
  redeemedPoints: number = 0,
  earnedPoints: number = 0
): number => {
  return Math.max(0, currentPoints - redeemedPoints + earnedPoints)
}
