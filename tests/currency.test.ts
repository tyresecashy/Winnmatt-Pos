import { describe, it, expect } from 'vitest'
import { formatKSh, formatKShDecimal, pointsToKSh, formatCurrency } from '@/lib/currency'

describe('formatKSh', () => {
  it('formats whole numbers without decimals', () => {
    expect(formatKSh(1000)).toBe('KSh 1,000')
  })

  it('handles zero', () => {
    expect(formatKSh(0)).toBe('KSh 0')
  })

  it('handles negative values', () => {
    expect(formatKSh(-500)).toBe('KSh -500')
  })

  it('formats large numbers with commas', () => {
    expect(formatKSh(1000000)).toBe('KSh 1,000,000')
  })

  it('rounds decimal amounts', () => {
    expect(formatKSh(1500.7)).toBe('KSh 1,501')
  })
})

describe('formatKShDecimal', () => {
  it('formats with 2 decimal places', () => {
    expect(formatKShDecimal(1000)).toBe('KSh 1,000.00')
  })

  it('formats fractional values', () => {
    expect(formatKShDecimal(1500.5)).toBe('KSh 1,500.50')
  })
})

describe('pointsToKSh', () => {
  it('converts points at default rate', () => {
    expect(pointsToKSh(100)).toBe(50)
  })

  it('converts points at custom rate', () => {
    expect(pointsToKSh(100, 1)).toBe(100)
  })

  it('handles zero points', () => {
    expect(pointsToKSh(0)).toBe(0)
  })

  it('rounds to nearest integer', () => {
    expect(pointsToKSh(3, 0.50)).toBe(2)
  })
})

describe('formatCurrency', () => {
  it('formats KES by default', () => {
    expect(formatCurrency(1000)).toBe('KSh 1,000')
  })

  it('formats USD with 2 decimals', () => {
    const result = formatCurrency(1000.5, 'USD')
    expect(result).toBe('$ 1,000.50')
  })

  it('formats EUR with 2 decimals', () => {
    const result = formatCurrency(2000, 'EUR')
    expect(result).toBe('€ 2,000.00')
  })

  it('formats GBP with 2 decimals', () => {
    const result = formatCurrency(500, 'GBP')
    expect(result).toBe('£ 500.00')
  })

  it('formats UGX with 0 decimals', () => {
    const result = formatCurrency(5000, 'UGX')
    expect(result).toBe('USh 5,000')
  })

  it('falls back for unknown currency codes', () => {
    const result = formatCurrency(100, 'XYZ')
    expect(result).toBe('XYZ 100.00')
  })

  it('handles zero', () => {
    expect(formatCurrency(0, 'USD')).toBe('$ 0.00')
  })
})
