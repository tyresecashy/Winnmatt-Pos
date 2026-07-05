'use server'

/**
 * Payroll — PAYE, NHIF, NSSF calculations for Kenya
 *
 * PAYE Tax Bands (2023/2024 rates):
 *   0 - 24,000:      10%
 *   24,001 - 32,333: 25%
 *   32,334 - 500,000: 30%
 *   500,001 - 800,000: 32%
 *   800,001+:         35%
 *   Personal relief: KSh 2,400/month
 *
 * NHIF Rates (sliding scale):
 *   0 - 5,999:       KSh 150
 *   6,000 - 7,999:   KSh 300
 *   8,000 - 11,999:  KSh 400
 *   12,000 - 14,999: KSh 500
 *   15,000 - 19,999: KSh 600
 *   20,000 - 24,999: KSh 750
 *   25,000 - 29,999: KSh 850
 *   30,000 - 34,999: KSh 900
 *   35,000 - 39,999: KSh 950
 *   40,000 - 44,999: KSh 1,000
 *   45,000 - 49,999: KSh 1,100
 *   50,000 - 59,999: KSh 1,200
 *   60,000 - 69,999: KSh 1,300
 *   70,000 - 79,999: KSh 1,400
 *   80,000 - 89,999: KSh 1,500
 *   90,000 - 99,999: KSh 1,600
 *   100,000+:        KSh 1,700
 *
 * NSSF (New Rates):
 *   Tier I: 6% of first KSh 7,000 = KSh 420
 *   Tier II: 6% of (KSh 7,001 - 36,000) = KSh 1,740
 *   Maximum: KSh 2,160/month
 *
 * Housing Levy: 1.5% of gross salary (employer matches)
 */

import { logger } from '@/lib/logger'
import { supabaseAdmin } from '@/lib/supabase-server'
import { authenticateServerAction } from '@/lib/auth-helpers'

// ─── Tax Calculations ──────────────────────────────────────────────────────

export async function calculatePAYE(grossSalary: number): Promise<number> {
  // Monthly taxable income
  const taxable = grossSalary

  let paye = 0
  if (taxable <= 24000) {
    paye = taxable * 0.10
  } else if (taxable <= 32333) {
    paye = (24000 * 0.10) + ((taxable - 24000) * 0.25)
  } else if (taxable <= 500000) {
    paye = (24000 * 0.10) + (8333 * 0.25) + ((taxable - 32333) * 0.30)
  } else if (taxable <= 800000) {
    paye = (24000 * 0.10) + (8333 * 0.25) + (467667 * 0.30) + ((taxable - 500000) * 0.32)
  } else {
    paye = (24000 * 0.10) + (8333 * 0.25) + (467667 * 0.30) + (300000 * 0.32) + ((taxable - 800000) * 0.35)
  }

  // Apply personal relief
  paye = Math.max(0, paye - 2400)

  return Math.round(paye)
}

export async function calculateNHIF(grossSalary: number): Promise<number> {
  const salary = Math.round(grossSalary)

  if (salary <= 0) return 0
  if (salary <= 5999) return 150
  if (salary <= 7999) return 300
  if (salary <= 11999) return 400
  if (salary <= 14999) return 500
  if (salary <= 19999) return 600
  if (salary <= 24999) return 750
  if (salary <= 29999) return 850
  if (salary <= 34999) return 900
  if (salary <= 39999) return 950
  if (salary <= 44999) return 1000
  if (salary <= 49999) return 1100
  if (salary <= 59999) return 1200
  if (salary <= 69999) return 1300
  if (salary <= 79999) return 1400
  if (salary <= 89999) return 1500
  if (salary <= 99999) return 1600
  return 1700
}

export async function calculateNSSF(grossSalary: number): Promise<number> {
  // Tier I: 6% of first KSh 7,000
  const tierI = Math.min(grossSalary, 7000) * 0.06

  // Tier II: 6% of KSh 7,001 - 36,000
  const tierII = Math.max(0, Math.min(grossSalary, 36000) - 7000) * 0.06

  return Math.round(tierI + tierII)
}

export async function calculateHousingLevy(grossSalary: number): Promise<number> {
  return Math.round(grossSalary * 0.015)
}

// ─── Payroll Operations ────────────────────────────────────────────────────

export interface PayrollRun {
  id: string
  name: string
  period_start: string
  period_end: string
  status: string
  total_gross: number
  total_deductions: number
  total_net: number
  employee_count: number
  created_at: string
}

export async function getPayrollRuns(): Promise<PayrollRun[]> {
  await authenticateServerAction()

  const { data, error } = await supabaseAdmin
    .from('payroll_runs')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return (data || []) as PayrollRun[]
}

