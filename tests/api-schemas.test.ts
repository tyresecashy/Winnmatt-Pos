import { describe, it, expect } from 'vitest'
import { priceApproveSchema, stkPushSchema, mpesaCallbackSchema, mpesaStatusSchema } from '@/lib/api-schemas'

describe('priceApproveSchema', () => {
  it('accepts a valid approve action', () => {
    const result = priceApproveSchema.safeParse({
      action: 'approve',
      productId: '00000000-0000-0000-0000-000000000001',
    })
    expect(result.success).toBe(true)
  })

  it('accepts a valid correct action with prices', () => {
    const result = priceApproveSchema.safeParse({
      action: 'correct',
      productId: '00000000-0000-0000-0000-000000000001',
      newSellingPrice: 1500,
      newPurchasePrice: 1000,
      reason: 'Verified price mismatch',
    })
    expect(result.success).toBe(true)
  })

  it('accepts protect action with protection level', () => {
    const result = priceApproveSchema.safeParse({
      action: 'protect',
      productId: '00000000-0000-0000-0000-000000000001',
      protectionLevel: 'strict',
    })
    expect(result.success).toBe(true)
  })

  it('rejects an invalid action', () => {
    const result = priceApproveSchema.safeParse({
      action: 'delete',
      productId: '00000000-0000-0000-0000-000000000001',
    })
    expect(result.success).toBe(false)
  })

  it('rejects a non-UUID productId', () => {
    const result = priceApproveSchema.safeParse({
      action: 'approve',
      productId: 'not-a-uuid',
    })
    expect(result.success).toBe(false)
  })

  it('rejects negative newSellingPrice', () => {
    const result = priceApproveSchema.safeParse({
      action: 'correct',
      productId: '00000000-0000-0000-0000-000000000001',
      newSellingPrice: -100,
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing action', () => {
    const result = priceApproveSchema.safeParse({
      productId: '00000000-0000-0000-0000-000000000001',
    })
    expect(result.success).toBe(false)
  })
})

describe('stkPushSchema', () => {
  it('accepts a valid STK push request', () => {
    const result = stkPushSchema.safeParse({
      saleId: '00000000-0000-0000-0000-000000000001',
      phoneNumber: '254712345678',
      amount: 1000,
    })
    expect(result.success).toBe(true)
  })

  it('accepts 0-prefixed phone number', () => {
    const result = stkPushSchema.safeParse({
      saleId: '00000000-0000-0000-0000-000000000001',
      phoneNumber: '0712345678',
      amount: 500,
    })
    expect(result.success).toBe(true)
  })

  it('rejects a short phone number', () => {
    const result = stkPushSchema.safeParse({
      saleId: '00000000-0000-0000-0000-000000000001',
      phoneNumber: '07123',
      amount: 500,
    })
    expect(result.success).toBe(false)
  })

  it('rejects a non-positive amount', () => {
    const result = stkPushSchema.safeParse({
      saleId: '00000000-0000-0000-0000-000000000001',
      phoneNumber: '254712345678',
      amount: 0,
    })
    expect(result.success).toBe(false)
  })

  it('rejects an amount over 150,000', () => {
    const result = stkPushSchema.safeParse({
      saleId: '00000000-0000-0000-0000-000000000001',
      phoneNumber: '254712345678',
      amount: 200000,
    })
    expect(result.success).toBe(false)
  })

  it('rejects a non-UUID saleId', () => {
    const result = stkPushSchema.safeParse({
      saleId: 'abc-123',
      phoneNumber: '254712345678',
      amount: 500,
    })
    expect(result.success).toBe(false)
  })

  it('accepts optional accountReference', () => {
    const result = stkPushSchema.safeParse({
      saleId: '00000000-0000-0000-0000-000000000001',
      phoneNumber: '254712345678',
      amount: 1000,
      accountReference: 'TEST-REF',
    })
    expect(result.success).toBe(true)
  })
})

describe('mpesaStatusSchema', () => {
  it('accepts a valid checkoutRequestId', () => {
    const result = mpesaStatusSchema.safeParse({ checkoutRequestId: 'wsr_12345abc' })
    expect(result.success).toBe(true)
  })

  it('rejects empty checkoutRequestId', () => {
    const result = mpesaStatusSchema.safeParse({ checkoutRequestId: '' })
    expect(result.success).toBe(false)
  })
})
