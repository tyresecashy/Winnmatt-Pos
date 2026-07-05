/**
 * Workforce Module — Public API
 *
 * Handles employees, attendance, payroll, leaves.
 * Other modules should ONLY import from this file.
 */

// ─── Types ──────────────────────────────────────────────────────────────────

export interface Employee {
  id: string
  user_id: string
  employee_id: string | null
  staff_number: string | null
  national_id: string | null
  kra_pin: string | null
  nhif_number: string | null
  nssf_number: string | null
  department_id: string | null
  position: string | null
  hire_date: string | null
  employment_type: string | null
  employment_status: string | null
  basic_salary: number | null
  allowances: number | null
  created_at: string
  updated_at: string
}

export interface PayrollRun {
  id: string
  name: string
  period_start: string
  period_end: string
  status: string | null
  total_gross: number | null
  total_deductions: number | null
  total_net: number | null
  employee_count: number | null
  processed_by: string | null
  created_by: string | null
  created_at: string
  completed_at: string | null
}

export interface Payslip {
  id: string
  payroll_run_id: string
  employee_id: string
  user_id: string | null
  period_start: string
  period_end: string
  basic_salary: number
  allowances: number | null
  overtime_pay: number | null
  bonus: number | null
  gross_salary: number
  paye: number | null
  nhif: number | null
  nssf: number | null
  housing_levy: number | null
  other_deductions: number | null
  total_deductions: number | null
  net_salary: number | null
  status: string | null
  created_at: string
  paid_at: string | null
}

// ─── Events Emitted ─────────────────────────────────────────────────────────

export const WORKFORCE_EVENTS = {
  EMPLOYEE_CREATED: 'employee.created',
  CLOCK_IN: 'employee.clock_in',
  CLOCK_OUT: 'employee.clock_out',
  PAYROLL_PROCESSED: 'payroll.processed',
} as const

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Get employee by ID.
 */
export async function getEmployee(employeeId: string): Promise<Employee | null> {
  throw new Error('Not implemented')
}

/**
 * Get employees with filters.
 */
export async function getEmployees(filters: {
  department_id?: string
  branch_id?: string
  status?: string
  search?: string
  limit?: number
  offset?: number
}): Promise<{ data: Employee[]; total: number }> {
  throw new Error('Not implemented')
}

/**
 * Calculate Kenya statutory deductions.
 */
export function calculateStatutoryDeductions(grossSalary: number): {
  paye: number
  nhif: number
  nssf: number
  housingLevy: number
  totalDeductions: number
  netSalary: number
} {
  throw new Error('Not implemented')
}

/**
 * Process payroll for a run.
 * Emits: payroll.processed
 */
export async function processPayrollRun(
  runId: string
): Promise<{
  success: boolean
  employee_count?: number
  total_gross?: number
  total_deductions?: number
  total_net?: number
  error?: string
}> {
  throw new Error('Not implemented')
}
