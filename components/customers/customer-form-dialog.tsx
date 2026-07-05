"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
import { AlertTriangle, Loader2, X, Check } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { createCustomer, updateCustomer } from "@/lib/customers-actions"
import { getSegments, getCustomerSegments, setCustomerSegments, assignCustomerToSegment } from "@/lib/segment-actions"
import type { Segment } from "@/lib/segment-actions"

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
    tier?: string
    birthday?: string | null
    notes?: string | null
    tags?: string[]
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

const customerTiers = ["bronze", "silver", "gold", "platinum", "vip"] as const

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
  const [tier, setTier] = useState<string>("bronze")
  const [birthday, setBirthday] = useState("")
  const [notes, setNotes] = useState("")
  const [tagInput, setTagInput] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [duplicateWarning, setDuplicateWarning] = useState<{
    fields: Array<'phone' | 'email'>
    matches: DuplicateCustomerMatch[]
    message: string
  } | null>(null)
  const [allSegments, setAllSegments] = useState<Segment[]>([])
  const [selectedSegmentIds, setSelectedSegmentIds] = useState<string[]>([])

  useEffect(() => {
    const timer = setTimeout(() => {
      // Load segments list
      void getSegments().then((segs) => setAllSegments(segs))

      if (customer) {
        setName(customer.name)
        setPhone(customer.phone || "")
        setEmail(customer.email || "")
        setType(customer.type as "retail" | "wholesale" | "business")
        setCreditLimit(customer.credit_limit || 0)
        setTier(customer.tier || "bronze")
        setBirthday(customer.birthday ? customer.birthday.split("T")[0] : "")
        setNotes(customer.notes || "")
        setTags(customer.tags || [])

        // Load customer's existing segments
        getCustomerSegments(customer.id).then((segs) =>
          setSelectedSegmentIds(segs.map((s) => s.id))
        )
      } else {
        setName("")
        setPhone("")
        setEmail("")
        setType("retail")
        setCreditLimit(0)
        setTier("bronze")
        setBirthday("")
        setNotes("")
        setTags([])
        setSelectedSegmentIds([])
      }
      setTagInput("")
      setDuplicateWarning(null)
    })
    return () => clearTimeout(timer)
  }, [customer, isOpen])

  const addTag = () => {
    const trimmed = tagInput.trim().toLowerCase()
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed])
    }
    setTagInput("")
  }

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag))
  }

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault()
      addTag()
    }
  }

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
          tier: tier as "bronze" | "silver" | "gold" | "platinum" | "vip",
          birthday: birthday || null,
          notes: notes || null,
          tags,
        })
      } else {
        // Create new customer
        result = await createCustomer(name, type, phone, email, creditLimit, {
          tier: tier as "bronze" | "silver" | "gold" | "platinum" | "vip",
          birthday: birthday || null,
          notes: notes || null,
          tags,
        })
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

      // Save segment assignments
      const savedCustomerId = customer ? customer.id : (result as any).customer?.id
      if (savedCustomerId && selectedSegmentIds.length > 0) {
        if (customer) {
          // Replace all segments for existing customer
          await setCustomerSegments(savedCustomerId, selectedSegmentIds)
        } else {
          // Assign segments for new customer
          for (const segId of selectedSegmentIds) {
            await assignCustomerToSegment(savedCustomerId, segId)
          }
        }
      }

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
      <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
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
            <Select value={type} onValueChange={(value: string) => setType(value as "retail" | "wholesale" | "business")}>
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

          {/* Tier */}
          <div className="space-y-2">
            <Label htmlFor="tier">Tier</Label>
            <Select value={tier} onValueChange={setTier} disabled={isLoading}>
              <SelectTrigger id="tier">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {customerTiers.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Birthday */}
          <div className="space-y-2">
            <Label htmlFor="birthday">Birthday</Label>
            <Input
              id="birthday"
              type="date"
              value={birthday}
              onChange={(e) => setBirthday(e.target.value)}
              disabled={isLoading}
            />
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <Label htmlFor="tags">Tags</Label>
            <div className="flex gap-2">
              <Input
                id="tags"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder="Add a tag and press Enter..."
                disabled={isLoading}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addTag}
                disabled={isLoading || !tagInput.trim()}
              >
                Add
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1">
                {tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1">
                    {tag}
                    <button
                      onClick={() => removeTag(tag)}
                      className="hover:text-destructive ml-0.5"
                      disabled={isLoading}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Segments */}
          <div className="space-y-2">
            <Label>Segments</Label>
            <div className="flex flex-wrap gap-1.5 min-h-[36px] p-2 border rounded-md">
              {selectedSegmentIds.length === 0 && (
                <span className="text-xs text-muted-foreground">No segments selected</span>
              )}
              {allSegments.map((seg) => {
                const isSelected = selectedSegmentIds.includes(seg.id)
                return (
                  <button
                    key={seg.id}
                    type="button"
                    onClick={() => {
                      setSelectedSegmentIds((prev) =>
                        isSelected ? prev.filter((id) => id !== seg.id) : [...prev, seg.id]
                      )
                    }}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border transition-all hover:opacity-80"
                    style={{
                      backgroundColor: isSelected ? seg.color + '20' : 'transparent',
                      borderColor: isSelected ? seg.color : 'var(--border)',
                      color: isSelected ? seg.color : 'var(--muted-foreground)',
                    }}
                  >
                    {isSelected && <Check className="h-3 w-3" />}
                    {seg.name}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal notes about this customer..."
              disabled={isLoading}
              rows={3}
            />
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
