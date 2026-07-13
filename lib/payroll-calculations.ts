/**
 * Payroll tax calculation functions — pure math, no server dependencies.
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

export interface TaxPreview {
  grossSalary: number
  paye: number
  nhif: number
  nssf: number
  housingLevy: number
  totalDeductions: number
  netSalary: number
}

export function calculatePAYE(grossSalary: number): number {
  const taxable = grossSalary

  let paye = 0
  if (taxable <= 24000) {
    paye = taxable * 0.10
  } else if (taxable <= 32333) {
    paye = 24000 * 0.10 + (taxable - 24000) * 0.25
  } else if (taxable <= 500000) {
    paye = 24000 * 0.10 + 8333 * 0.25 + (taxable - 32333) * 0.30
  } else if (taxable <= 800000) {
    paye = 24000 * 0.10 + 8333 * 0.25 + 467667 * 0.30 + (taxable - 500000) * 0.32
  } else {
    paye = 24000 * 0.10 + 8333 * 0.25 + 467667 * 0.30 + 300000 * 0.32 + (taxable - 800000) * 0.35
  }

  paye = Math.max(0, paye - 2400)
  return Math.round(paye)
}

export function calculateNHIF(grossSalary: number): number {
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

export function calculateNSSF(grossSalary: number): number {
  const tierI = Math.min(grossSalary, 7000) * 0.06
  const tierII = Math.max(0, Math.min(grossSalary, 36000) - 7000) * 0.06
  return Math.round(tierI + tierII)
}

export function calculateHousingLevy(grossSalary: number): number {
  return Math.round(grossSalary * 0.015)
}

export function computeTaxPreview(grossSalary: number): TaxPreview {
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
