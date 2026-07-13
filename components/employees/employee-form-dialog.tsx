'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { useToast } from '@/components/ui/use-toast'
import { logger } from '@/lib/logger'
import {
  createEmployeeWithUser,
  updateEmployeeProfile,
  checkUsernameAvailability,
  type EmployeeProfile,
} from '@/lib/employee-actions'
import {
  step1Schema,
  defaultStep1,
  step2Schema,
  defaultStep2,
  step3Schema,
  defaultStep3,
  type Step1Values,
  type Step2Values,
  type Step3Values,
} from './employee-schema'
import {
  Check,
  Eye,
  EyeOff,
  RefreshCw,
  Users,
  Building2,
  Briefcase,
  Calendar,
  Phone,
  Mail,
  FileText,
  Award,
  Shield,
  Loader2,
} from 'lucide-react'

interface EmployeeFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  editingEmployee: EmployeeProfile | null
  departments: { id: string; name: string }[]
  onSaved: () => void
  onDepartmentCreate?: () => void
}

interface Credentials {
  employee_id: string
  username: string
  password: string
  role: string
}

type Step = 1 | 2 | 3 | 'success'

function slugifyName(name: string): string {
  if (!name || !name.trim()) return ''
  const parts = name.trim().toLowerCase().split(/\s+/)
  if (parts.length === 1) return parts[0].replace(/[^a-z0-9]/g, '')
  const first = parts[0].replace(/[^a-z0-9]/g, '')
  const last = parts[parts.length - 1].replace(/[^a-z0-9]/g, '')
  return (first[0] + last).slice(0, 12)
}

function generatePassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%'
  let p = ''
  for (let i = 0; i < 14; i++) p += chars[Math.floor(Math.random() * chars.length)]
  return p
}

