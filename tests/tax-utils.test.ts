import { describe, it, expect } from 'vitest'
import { calculateTax } from '@/lib/tax-utils'

describe('calculateTax (tax-exclusive)', () => {
  it('adds tax on top when not inclusive', () => {
    const result = calculateTax(1000, 16, false)
    expect(result.taxCents).toBe(160)
    expect(result.exclusiveCents).toBe(1000)
    expect(result.inclusiveCents).toBe(1160)
  })

  it('handles 0% tax rate', () => {
    const result = calculateTax(1000, 0, false)
    expect(result.taxCents).toBe(0)
    expect(result.exclusiveCents).toBe(1000)
    expect(result.inclusiveCents).toBe(1000)
  })

  it('handles zero amount', () => {
    const result = calculateTax(0, 16, false)
    expect(result.taxCents).toBe(0)
    expect(result.exclusiveCents).toBe(0)
    expect(result.inclusiveCents).toBe(0)
  })

  it('rounds tax to nearest integer', () => {
    const result = calculateTax(99, 16, false)
    expect(result.taxCents).toBe(16)
  })
})

describe('calculateTax (tax-inclusive)', () => {
  it('extracts tax from inclusive amount', () => {
    const result = calculateTax(1160, 16, true)
    expect(result.taxCents).toBe(160)
    expect(result.exclusiveCents).toBe(1000)
    expect(result.inclusiveCents).toBe(1160)
  })

  it('handles 0% inclusive rate', () => {
    const result = calculateTax(1000, 0, true)
    expect(result.taxCents).toBe(0)
    expect(result.exclusiveCents).toBe(1000)
    expect(result.inclusiveCents).toBe(1000)
  })

  it('rounds extracted tax correctly', () => {
    const result = calculateTax(100, 16, true)
    expect(result.taxCents).toBe(14)
    expect(result.exclusiveCents).toBe(86)
    expect(result.inclusiveCents).toBe(100)
  })

  it('handles zero inclusive amount', () => {
    const result = calculateTax(0, 16, true)
    expect(result.taxCents).toBe(0)
    expect(result.exclusiveCents).toBe(0)
    expect(result.inclusiveCents).toBe(0)
  })
})

describe('calculateTax (edge cases)', () => {
  it('handles 100% tax rate (exclusive)', () => {
    const result = calculateTax(1000, 100, false)
    expect(result.taxCents).toBe(1000)
    expect(result.inclusiveCents).toBe(2000)
  })

  it('handles 100% tax rate (inclusive)', () => {
    const result = calculateTax(2000, 100, true)
    expect(result.taxCents).toBe(1000)
    expect(result.exclusiveCents).toBe(1000)
  })

  it('handles very large amounts', () => {
    const result = calculateTax(10000000, 16, false)
    expect(result.taxCents).toBe(1600000)
    expect(result.inclusiveCents).toBe(11600000)
  })
})