export async function createPayrollRun(data: {
  name: string
  period_start: string
  period_end: string
}): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    const { profile } = await authenticateServerAction()
    if (!profile) throw new Error('Unauthorized')

    const { data: run, error } = await supabaseAdmin
      .from('payroll_runs')
      .insert({
        name: data.name,
        period_start: data.period_start,
        period_end: data.period_end,
        status: 'draft',
        created_by: profile.id,
      })
      .select('id')
      .single()

    if (error) throw error
    return { success: true, id: run.id }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to create payroll run' }
  }
}

export async function processPayroll(runId: string): Promise<{
  success: boolean
  employeeCount?: number
  totalGross?: number
  totalDeductions?: number
  totalNet?: number
  error?: string
}> {
  try {
    const { profile } = await authenticateServerAction()
    if (!profile) throw new Error('Unauthorized')

    // Get the payroll run
    const { data: run, error: runErr } = await supabaseAdmin
      .from('payroll_runs')
      .select('*')
      .eq('id', runId)
      .single()

    if (runErr || !run) return { success: false, error: 'Payroll run not found' }
    if (run.status !== 'draft') return { success: false, error: 'Only draft runs can be processed' }

    // Get all active employees with salary info
    const { data: employees } = await supabaseAdmin
      .from('employee_profiles')
      .select('id, user_id, basic_salary, allowances')
      .eq('employment_status', 'active')
      .gt('basic_salary', 0)

    if (!employees || employees.length === 0) {
      return { success: false, error: 'No active employees with salary configured' }
    }

    let totalGross = 0
    let totalDeductions = 0
    let totalNet = 0

    // Generate payslip for each employee
    for (const emp of employees) {
      const basicSalary = Number(emp.basic_salary) || 0
      const allowances = Number(emp.allowances) || 0
      const grossSalary = basicSalary + allowances

      // Calculate deductions
      const paye = calculatePAYE(grossSalary)
      const nhif = calculateNHIF(grossSalary)
      const nssf = calculateNSSF(grossSalary)
      const housingLevy = calculateHousingLevy(grossSalary)
      const totalDed = paye + nhif + nssf + housingLevy
      const netSalary = grossSalary - totalDed

      // Create payslip
      await supabaseAdmin.from('payslips').insert({
        payroll_run_id: runId,
        employee_id: emp.id,
        user_id: emp.user_id,
        period_start: run.period_start,
        period_end: run.period_end,
        basic_salary: basicSalary,
        allowances: allowances,
        gross_salary: grossSalary,
        paye,
        nhif,
        nssf,
        housing_levy: housingLevy,
        total_deductions: totalDed,
        net_salary: netSalary,
        status: 'draft',
      })

      totalGross += grossSalary
      totalDeductions += totalDed
      totalNet += netSalary
    }

    // Update the payroll run totals
    await supabaseAdmin
      .from('payroll_runs')
      .update({
        status: 'completed',
        total_gross: totalGross,
        total_deductions: totalDeductions,
        total_net: totalNet,
        employee_count: employees.length,
        processed_by: profile.id,
        completed_at: new Date().toISOString(),
      })
      .eq('id', runId)

    return {
      success: true,
      employeeCount: employees.length,
      totalGross,
      totalDeductions,
      totalNet,
    }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Failed to process payroll' }
  }
}

export async function getPayslips(runId: string) {
  await authenticateServerAction()

  const { data, error } = await supabaseAdmin
    .from('payslips')
    .select('*, employee:employee_profiles(user_id, employee_id, position), user:users(full_name)')
    .eq('payroll_run_id', runId)
    .order('created_at')

  if (error) throw new Error(error.message)
  return data || []
}

export async function approvePayslip(payslipId: string) {
  const { error } = await supabaseAdmin
    .from('payslips')
    .update({ status: 'approved' })
    .eq('id', payslipId)

  if (error) throw new Error(error.message)
  return { success: true }
}

export async function markPayslipPaid(payslipId: string) {
  const { error } = await supabaseAdmin
    .from('payslips')
    .update({ status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', payslipId)

  if (error) throw new Error(error.message)
  return { success: true }
}

/**
 * Preview tax calculation for a given salary.
 */
export async function previewTaxCalculation(grossSalary: number) {
  const paye = calculatePAYE(grossSalary)
  const nhif = calculateNHIF(grossSalary)
  const nssf = calculateNSSF(grossSalary)
  const housingLevy = calculateHousingLevy(grossSalary)
  const totalDeductions = paye + nhif + nssf + housingLevy
  const netSalary = grossSalary - totalDeductions

  return {
    grossSalary,
    paye,
    nhif,
    nssf,
    housingLevy,
    totalDeductions,
    netSalary,
  }
}
