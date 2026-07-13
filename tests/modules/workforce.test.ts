import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mock lib/employee-actions and lib/payroll-actions ──────────────────────
const mockGetEmployeeById = vi.fn()
const mockGetEmployees = vi.fn()
const mockProcessPayroll = vi.fn()

vi.mock('@/lib/employee-actions', () => ({
  getEmployeeById: (...args: unknown[]) => mockGetEmployeeById(...args),
  getEmployees: (...args: unknown[]) => mockGetEmployees(...args),
}))

vi.mock('@/lib/payroll-actions', () => ({
  processPayroll: (...args: unknown[]) => mockProcessPayroll(...args),
}))

// Don't mock payroll-calculations — it's pure math and useful to test directly
vi.mock('@/lib/payroll-calculations', () => ({
  calculatePAYE: vi.fn((g: number) => g * 0.1),
  calculateNHIF: vi.fn(() => 500),
  calculateNSSF: vi.fn(() => 200),
  calculateHousingLevy: vi.fn((g: number) => g * 0.015),
}))

vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }))

import { getEmployee, getEmployees, calculateStatutoryDeductions, processPayrollRun } from '@/lib/modules/workforce'

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── getEmployee ────────────────────────────────────────────────────────────

describe('getEmployee', () => {
  it('delegates to getEmployeeById', async () => {
    mockGetEmployeeById.mockResolvedValue({ id: 'emp-1', employee_id: 'EMP001', position: 'Cashier' })

    const result = await getEmployee('emp-1')
    expect(mockGetEmployeeById).toHaveBeenCalledWith('emp-1')
    expect(result).not.toBeNull()
    expect(result!.id).toBe('emp-1')
  })

  it('returns null when not found', async () => {
    mockGetEmployeeById.mockResolvedValue(null)
    const result = await getEmployee('nonexistent')
    expect(result).toBeNull()
  })
})

// ─── getEmployees ───────────────────────────────────────────────────────────

describe('getEmployees', () => {
  it('passes branch_id and applies status filter', async () => {
    mockGetEmployees.mockResolvedValue([
      { id: 'emp-1', employee_id: 'EMP001', employment_status: 'active', position: 'Cashier' },
      { id: 'emp-2', employee_id: 'EMP002', employment_status: 'terminated', position: 'Manager' },
    ])

    const result = await getEmployees({ branch_id: 'branch-1', status: 'active' })
    expect(mockGetEmployees).toHaveBeenCalledWith('branch-1')
    expect(result.data).toHaveLength(1)
    expect(result.data[0].id).toBe('emp-1')
  })

  it('applies search filter', async () => {
    mockGetEmployees.mockResolvedValue([
      { id: 'emp-1', employee_id: 'EMP001', staff_number: null, position: 'Cashier', employment_status: null },
      { id: 'emp-2', employee_id: 'EMP002', staff_number: null, position: 'Manager', employment_status: null },
    ])

    const result = await getEmployees({ search: '001' })
    expect(result.data).toHaveLength(1)
  })
})

// ─── calculateStatutoryDeductions ───────────────────────────────────────────

describe('calculateStatutoryDeductions', () => {
  it('computes all deductions and net salary', async () => {
    const result = calculateStatutoryDeductions(50000)
    expect(result.paye).toBe(5000) // 10% of 50000
    expect(result.nhif).toBe(500)
    expect(result.nssf).toBe(200)
    expect(result.housingLevy).toBe(750) // 1.5% of 50000
    expect(result.totalDeductions).toBe(5000 + 500 + 200 + 750)
    expect(result.netSalary).toBe(50000 - (5000 + 500 + 200 + 750))
  })

  it('handles zero salary', () => {
    const result = calculateStatutoryDeductions(0)
    expect(result.paye).toBe(0)
    expect(result.nhif).toBe(500) // nhif has a flat minimum in this mock
    expect(result.netSalary).toBe(0 - 0 - 500 - 200 - 0)
  })
})

// ─── processPayrollRun ──────────────────────────────────────────────────────

describe('processPayrollRun', () => {
  it('delegates to processPayroll and maps result', async () => {
    mockProcessPayroll.mockResolvedValue({
      success: true,
      employeeCount: 10,
      totalGross: 500000,
      totalDeductions: 100000,
      totalNet: 400000,
    })

    const result = await processPayrollRun('run-1')
    expect(mockProcessPayroll).toHaveBeenCalledWith('run-1')
    expect(result).toEqual({
      success: true,
      employee_count: 10,
      total_gross: 500000,
      total_deductions: 100000,
      total_net: 400000,
    })
  })

  it('maps failure result', async () => {
    mockProcessPayroll.mockResolvedValue({ success: false, error: 'Payroll already processed' })

    const result = await processPayrollRun('run-1')
    expect(result).toEqual({ success: false, error: 'Payroll already processed' })
  })
})