export function EmployeeFormDialog({
  open,
  onOpenChange,
  editingEmployee,
  departments,
  onSaved,
  onDepartmentCreate,
}: EmployeeFormDialogProps) {
  const { toast } = useToast()
  const [step, setStep] = useState<Step>(1)
  const [saving, setSaving] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [credentials, setCredentials] = useState<Credentials | null>(null)
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null)
  const [checkingUsername, setCheckingUsername] = useState(false)

  const step1Form = useForm<Step1Values>({
    resolver: zodResolver(step1Schema),
    defaultValues: defaultStep1,
  })

  const step2Form = useForm<Step2Values>({
    resolver: zodResolver(step2Schema),
    defaultValues: { ...defaultStep2, password: generatePassword() },
  })

  const step3Form = useForm<Step3Values>({
    resolver: zodResolver(step3Schema),
    defaultValues: defaultStep3,
  })

  const fullName = step1Form.watch('full_name')
  const watchedUsername = step2Form.watch('username')

  useEffect(() => {
    if (!editingEmployee && fullName && !step2Form.getValues('username')) {
      const base = slugifyName(fullName)
      if (base) {
        step2Form.setValue('username', base)
      }
    }
  }, [fullName, step2Form, editingEmployee])

  useEffect(() => {
    if (!watchedUsername || watchedUsername.length < 3) {
      setUsernameAvailable(null)
      return
    }
    const timer = setTimeout(async () => {
      setCheckingUsername(true)
      try {
        const available = await checkUsernameAvailability(watchedUsername)
        setUsernameAvailable(available)
      } catch {
        setUsernameAvailable(null)
      } finally {
        setCheckingUsername(false)
      }
    }, 500)
    return () => clearTimeout(timer)
  }, [watchedUsername])

  useEffect(() => {
    if (open) {
      setStep(1)
      setCredentials(null)
      setShowPassword(false)
      step1Form.reset(defaultStep1)
      step2Form.reset({ ...defaultStep2, password: generatePassword() })
      step3Form.reset(defaultStep3)
    }
  }, [open, step1Form, step2Form, step3Form])

  useEffect(() => {
    if (editingEmployee && open) {
      setStep(1)
      step1Form.reset({
        full_name: editingEmployee.user?.full_name || '',
        phone: editingEmployee.staff_number || '',
        email: editingEmployee.user?.email || '',
        department_id: editingEmployee.department_id || '',
        position: editingEmployee.position || '',
        employment_type: (editingEmployee.employment_type as Step1Values['employment_type']) || 'full_time',
        hire_date: editingEmployee.hire_date?.split('T')[0] || '',
      })
    }
  }, [editingEmployee, open, step1Form])

  // Navigation
  const goNext = async () => {
    if (step === 1) {
      const valid = await step1Form.trigger()
      if (!valid) return
      const currentUser = step2Form.getValues('username')
      if (!currentUser && fullName) {
        step2Form.setValue('username', slugifyName(fullName))
      }
      setStep(2)
    } else if (step === 2) {
      const valid = await step2Form.trigger()
      if (!valid) return
      if (usernameAvailable === false) {
        toast({
          title: 'Username taken',
          description: 'Please choose a different username',
          variant: 'destructive',
        })
        return
      }
      setStep(3)
    } else if (step === 3) {
      await handleSubmit()
    }
  }

  const goBack = () => {
    if (step === 2) setStep(1)
    else if (step === 3) setStep(2)
  }

  // Submit
  const handleSubmit = async () => {
    const s1 = step1Form.getValues()
    const s2 = step2Form.getValues()
    const s3 = step3Form.getValues()

    setSaving(true)
    try {
      const result = await createEmployeeWithUser({
        full_name: s1.full_name,
        phone: s1.phone,
        email: s1.email || undefined,
        username: s2.username,
        password: s2.password,
        role: s2.role,
        department_id: s1.department_id,
        position: s1.position,
        employment_type: s1.employment_type,
        hire_date: s1.hire_date,
        national_id: s3.national_id || undefined,
        kra_pin: s3.kra_pin || undefined,
        nhif_number: s3.nhif_number || undefined,
        nssf_number: s3.nssf_number || undefined,
        emergency_contact_name: s3.emergency_contact_name || undefined,
        emergency_contact_phone: s3.emergency_contact_phone || undefined,
        emergency_contact_relation: s3.emergency_contact_relation || undefined,
        basic_salary: s3.basic_salary ? Number(s3.basic_salary) : undefined,
        allowances: s3.allowances ? Number(s3.allowances) : undefined,
      })

      if (result.success && result.data) {
        setCredentials(result.data.credentials)
        setStep('success')
        onSaved()
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to create employee',
          variant: 'destructive',
        })
      }
    } catch (error) {
      logger.error('Create employee error:', error)
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleEditSave = async () => {
    if (!editingEmployee) return
    const s1 = step1Form.getValues()
    setSaving(true)
    try {
      const result = await updateEmployeeProfile(editingEmployee.id, {
        staff_number: s1.phone || undefined,
        department_id: s1.department_id || undefined,
        position: s1.position || undefined,
        employment_type: s1.employment_type,
        hire_date: s1.hire_date || undefined,
      })
      if (result.success) {
        toast({ title: 'Updated', description: 'Employee updated successfully' })
        onOpenChange(false)
        onSaved()
      } else {
        toast({ title: 'Error', description: result.error || 'Failed to update', variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: 'Error', description: 'An unexpected error occurred', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const copyAllCredentials = async () => {
    if (!credentials) return
    const text = 'WINNMATT POS - New Employee Credentials\n\n' +
      'Employee ID: ' + credentials.employee_id + '\n' +
      'Username: ' + credentials.username + '\n' +
      'Password: ' + credentials.password + '\n' +
      'Role: ' + credentials.role + '\n\n' +
      'Please change your password on first login.'
    await navigator.clipboard.writeText(text)
    toast({ title: 'Copied', description: 'Credentials copied to clipboard' })
  }

  const handleEmail = () => {
    if (!credentials) return
    const email = step1Form.getValues('email')
    if (!email) {
      toast({ title: 'No email', description: 'No email address on file', variant: 'destructive' })
      return
    }
    const subject = encodeURIComponent('Your WINNMATT POS Account Credentials')
    const body = encodeURIComponent(
      'Hi ' + step1Form.getValues('full_name') + ',\n\n' +
      'Your WINNMATT POS account has been created.\n\n' +
      'Username: ' + credentials.username + '\n' +
      'Password: ' + credentials.password + '\n' +
      'Role: ' + credentials.role + '\n\n' +
      'Please log in and change your password.\n\nRegards,\nHR'
    )
    window.open('mailto:' + email + '?subject=' + subject + '&body=' + body)
  }

  const escapeHtml = (str: string): string =>
    str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')

  const handlePrint = () => {
    if (!credentials) return
    const s1 = step1Form.getValues()
    const w = window.open('', '_blank', 'width=480,height=640')
    if (!w) return
    // Build HTML with escaped user-controlled values to prevent XSS
    const safeName = escapeHtml(s1.full_name)
    const safeUsername = escapeHtml(credentials.username)
    const safePassword = escapeHtml(credentials.password)
    const safeRole = escapeHtml(credentials.role)
    const safeDate = escapeHtml(new Date().toLocaleString())
    w.document.write('<html><head><title>Employee Credentials</title>' +
      '<style>body{font-family:system-ui,sans-serif;padding:48px;color:#1a1a2e;max-width:420px;margin:auto}' +
      'h1{font-size:20px;margin:0 0 4px}.muted{color:#6b7280;font-size:12px;margin-bottom:32px}' +
      '.row{display:flex;justify-content:space-between;padding:14px 0;border-bottom:1px solid #e5e7eb}' +
      '.label{font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#6b7280}' +
      '.val{font-family:monospace;font-size:14px}.foot{margin-top:40px;font-size:11px;color:#9ca3af}' +
      '</style></head><body>' +
      '<h1>WINNMATT POS - Login Slip</h1>' +
      '<div class="muted">Confidential - ' + safeDate + '</div>' +
      '<div class="row"><span class="label">Name</span><span>' + safeName + '</span></div>' +
      '<div class="row"><span class="label">Username</span><span class="val">' + safeUsername + '</span></div>' +
      '<div class="row"><span class="label">Password</span><span class="val">' + safePassword + '</span></div>' +
      '<div class="row"><span class="label">Role</span><span>' + safeRole + '</span></div>' +
      '<div class="foot">Please change your password on first login. Destroy this slip after delivery.</div>' +
      '</body></html>')
    w.document.close()
    w.focus()
    setTimeout(function() { w.print() }, 300)
  }

  const roles = [
    { value: 'cashier', label: 'Cashier', description: 'Process sales, returns, reconciliation', emoji: '💰' },
    { value: 'manager', label: 'Manager', description: 'Override transactions, manage team', emoji: '👔' },
    { value: 'admin', label: 'Admin', description: 'Full system access: settings, users', emoji: '🔐' },
    { value: 'accountant', label: 'Accountant', description: 'Financial reports, reconciliations', emoji: '📊' },
    { value: 'inventory', label: 'Inventory Clerk', description: 'Receive stock, adjust counts', emoji: '📦' },
  ]

  const selectedRole = step2Form.watch('role')

  const StepDot = function({ num, label, currentStep }: { num: number; label: string; currentStep: Step }) {
    const isActive = currentStep === num
    const isDone = typeof currentStep === 'number' && currentStep > num
    return (
      <div className="flex items-center gap-2 min-w-0">
        <div className={'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold transition-all duration-300 ' + (
          isDone
            ? 'border-emerald-500 bg-emerald-500 text-white'
            : isActive
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-muted-foreground/30 text-muted-foreground/50'
        )}>
          {isDone ? <Check className="h-3.5 w-3.5" /> : num}
        </div>
        <span className={'hidden text-sm font-medium sm:block ' + (
          isActive ? 'text-foreground' : isDone ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground/50'
        )}>
          {label}
        </span>
      </div>
    )
  }

  // Edit mode
  if (editingEmployee) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Employee</DialogTitle>
            <DialogDescription>Update the employee profile information</DialogDescription>
          </DialogHeader>
          <Form {...step1Form}>
            <form onSubmit={step1Form.handleSubmit(handleEditSave)} className="space-y-4">
              <FormField
                control={step1Form.control}
                name="full_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl><Input {...field} placeholder="e.g. John Doe" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={step1Form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone Number</FormLabel>
                    <FormControl><Input {...field} placeholder="e.g. +254 712 345 678" /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={step1Form.control}
                  name="department_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Department</FormLabel>
                      <Select
                        onValueChange={(value) => {
                          if (value === 'create_dept') {
                            onDepartmentCreate?.()
                            return
                          }
                          field.onChange(value)
                        }}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {departments.length === 0 ? (
                            <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                              No departments yet
                            </div>
                          ) : (
                            departments.map(function(d) { return (
                              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                            )})
                          )}
                          {onDepartmentCreate && (
                            <div className="border-t border-border mt-1 pt-1">
                              <SelectItem value="create_dept">+ Create Department</SelectItem>
                            </div>
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={step1Form.control}
                  name="position"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Position</FormLabel>
                      <FormControl><Input {...field} placeholder="e.g. Cashier" /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={step1Form.control}
                  name="employment_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Employment Type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="full_time">Full Time</SelectItem>
                          <SelectItem value="part_time">Part Time</SelectItem>
                          <SelectItem value="contract">Contract</SelectItem>
                          <SelectItem value="intern">Intern</SelectItem>
                          <SelectItem value="casual">Casual</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={step1Form.control}
                  name="hire_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hire Date</FormLabel>
                      <FormControl><Input type="date" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" type="button" onClick={function() { onOpenChange(false) }}>Cancel</Button>
                <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Update Employee'}</Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    )
  }

  // Create mode (multi-step)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        {step !== 'success' && (
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Add New Employee
            </DialogTitle>
            <DialogDescription>Create an employee profile with a new system account</DialogDescription>
          </DialogHeader>
        )}

        {/* Stepper */}
        {step !== 'success' && (
          <div className="flex items-center justify-between px-1 py-3">
            <StepDot num={1} label="Basic Info" currentStep={step} />
            <div className={'h-px flex-1 mx-2 transition-colors duration-300 ' + (step >= 2 ? 'bg-emerald-400' : 'bg-muted')} />
            <StepDot num={2} label="Account" currentStep={step} />
            <div className={'h-px flex-1 mx-2 transition-colors duration-300 ' + (step >= 3 ? 'bg-emerald-400' : 'bg-muted')} />
            <StepDot num={3} label="Details" currentStep={step} />
          </div>
        )}

        {/* Step 1: Basic Information */}
        {step === 1 && (
          <Form {...step1Form}>
            <div className="space-y-5 py-2">
              <div>
                <h3 className="text-base font-semibold mb-1">Basic Information</h3>
                <p className="text-xs text-muted-foreground mb-4">Core profile fields. Email is optional.</p>
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <FormField
                  control={step1Form.control}
                  name="full_name"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Full Name <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Users className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input className="pl-9" placeholder="e.g. John Doe" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={step1Form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input className="pl-9" placeholder="+254 712 345 678" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={step1Form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input className="pl-9" placeholder="john@company.com" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={step1Form.control}
                  name="department_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Department <span className="text-destructive">*</span></FormLabel>
                      <Select
                        onValueChange={(value) => {
                          if (value === 'create_dept') {
                            onDepartmentCreate?.()
                            return
                          }
                          field.onChange(value)
                        }}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {departments.length === 0 ? (
                            <div className="px-3 py-4 text-center text-sm text-muted-foreground">
                              No departments yet
                            </div>
                          ) : (
                            departments.map(function(d) { return (
                              <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                            )})
                          )}
                          {onDepartmentCreate && (
                            <div className="border-t border-border mt-1 pt-1">
                              <SelectItem value="create_dept">+ Create Department</SelectItem>
                            </div>
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={step1Form.control}
                  name="position"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Position <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Briefcase className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input className="pl-9" placeholder="e.g. Senior Cashier" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={step1Form.control}
                  name="employment_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Employment Type <span className="text-destructive">*</span></FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="full_time">Full Time</SelectItem>
                          <SelectItem value="part_time">Part Time</SelectItem>
                          <SelectItem value="contract">Contract</SelectItem>
                          <SelectItem value="intern">Intern</SelectItem>
                          <SelectItem value="casual">Casual</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={step1Form.control}
                  name="hire_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Hire Date <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input className="pl-9" type="date" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </Form>
        )}

        {/* Step 2: System Account */}
        {step === 2 && (
          <Form {...step2Form}>
            <div className="space-y-5 py-2">
              <div>
                <h3 className="text-base font-semibold mb-1">System Account</h3>
                <p className="text-xs text-muted-foreground mb-4">
                  A new user account will be created automatically with these credentials.
                </p>
              </div>
              <div className="rounded-lg border bg-card p-5 space-y-5">
                <FormField
                  control={step2Form.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel>Username <span className="text-destructive">*</span></FormLabel>
                        {checkingUsername && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" /> Checking...
                          </span>
                        )}
                        {!checkingUsername && usernameAvailable === true && (
                          <span className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                            <Check className="h-3 w-3" /> Available
                          </span>
                        )}
                        {!checkingUsername && usernameAvailable === false && (
                          <span className="flex items-center gap-1 text-xs text-destructive">Taken</span>
                        )}
                      </div>
                      <FormControl>
                        <div className="relative">
                          <Shield className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input className="pl-9 font-mono text-sm" placeholder="e.g. johndoe" {...field} />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={step2Form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel>Password <span className="text-destructive">*</span></FormLabel>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 gap-1 text-xs text-muted-foreground"
                          onClick={function() {
                            step2Form.setValue('password', generatePassword())
                          }}
                        >
                          <RefreshCw className="h-3 w-3" />
                          Regenerate
                        </Button>
                      </div>
                      <FormControl>
                        <div className="relative">
                          <Shield className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            className="pl-9 pr-10 font-mono text-sm tracking-wider"
                            type={showPassword ? 'text' : 'password'}
                            {...field}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 p-0 text-muted-foreground"
                            onClick={function() { setShowPassword(!showPassword) }}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </Button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={step2Form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role <span className="text-destructive">*</span></FormLabel>
                      <FormControl>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {roles.map(function(r) { return (
                            <button
                              key={r.value}
                              type="button"
                              onClick={function() { field.onChange(r.value) }}
                              className={'relative flex items-start gap-3 rounded-lg border p-3 text-left text-sm transition-all ' + (
                                selectedRole === r.value
                                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                  : 'border-muted hover:border-muted-foreground/30'
                              )}
                            >
                              <span className="text-lg">{r.emoji}</span>
                              <div className="min-w-0">
                                <div className="font-medium">{r.label}</div>
                                <div className="text-xs text-muted-foreground">{r.description}</div>
                              </div>
                              {selectedRole === r.value && (
                                <div className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary">
                                  <Check className="h-3 w-3 text-primary-foreground" />
                                </div>
                              )}
                            </button>
                          )})}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>
          </Form>
        )}

        {/* Step 3: Optional Details */}
        {step === 3 && (
          <Form {...step3Form}>
            <div className="space-y-5 py-2">
              <div>
                <h3 className="text-base font-semibold mb-1">Optional Details</h3>
                <p className="text-xs text-muted-foreground mb-4">
                  Add records now or skip - these can be filled later from the employee profile.
                </p>
              </div>
              <Accordion type="multiple" defaultValue={[]} className="space-y-2">
                <AccordionItem value="government" className="rounded-lg border bg-card px-1">
                  <AccordionTrigger className="px-3 py-3 hover:no-underline">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                        <FileText className="h-4 w-4 text-primary" />
                      </div>
                      <div className="text-left">
                        <div className="text-sm font-medium">Government Information</div>
                        <div className="text-xs text-muted-foreground">National ID, KRA PIN, NHIF, NSSF</div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-3 pb-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      <FormField control={step3Form.control} name="national_id" render={({ field }) => (
                        <FormItem><FormLabel>National ID</FormLabel><FormControl><Input placeholder="e.g. 12345678" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={step3Form.control} name="kra_pin" render={({ field }) => (
                        <FormItem><FormLabel>KRA PIN</FormLabel><FormControl><Input placeholder="e.g. P000123456Z" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={step3Form.control} name="nhif_number" render={({ field }) => (
                        <FormItem><FormLabel>NHIF Number</FormLabel><FormControl><Input placeholder="NHIF number" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={step3Form.control} name="nssf_number" render={({ field }) => (
                        <FormItem><FormLabel>NSSF Number</FormLabel><FormControl><Input placeholder="NSSF number" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                    </div>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="emergency" className="rounded-lg border bg-card px-1">
                  <AccordionTrigger className="px-3 py-3 hover:no-underline">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10">
                        <Phone className="h-4 w-4 text-destructive" />
                      </div>
                      <div className="text-left">
                        <div className="text-sm font-medium">Emergency Contact</div>
                        <div className="text-xs text-muted-foreground">Primary contact in case of incident</div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-3 pb-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      <FormField control={step3Form.control} name="emergency_contact_name" render={({ field }) => (
                        <FormItem><FormLabel>Contact Name</FormLabel><FormControl><Input placeholder="Full name" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={step3Form.control} name="emergency_contact_phone" render={({ field }) => (
                        <FormItem><FormLabel>Contact Phone</FormLabel><FormControl><Input placeholder="Phone number" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={step3Form.control} name="emergency_contact_relation" render={({ field }) => (
                        <FormItem><FormLabel>Relation</FormLabel><FormControl><Input placeholder="e.g. Spouse, Parent" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                    </div>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="payroll" className="rounded-lg border bg-card px-1">
                  <AccordionTrigger className="px-3 py-3 hover:no-underline">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
                        <Award className="h-4 w-4 text-amber-500" />
                      </div>
                      <div className="text-left">
                        <div className="text-sm font-medium">Payroll Details</div>
                        <div className="text-xs text-muted-foreground">Compensation, salary structure</div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-3 pb-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      <FormField control={step3Form.control} name="basic_salary" render={({ field }) => (
                        <FormItem><FormLabel>Basic Salary (KES)</FormLabel><FormControl><Input type="number" placeholder="e.g. 50000" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                      <FormField control={step3Form.control} name="allowances" render={({ field }) => (
                        <FormItem><FormLabel>Allowances (KES)</FormLabel><FormControl><Input type="number" placeholder="e.g. 10000" {...field} /></FormControl><FormMessage /></FormItem>
                      )} />
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </Form>
        )}

        {/* Success Screen */}
        {step === 'success' && credentials && (
          <div className="flex flex-col items-center py-6 text-center">
            <div className="relative mb-5">
              <div className="absolute inset-0 rounded-full bg-emerald-500/20 blur-2xl" />
              <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/30">
                <Check className="h-8 w-8 text-white" />
              </div>
            </div>
            <h2 className="text-xl font-bold">Employee Created Successfully</h2>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              The profile has been created and login credentials generated. Share them securely.
            </p>
            <div className="mt-6 w-full max-w-sm rounded-xl border bg-card p-5 text-left">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Generated Credentials</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">Temporary</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 p-3">
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Employee ID</div>
                    <div className="text-sm font-mono text-foreground truncate">{credentials.employee_id}</div>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 p-3">
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Username</div>
                    <div className="text-sm font-mono text-foreground truncate">{credentials.username}</div>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 rounded-lg bg-muted/50 p-3">
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Password</div>
                    <div className="text-sm font-mono text-foreground truncate">{credentials.password}</div>
                  </div>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t grid grid-cols-3 gap-2 text-center">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Role</div>
                  <div className="text-xs font-medium text-foreground mt-1">{credentials.role}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Department</div>
                  <div className="text-xs font-medium text-foreground mt-1">
                    {departments.find(function(d) { return d.id === step1Form.getValues('department_id') })?.name || '-'}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Hire Date</div>
                  <div className="text-xs font-medium text-foreground mt-1">{step1Form.getValues('hire_date')}</div>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2.5 mt-5">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={handleEmail}>
                <Mail className="h-4 w-4" /> Send Invite Email
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={handlePrint}>
                <FileText className="h-4 w-4" /> Print
              </Button>
              <Button size="sm" className="gap-1.5" onClick={copyAllCredentials}>
                <Shield className="h-4 w-4" /> Copy Credentials
              </Button>
            </div>
            <Button variant="ghost" size="sm" className="mt-4" onClick={function() { onOpenChange(false) }}>
              Back to Employees
            </Button>
          </div>
        )}

        {/* Footer Navigation */}
        {step !== 'success' && (
          <div className="flex items-center justify-between border-t pt-4 mt-4">
            <Button
              variant="ghost"
              onClick={goBack}
              className={step === 1 ? 'invisible' : ''}
            >
              Back
            </Button>
            <span className="text-xs text-muted-foreground">Step {step} of 3</span>
            <Button onClick={goNext} disabled={saving}>
              {saving ? 'Creating...' : step === 3 ? 'Create Employee' : 'Continue'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
