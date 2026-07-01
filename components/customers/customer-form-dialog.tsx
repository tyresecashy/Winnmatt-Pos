"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/use-toast"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { AlertTriangle, Loader2 } from "lucide-react"
import { createCustomer, updateCustomer } from "@/lib/customers-actions"

interface CustomerFormDialogProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  customer?: {
    id: string
    name: string
    phone?: string
    email?: string
    type: string
    credit_limit: number
  }
  onSaveSuccess: () => void
}

interface DuplicateCustomerMatch {
  id: string
  name: string
  phone?: string | null
  email?: string | null
}

interface CustomerSaveResult {
  success: boolean
  error?: string
  message?: string
  duplicateFields?: Array<'phone' | 'email'>
  duplicateMatches?: DuplicateCustomerMatch[]
}

function getCustomerIdSuffix(id: string) {
  return id.slice(-6).toUpperCase()
}

function hasDuplicateWarning(result: CustomerSaveResult): boolean {
  return !!result.duplicateMatches?.length
}

export function CustomerFormDialog({
  isOpen,
  onOpenChange,
  customer,
  onSaveSuccess,
}: CustomerFormDialogProps) {
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [email, setEmail] = useState("")
  const [type, setType] = useState<"retail" | "wholesale" | "business">("retail")
  const [creditLimit, setCreditLimit] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [duplicateWarning, setDuplicateWarning] = useState<{
    fields: Array<'phone' | 'email'>
    matches: DuplicateCustomerMatch[]
    message: string
  } | null>(null)

  useEffect(() => {
    if (customer) {
      setName(customer.name)
      setPhone(customer.phone || "")
      setEmail(customer.email || "")
      setType(customer.type as any)
      setCreditLimit(customer.credit_limit || 0)
    } else {
      // Reset for new customer
      setName("")
      setPhone("")
      setEmail("")
      setType("retail")
      setCreditLimit(0)
    }
    setDuplicateWarning(null)
  }, [customer, isOpen])

  const handleSave = async () => {
    if (!name.trim()) {
      toast({
        title: "Validation Error",
        description: "Customer name is required",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    try {
      let result: CustomerSaveResult

      if (customer) {
        // Update existing customer
        result = await updateCustomer(customer.id, {
          name,
          phone,
          email,
          type,
          credit_limit: creditLimit,
        })
      } else {
        // Create new customer
        result = await createCustomer(name, type, phone, email, creditLimit)
      }

      if (!result.success) {
        if (!customer && hasDuplicateWarning(result)) {
          setDuplicateWarning({
            fields: result.duplicateFields || [],
            matches: result.duplicateMatches || [],
            message: result.error || "Possible duplicate customer found",
          })
        }
        throw new Error(result.error || "Failed to save customer")
      }

      setDuplicateWarning(null)

      toast({
        title: "Success",
        description: result.message || `Customer ${customer ? "updated" : "created"} successfully`,
        variant: "default",
      })

      onOpenChange(false)
      onSaveSuccess()
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save customer",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>{customer ? "Edit Customer" : "Add New Customer"}</DialogTitle>
          <DialogDescription>
            {customer ? "Update customer information" : "Create a new customer record"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Customer Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (duplicateWarning) setDuplicateWarning(null)
              }}
              placeholder="e.g., John Kamau"
              disabled={isLoading}
              autoFocus
            />
          </div>

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value)
                if (duplicateWarning) setDuplicateWarning(null)
              }}
              placeholder="e.g., 0722123456"
              disabled={isLoading}
            />
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                if (duplicateWarning) setDuplicateWarning(null)
              }}
              placeholder="e.g., john@example.com"
              disabled={isLoading}
            />
          </div>

          {!customer && duplicateWarning ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Possible duplicate customer</AlertTitle>
              <AlertDescription>
                <p>{duplicateWarning.message}</p>
                <p>
                  Duplicate check currently uses {duplicateWarning.fields.join(" and ") || "phone or email"}.
                </p>
                {duplicateWarning.matches.map((match) => (
                  <p key={match.id}>
                    {match.name} - {match.phone || match.email || `ID ${getCustomerIdSuffix(match.id)}`}
                  </p>
                ))}
              </AlertDescription>
            </Alert>
          ) : null}

          {/* Type */}
          <div className="space-y-2">
            <Label htmlFor="type">Customer Type *</Label>
            <Select value={type} onValueChange={(value: any) => setType(value)}>
              <SelectTrigger id="type" disabled={isLoading}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="retail">Retail (Walk-in)</SelectItem>
                <SelectItem value="wholesale">Wholesale</SelectItem>
                <SelectItem value="business">Business Account</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Credit Limit */}
          <div className="space-y-2">
            <Label htmlFor="creditLimit">Credit Limit (KShs)</Label>
            <Input
              id="creditLimit"
              type="number"
              min="0"
              value={creditLimit}
              onChange={(e) => setCreditLimit(parseInt(e.target.value) || 0)}
              placeholder="e.g., 50000"
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              Maximum amount customer can owe (0 = no credit)
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading || !name.trim()}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              customer ? "Update Customer" : "Add Customer"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
