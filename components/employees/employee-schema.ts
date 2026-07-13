import { z } from 'zod'

// ─── Step 1: Basic Information ─────────────────────────────────────────────

export const step1Schema = z.object({
  full_name: z.string().min(1, 'Full name is required'),
  phone: z.string().min(1, 'Phone number is required'),
  email: z
    .string()
    .email('Invalid email address')
    .optional()
    .or(z.literal('')),
  department_id: z.string().min(1, 'Department is required'),
  position: z.string().min(1, 'Position is required'),
  employment_type: z.enum(['full_time', 'part_time', 'contract', 'intern', 'casual']),
  hire_date: z.string().min(1, 'Hire date is required'),
})

export type Step1Values = z.infer<typeof step1Schema>

export const defaultStep1: Step1Values = {
  full_name: '',
  phone: '',
  email: '',
  department_id: '',
  position: '',
  employment_type: 'full_time',
  hire_date: '',
}

// ─── Step 2: System Account ────────────────────────────────────────────────

export const step2Schema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .regex(/^[a-z0-9_]+$/, 'Username can only contain lowercase letters, numbers, and underscores'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters'),
  role: z.enum(['cashier', 'manager', 'admin', 'accountant', 'inventory'], {
    errorMap: () => ({ message: 'Please select a role' }),
  }),
})

export type Step2Values = z.infer<typeof step2Schema>

export const defaultStep2: Step2Values = {
  username: '',
  password: '',
  role: 'cashier',
}

// ─── Step 3: Optional Details ──────────────────────────────────────────────

export const step3Schema = z.object({
  national_id: z.string().optional().or(z.literal('')),
  kra_pin: z
    .string()
    .regex(/^[A-Za-z]\d{9}[A-Za-z]$/, 'KRA PIN must be 11 characters (e.g. P000123456Z)')
    .optional()
    .or(z.literal('')),
  nhif_number: z.string().optional().or(z.literal('')),
  nssf_number: z.string().optional().or(z.literal('')),
  emergency_contact_name: z.string().optional().or(z.literal('')),
  emergency_contact_phone: z.string().optional().or(z.literal('')),
  emergency_contact_relation: z.string().optional().or(z.literal('')),
  basic_salary: z.coerce.number().min(0).optional().or(z.literal('')),
  allowances: z.coerce.number().min(0).optional().or(z.literal('')),
})

export type Step3Values = z.infer<typeof step3Schema>

export const defaultStep3: Step3Values = {
  national_id: '',
  kra_pin: '',
  nhif_number: '',
  nssf_number: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
  emergency_contact_relation: '',
  basic_salary: '',
  allowances: '',
}

// ─── Combined Schema (for final submission) ─────────────────────────────────

export const createEmployeeSchema = step1Schema.merge(step2Schema).merge(step3Schema)

export type CreateEmployeeValues = z.infer<typeof createEmployeeSchema>

// ─── Legacy: Edit schema (backward compatible) ─────────────────────────────

export const employeeFormSchema = z.object({
  user_id: z.string().min(1, 'User account is required'),
  employee_id: z.string().optional().default(''),
  staff_number: z.string().optional().default(''),
  national_id: z
    .string()
    .regex(/^\d{7,8}$/, 'National ID must be 7-8 digits')
    .optional()
    .or(z.literal('')),
  kra_pin: z
    .string()
    .regex(/^[A-Za-z]\d{9}[A-Za-z]$/, 'KRA PIN must be 11 characters (e.g. P000123456Z)')
    .optional()
    .or(z.literal('')),
  nhif_number: z.string().optional().default(''),
  nssf_number: z.string().optional().default(''),
  department_id: z.string().optional().default(''),
  position: z.string().optional().default(''),
  hire_date: z.string().optional().default(''),
  employment_type: z.enum(['full_time', 'part_time', 'contract', 'intern', 'casual']).default('full_time'),
  employment_status: z.enum(['active', 'inactive', 'on_leave', 'terminated']).default('active'),
  emergency_contact_name: z.string().optional().default(''),
  emergency_contact_phone: z.string().optional().default(''),
  emergency_contact_relation: z.string().optional().default(''),
})

export type EmployeeFormValues = z.infer<typeof employeeFormSchema>

export const defaultFormValues: EmployeeFormValues = {
  user_id: '',
  employee_id: '',
  staff_number: '',
  national_id: '',
  kra_pin: '',
  nhif_number: '',
  nssf_number: '',
  department_id: '',
  position: '',
  hire_date: '',
  employment_type: 'full_time',
  employment_status: 'active',
  emergency_contact_name: '',
  emergency_contact_phone: '',
  emergency_contact_relation: '',
}

// ─── Shared Types ──────────────────────────────────────────────────────────

export interface EmployeeDocument {
  id: string
  employee_id: string
  document_type: string | null
  document_url: string | null
  status: string | null
  created_at: string
}

export interface EmployeeGoal {
  id: string
  employee_id: string
  title: string | null
  description: string | null
  status: string | null
  target_date: string | null
  created_at: string
}

export interface EmployeeDetail extends EmployeeProfile {
  documents?: EmployeeDocument[]
  goals?: EmployeeGoal[]
}

// Re-export EmployeeProfile from the module layer for backward compat
import type { EmployeeProfile } from '@/lib/modules/workforce'
export type { EmployeeProfile }
