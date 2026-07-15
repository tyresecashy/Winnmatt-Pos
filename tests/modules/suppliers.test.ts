/**
 * Suppliers Module Facade — Unit Tests
 *
 * Tests that read operations correctly route through SupplierRepository
 * and write/cross-table operations still delegate to action files.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mock SupplierRepository ────────────────────────────────────────────────
const mockGetSuppliers = vi.fn()
const mockGetSupplierById = vi.fn()
const mockSearchSuppliers = vi.fn()

vi.mock('@/lib/modules/suppliers/repository', () => ({
  supplierRepo: {
    getSuppliers: (...args: unknown[]) => mockGetSuppliers(...args),
    getSupplierById: (...args: unknown[]) => mockGetSupplierById(...args),
    searchSuppliers: (...args: unknown[]) => mockSearchSuppliers(...args),
  },
}))

// ─── Mock lib/suppliers-actions (writes + cross-table reads) ───────────────
const mockCreateSupplier = vi.fn()
const mockUpdateSupplier = vi.fn()
const mockDeleteSupplier = vi.fn()
const mockGetSupplierOrders = vi.fn()
const mockGetSupplierPayments = vi.fn()
const mockRecordSupplierPayment = vi.fn()

vi.mock('@/lib/suppliers-actions', () => ({
  createSupplier: (...args: unknown[]) => mockCreateSupplier(...args),
  updateSupplier: (...args: unknown[]) => mockUpdateSupplier(...args),
  deleteSupplier: (...args: unknown[]) => mockDeleteSupplier(...args),
  getSupplierOrders: (...args: unknown[]) => mockGetSupplierOrders(...args),
  getSupplierPayments: (...args: unknown[]) => mockGetSupplierPayments(...args),
  recordSupplierPayment: (...args: unknown[]) => mockRecordSupplierPayment(...args),
}))

// ─── Mock lib/supplier-invoices-actions ─────────────────────────────────────
vi.mock('@/lib/supplier-invoices-actions', () => ({
  getSupplierInvoices: vi.fn(),
  getSupplierInvoice: vi.fn(),
  createSupplierInvoice: vi.fn(),
  approveSupplierInvoice: vi.fn(),
  cancelSupplierInvoice: vi.fn(),
  markInvoicePaid: vi.fn(),
  getSupplierInvoiceStats: vi.fn(),
}))

// ─── Mock lib/supplier-returns-actions ──────────────────────────────────────
vi.mock('@/lib/supplier-returns-actions', () => ({
  getSupplierReturns: vi.fn(),
  getSupplierReturn: vi.fn(),
  createSupplierReturn: vi.fn(),
  approveSupplierReturn: vi.fn(),
  cancelSupplierReturn: vi.fn(),
  getSupplierReturnStats: vi.fn(),
}))

import {
  getSuppliers,
  getSupplierById,
  searchSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  getSupplierOrders,
  getSupplierPayments,
  recordSupplierPayment,
} from '@/lib/modules/suppliers'

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── getSuppliers (reads via repository) ───────────────────────────────────

describe('getSuppliers', () => {
  it('delegates to repository getSuppliers', async () => {
    const suppliers = [
      { id: 's1', name: 'Supplier A', phone: '0700000001' },
      { id: 's2', name: 'Supplier B', phone: '0700000002' },
    ]
    mockGetSuppliers.mockResolvedValue(suppliers)

    const result = await getSuppliers()
    expect(mockGetSuppliers).toHaveBeenCalledOnce()
    expect(result).toHaveLength(2)
    expect(result[0].id).toBe('s1')
  })

  it('returns empty array on repository error', async () => {
    mockGetSuppliers.mockRejectedValue(new Error('DB error'))

    const result = await getSuppliers()
    expect(result).toEqual([])
  })
})

// ─── getSupplierById (reads via repository) ────────────────────────────────

describe('getSupplierById', () => {
  it('delegates to repository getSupplierById', async () => {
    mockGetSupplierById.mockResolvedValue({ id: 's1', name: 'Supplier A' })

    const result = await getSupplierById('s1')
    expect(mockGetSupplierById).toHaveBeenCalledWith('s1')
    expect(result).not.toBeNull()
    expect(result!.id).toBe('s1')
  })

  it('returns null when not found', async () => {
    mockGetSupplierById.mockResolvedValue(null)

    const result = await getSupplierById('nonexistent')
    expect(result).toBeNull()
  })

  it('returns null on repository error', async () => {
    mockGetSupplierById.mockRejectedValue(new Error('DB error'))

    const result = await getSupplierById('fail-id')
    expect(result).toBeNull()
  })
})

// ─── searchSuppliers (reads via repository) ─────────────────────────────────

describe('searchSuppliers', () => {
  it('delegates to repository searchSuppliers', async () => {
    const results = [
      { id: 's1', name: 'Supplier Alpha', phone: '0700000001' },
    ]
    mockSearchSuppliers.mockResolvedValue(results)

    const result = await searchSuppliers('Alpha')
    expect(mockSearchSuppliers).toHaveBeenCalledWith('Alpha')
    expect(result).toHaveLength(1)
  })

  it('returns empty array on repository error', async () => {
    mockSearchSuppliers.mockRejectedValue(new Error('Search failed'))

    const result = await searchSuppliers('fail')
    expect(result).toEqual([])
  })
})

// ─── createSupplier (write — delegates to action file) ─────────────────────

describe('createSupplier', () => {
  it('delegates to action file createSupplier', async () => {
    mockCreateSupplier.mockResolvedValue({ success: true, supplier: { id: 'new-s1' } })

    const result = await createSupplier({ name: 'New Co', contact_person: 'John', phone: '0700000000' })

    expect(mockCreateSupplier).toHaveBeenCalledWith('New Co', 'John', '0700000000', undefined, undefined)
    expect(result).toMatchObject({ success: true, id: 'new-s1', supplier: { id: 'new-s1' } })
  })

  it('returns error when action fails', async () => {
    mockCreateSupplier.mockResolvedValue({ success: false, error: 'Name is required' })

    const result = await createSupplier({ name: '', contact_person: '', phone: '' })
    expect(result).toEqual({ success: false, error: 'Name is required' })
  })
})

// ─── updateSupplier (write — delegates to action file) ─────────────────────

describe('updateSupplier', () => {
  it('delegates to action file updateSupplier', async () => {
    mockUpdateSupplier.mockResolvedValue({ success: true })

    const result = await updateSupplier('s1', { name: 'Updated' })
    expect(mockUpdateSupplier).toHaveBeenCalledWith('s1', { name: 'Updated' })
    expect(result).toEqual({ success: true })
  })

  it('returns error when action fails', async () => {
    mockUpdateSupplier.mockResolvedValue({ success: false, error: 'Not found' })

    const result = await updateSupplier('bad-id', {})
    expect(result).toEqual({ success: false, error: 'Not found' })
  })
})

// ─── deleteSupplier (write — delegates to action file) ─────────────────────

describe('deleteSupplier', () => {
  it('delegates to action file deleteSupplier', async () => {
    mockDeleteSupplier.mockResolvedValue({ success: true })

    const result = await deleteSupplier('s1')
    expect(mockDeleteSupplier).toHaveBeenCalledWith('s1')
    expect(result).toEqual({ success: true })
  })
})

// ─── getSupplierOrders (cross-table — delegates to action file) ────────────

describe('getSupplierOrders', () => {
  it('delegates to action file getSupplierOrders', async () => {
    const orders = [{ id: 'po-1', po_number: 'PO-001' }]
    mockGetSupplierOrders.mockResolvedValue(orders)

    const result = await getSupplierOrders('s1')
    expect(mockGetSupplierOrders).toHaveBeenCalledWith('s1')
    expect(result).toEqual(orders)
  })
})

// ─── getSupplierPayments (cross-table — delegates to action file) ──────────

describe('getSupplierPayments', () => {
  it('delegates to action file', async () => {
    mockGetSupplierPayments.mockResolvedValue([{ id: 'pmt-1', amount: 50000 }])

    const result = await getSupplierPayments('s1', 10)
    expect(mockGetSupplierPayments).toHaveBeenCalledWith('s1', 10)
    expect(result).toHaveLength(1)
  })
})

// ─── recordSupplierPayment (write + balance update — delegates to action file) ──

describe('recordSupplierPayment', () => {
  it('delegates to action file', async () => {
    mockRecordSupplierPayment.mockResolvedValue({ success: true })

    const result = await recordSupplierPayment({ supplierId: 's1', amountKSh: 50000 })
    expect(mockRecordSupplierPayment).toHaveBeenCalledWith('s1', 50000, undefined, undefined, undefined, undefined)
    expect(result).toEqual({ success: true })
  })
})
