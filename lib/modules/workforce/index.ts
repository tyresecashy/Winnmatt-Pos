/**
 * Workforce Module — Public API
 *
 * Handles employees, attendance, payroll, leaves.
 * Other modules should ONLY import from this file.
 *
 * Implementation: Delegates to lib/employee-actions.ts, lib/payroll-actions.ts,
 * and lib/payroll-calculations.ts.
 */

import { logger } from '@/lib/logger'
import { getEmployeeById, getEmployees as realGetEmployees, addEmployeeDocument, deleteEmployeeDocument, addEmployeeGoal, updateGoalProgress, deleteGoal } from '@/lib/employee-actions'
import { processPayroll, getPayrollRuns, createPayrollRun, getPayslips, approvePayslip, markPayslipPaid } from '@/lib/payroll-actions'
import { calculatePAYE, calculateNHIF, calculateNSSF, calculateHousingLevy } from '@/lib/payroll-calculations'
import { getLeaves, getLeaveStats, applyForLeave, updateLeaveStatus, cancelLeave } from '@/lib/leave-actions'
import { openShift, getActiveShift, closeShift, getShiftSummary, getShiftHistory, reopenShift } from '@/lib/shift-actions'
import type { PayrollRun as PayrollRunType } from '@/lib/payroll-actions'

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
 * Delegates to getEmployeeById in lib/employee-actions.ts.
 */
export async function getEmployee(employeeId: string): Promise<Employee | null> {
  try {
    const result = await getEmployeeById(employeeId)
    if (!result) return null
    return result as unknown as Employee
  } catch (error) {
    logger.error('[Workforce Module] getEmployee failed', error instanceof Error ? error.message : String(error))
    return null
  }
}

/**
 * Get employees with filters.
 * Delegates to getEmployees in lib/employee-actions.ts (supports branch_id).
 */
export async function getEmployees(filters: {
  department_id?: string
  branch_id?: string
  status?: string
  search?: string
  limit?: number
  offset?: number
}): Promise<{ data: Employee[]; total: number }> {
  try {
    const result = await realGetEmployees(filters.branch_id)
    if (!Array.isArray(result)) return { data: [], total: 0 }
    let employees = [...result] as unknown as Employee[]
    // Apply client-side filters
    if (filters.search) {
      const q = filters.search.toLowerCase()
      employees = employees.filter(
        (e) =>
          e.employee_id?.toLowerCase().includes(q) ||
          e.staff_number?.toLowerCase().includes(q) ||
          e.position?.toLowerCase().includes(q)
      )
    }
    if (filters.status) {
      employees = employees.filter((e) => e.employment_status === filters.status)
    }
    return { data: employees, total: employees.length }
  } catch (error) {
    logger.error('[Workforce Module] getEmployees failed', error instanceof Error ? error.message : String(error))
    return { data: [], total: 0 }
  }
}

/**
 * Calculate Kenya statutory deductions.
 * Delegates to individual calculation functions in lib/payroll-calculations.ts.
 */
export function calculateStatutoryDeductions(grossSalary: number): {
  paye: number
  nhif: number
  nssf: number
  housingLevy: number
  totalDeductions: number
  netSalary: number
} {
  try {
    const paye = calculatePAYE(grossSalary)
    const nhif = calculateNHIF(grossSalary)
    const nssf = calculateNSSF(grossSalary)
    const housingLevy = calculateHousingLevy(grossSalary)
    const totalDeductions = paye + nhif + nssf + housingLevy
    const netSalary = grossSalary - totalDeductions
    return { paye, nhif, nssf, housingLevy, totalDeductions, netSalary }
  } catch (error) {
    logger.error('[Workforce Module] calculateStatutoryDeductions failed', error instanceof Error ? error.message : String(error))
    return { paye: 0, nhif: 0, nssf: 0, housingLevy: 0, totalDeductions: 0, netSalary: 0 }
  }
}

/**
 * Process payroll for a run.
 * Delegates to processPayroll in lib/payroll-actions.ts.
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
  try {
    const result = await processPayroll(runId)
    return {
      success: result.success,
      employee_count: result.employeeCount,
      total_gross: result.totalGross,
      total_deductions: result.totalDeductions,
      total_net: result.totalNet,
      error: result.error,
    }
  } catch (error) {
    logger.error('[Workforce Module] processPayrollRun failed', error instanceof Error ? error.message : String(error))
    return { success: false, error: 'Operation failed. Please try again.' }
  }
}

// ─── Payroll re-exports ──────────────────────────────────────────────────────
export { getPayrollRuns, createPayrollRun, processPayroll, getPayslips, approvePayslip, markPayslipPaid } from '@/lib/payroll-actions'
// PayrollRun type exported locally above — no re-export to avoid conflict

// ─── Backward-Compatible Re-exports (external-only — not locally declared) ───

// Attendance actions
export { getAttendanceReport, getShiftTemplates, getEmployeeSchedules, addEmployeeSchedule, clockEvent, getTodayClockEvents } from '@/lib/attendance-actions'
// Employee actions (additional)
export { createEmployeeProfile, updateEmployeeProfile, getDepartments, getEmployeeStats, getEmployees as getEmployeesLegacy, createEmployeeWithUser, checkUsernameAvailability, createDepartment, addEmployeeDocument, deleteEmployeeDocument, addEmployeeGoal, updateGoalProgress, deleteGoal } from '@/lib/employee-actions'
export type { EmployeeProfile } from '@/lib/employee-actions'
// Leave actions
export { getLeaves, getLeaveStats, applyForLeave, updateLeaveStatus, cancelLeave } from '@/lib/leave-actions'
