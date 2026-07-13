'use client'

import { useState, useEffect, startTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from '@/hooks/use-toast'
import { updateCustomer } from '@/lib/modules/customers'

interface CustomerEditForm {
  name: string
  phone: string
  email: string
  type: 'retail' | 'wholesale' | 'business'
  tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'vip'
  credit_limit: string
  birthday: string
  notes: string
  tags: string
  sms_opt_in: boolean
  email_opt_in: boolean
}

interface EditCustomerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  customer: {
    id: string
    name: string
    phone: string | null
    email: string | null
    type: string
    tier: string | null
    credit_limit: number
    birthday: string | null
    notes: string | null
    tags: string[]
  } | null
  onSuccess: () => void
}

export function EditCustomerDialog({ open, onOpenChange, customer, onSuccess }: EditCustomerDialogProps) {
  const [form, setForm] = useState<CustomerEditForm>({
    name: '',
    phone: '',
    email: '',
    type: 'retail',
    tier: 'bronze',
    credit_limit: '0',
    birthday: '',
    notes: '',
    tags: '',
    sms_opt_in: true,
    email_opt_in: true,
  })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    startTransition(() => {
      if (customer && open) {
        setForm({
          name: customer.name || '',
          phone: customer.phone || '',
          email: customer.email || '',
          type: (customer.type as CustomerEditForm['type']) || 'retail',
          tier: (customer.tier as CustomerEditForm['tier']) || 'bronze',
          credit_limit: String(customer.credit_limit || 0),
          birthday: customer.birthday ? customer.birthday.split('T')[0] : '',
          notes: customer.notes || '',
          tags: (customer.tags || []).join(', '),
          sms_opt_in: true,
          email_opt_in: true,
        })
      }
    })
  }, [customer, open])

  async function handleSubmit() {
    if (!customer) return
    if (!form.name.trim()) {
      toast({ title: 'Error', description: 'Name is required', variant: 'destructive' })
      return
    }

    setSubmitting(true)
    try {
      const tags = form.tags
        .split(',')
        .map(t => t.trim())
        .filter(Boolean)

      const result = await updateCustomer(customer.id, {
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        type: form.type,
        tier: form.tier,
        credit_limit: parseInt(form.credit_limit) || 0,
        birthday: form.birthday || null,
        notes: form.notes || null,
        tags,
      })

      if (result.success) {
        toast({ title: 'Updated', description: 'Customer updated successfully' })
        onSuccess()
        onOpenChange(false)
      } else {
        toast({ title: 'Error', description: result.error || 'Failed to update customer', variant: 'destructive' })
      }
    } catch (error) {
      toast({ title: 'Error', description: error instanceof Error ? error.message : 'Failed to update customer', variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Customer</DialogTitle>
          <DialogDescription>Update customer information and preferences</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">
          {/* Basic Info */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">Basic Information</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Full Name *</Label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
              </div>
            </div>
          </div>

          <hr />

          {/* Classification */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">Classification</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Customer Type</Label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as CustomerEditForm['type'] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="retail">Retail</SelectItem>
                    <SelectItem value="wholesale">Wholesale</SelectItem>
                    <SelectItem value="business">Business</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Loyalty Tier</Label>
                <Select value={form.tier} onValueChange={v => setForm(f => ({ ...f, tier: v as CustomerEditForm['tier'] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bronze">Bronze</SelectItem>
                    <SelectItem value="silver">Silver</SelectItem>
                    <SelectItem value="gold">Gold</SelectItem>
                    <SelectItem value="platinum">Platinum</SelectItem>
                    <SelectItem value="vip">VIP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <hr />

          {/* Financial */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">Financial</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Credit Limit (KSh)</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.credit_limit}
                  onChange={e => setForm(f => ({ ...f, credit_limit: e.target.value }))}
                />
              </div>
              <div>
                <Label>Birthday</Label>
                <Input type="date" value={form.birthday} onChange={e => setForm(f => ({ ...f, birthday: e.target.value }))} />
              </div>
            </div>
          </div>

          <hr />

          {/* Notes & Tags */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">Notes & Tags</h3>
            <div>
              <Label>Tags (comma-separated)</Label>
              <Input
                value={form.tags}
                onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                placeholder="vip, high-value, wholesale"
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                rows={3}
                placeholder="Internal notes about this customer..."
              />
            </div>
          </div>

          <hr />

          {/* Preferences */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">Contact Preferences</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-normal">SMS Notifications</Label>
                  <p className="text-xs text-muted-foreground">Receive promotions and updates via SMS</p>
                </div>
                <Switch
                  checked={form.sms_opt_in}
                  onCheckedChange={v => setForm(f => ({ ...f, sms_opt_in: v }))}
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-normal">Email Notifications</Label>
                  <p className="text-xs text-muted-foreground">Receive promotions and updates via email</p>
                </div>
                <Switch
                  checked={form.email_opt_in}
                  onCheckedChange={v => setForm(f => ({ ...f, email_opt_in: v }))}
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
