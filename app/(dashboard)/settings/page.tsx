"use client"
import { logger } from '@/lib/logger';

import { useEffect, useMemo, useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import {
  getBranchReceiptSettings,
  getBusinessSettings,
  getReceiptSettingBranches,
  updateBranchReceiptSettings,
  updateBusinessSettings,
} from "@/lib/receipt-settings"
import { getLoyaltySettings, updateLoyaltySettings } from "@/lib/modules/customers"
import type { BranchReceiptSettings, BusinessSettings } from "@/lib/receipt-settings"
import type { LoyaltySettings } from "@/lib/modules/customers"
import { AlertCircle, CheckCircle, Gift, MapPin, Printer, Shield, Bell } from "lucide-react"

interface BranchOption {
  id: string
  name: string
  code: string
}

type SaveState = "idle" | "success" | "error"

const BRANCH_OVERRIDE_FIELDS: Array<{
  key: keyof Omit<BranchReceiptSettings, "id" | "branch_id" | "created_at" | "updated_at">
  label: string
  type?: "text" | "email" | "textarea"
  placeholder: string
}> = [
  {
    key: "phone_number",
    label: "Phone Number Override",
    placeholder: "Leave blank to use the global phone number",
  },
  {
    key: "email",
    label: "Email Override",
    type: "email",
    placeholder: "Leave blank to use the global email address",
  },
  {
    key: "address",
    label: "Address Override",
    placeholder: "Leave blank to use the global business address",
  },
  {
    key: "receipt_header_text",
    label: "Branch Header Text",
    type: "textarea",
    placeholder: "Optional branch-specific line shown above receipt details",
  },
]

export default function SettingsPage() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === "admin"
  const isSuperAdmin = profile?.role === "super_admin"

  const [loading, setLoading] = useState(true)
  const [receiptForm, setReceiptForm] = useState<Partial<BusinessSettings>>({})
  const [receiptSaveState, setReceiptSaveState] = useState<SaveState>("idle")
  const [receiptMessage, setReceiptMessage] = useState("")
  const [savingReceipt, setSavingReceipt] = useState(false)

  const [branches, setBranches] = useState<BranchOption[]>([])
  const [selectedBranch, setSelectedBranch] = useState("")
  const [branchOverrides, setBranchOverrides] = useState<
    Partial<Omit<BranchReceiptSettings, "id" | "branch_id" | "created_at" | "updated_at">>
  >({})
  const [branchSaveState, setBranchSaveState] = useState<SaveState>("idle")
  const [branchMessage, setBranchMessage] = useState("")
  const [savingBranch, setSavingBranch] = useState(false)
  const [loadingBranchOverrides, setLoadingBranchOverrides] = useState(false)

  const [loyaltySettings, setLoyaltySettings] = useState<LoyaltySettings | null>(null)
  const [loyaltyForm, setLoyaltyForm] = useState<Partial<LoyaltySettings>>({})
  const [loyaltySaveState, setLoyaltySaveState] = useState<SaveState>("idle")
  const [loyaltyMessage, setLoyaltyMessage] = useState("")
  const [savingLoyalty, setSavingLoyalty] = useState(false)

  // Auto-dismiss save alerts after 5 seconds
  useEffect(() => { if (receiptSaveState !== "idle") { const t = setTimeout(() => setReceiptSaveState("idle"), 5000); return () => clearTimeout(t) } }, [receiptSaveState])
  useEffect(() => { if (branchSaveState !== "idle") { const t = setTimeout(() => setBranchSaveState("idle"), 5000); return () => clearTimeout(t) } }, [branchSaveState])
  useEffect(() => { if (loyaltySaveState !== "idle") { const t = setTimeout(() => setLoyaltySaveState("idle"), 5000); return () => clearTimeout(t) } }, [loyaltySaveState])

  useEffect(() => {
    let cancelled = false

    async function loadSettings() {
      setLoading(true)

      try {
        const [business, loyalty, branchList] = await Promise.all([
          getBusinessSettings(),
          getLoyaltySettings(),
          isAdmin ? getReceiptSettingBranches() : Promise.resolve([]),
        ])

        if (cancelled) {
          return
        }

        setReceiptForm(business || {})
        setLoyaltySettings(loyalty)
        setLoyaltyForm(loyalty || {})
        setBranches(branchList)
      } catch (error) {
        if (cancelled) {
          return
        }

        logger.error("Failed to load settings:", error)
        setReceiptSaveState("error")
        setReceiptMessage("Failed to load the current settings.")
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadSettings()

    return () => {
      cancelled = true
    }
  }, [isAdmin])

  const visibleTabs = useMemo(() => {
    const tabs: Array<{ value: string; label: string }> = [{ value: "receipts", label: "General" }]

    if (isSuperAdmin || isAdmin) {
      tabs.push({ value: "loyalty", label: "Loyalty" })
      tabs.push({ value: "security", label: "Security" })
      tabs.push({ value: "notifications", label: "Notifications" })
    }

    return tabs
  }, [isSuperAdmin, isAdmin])

  const defaultTab = visibleTabs[0]?.value || "receipts"

  const handleReceiptFieldChange = (field: keyof BusinessSettings, value: string) => {
    setReceiptForm((current) => ({
      ...current,
      [field]: value || null,
    }))
  }

  const handleSaveReceiptSettings = async () => {
    if (!profile || !isAdmin) {
      setReceiptSaveState("error")
      setReceiptMessage("Only administrators can update receipt settings.")
      return
    }

    setSavingReceipt(true)
    setReceiptSaveState("idle")

    try {
      const updated = await updateBusinessSettings(profile.role, receiptForm)
      setReceiptForm(updated)
      setReceiptSaveState("success")
      setReceiptMessage("Global receipt settings saved.")
    } catch (error) {
      setReceiptSaveState("error")
      setReceiptMessage(error instanceof Error ? error.message : "Failed to save receipt settings.")
    } finally {
      setSavingReceipt(false)
    }
  }

  const loadBranchOverrides = async (branchId: string) => {
    setSelectedBranch(branchId)
    setBranchSaveState("idle")
    setBranchMessage("")
    setLoadingBranchOverrides(true)

    try {
      const existing = await getBranchReceiptSettings(branchId)
      setBranchOverrides({
        phone_number: existing?.phone_number || "",
        email: existing?.email || "",
        address: existing?.address || "",
        receipt_header_text: existing?.receipt_header_text || "",
      })
    } catch (error) {
      logger.error("Failed to load branch overrides:", error)
      setBranchOverrides({})
      setBranchSaveState("error")
      setBranchMessage("Failed to load existing branch overrides.")
    } finally {
      setLoadingBranchOverrides(false)
    }
  }

  const handleBranchFieldChange = (
    field: keyof Omit<BranchReceiptSettings, "id" | "branch_id" | "created_at" | "updated_at">,
    value: string
  ) => {
    setBranchOverrides((current) => ({
      ...current,
      [field]: value || null,
    }))
  }

  const handleSaveBranchOverrides = async () => {
    if (!profile || !isAdmin) {
      setBranchSaveState("error")
      setBranchMessage("Only administrators can update branch overrides.")
      return
    }

    if (!selectedBranch) {
      setBranchSaveState("error")
      setBranchMessage("Select a branch before saving.")
      return
    }

    setSavingBranch(true)
    setBranchSaveState("idle")

    try {
      await updateBranchReceiptSettings(profile.role, selectedBranch, branchOverrides)
      setBranchSaveState("success")
      setBranchMessage("Branch receipt overrides saved.")
    } catch (error) {
      setBranchSaveState("error")
      setBranchMessage(error instanceof Error ? error.message : "Failed to save branch overrides.")
    } finally {
      setSavingBranch(false)
    }
  }

  const handleLoyaltyChange = (field: keyof LoyaltySettings, value: string | number | boolean) => {
    setLoyaltyForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const handleSaveLoyalty = async () => {
    if (!profile || !(isSuperAdmin || isAdmin)) {
      setLoyaltySaveState("error")
      setLoyaltyMessage("Only super admins and admins can update loyalty rules.")
      return
    }

    setSavingLoyalty(true)
    setLoyaltySaveState("idle")

    try {
      const result = await updateLoyaltySettings(loyaltyForm as Record<string, unknown>)
      if (result.success) {
        setLoyaltySettings(loyaltyForm as LoyaltySettings)
        setLoyaltyForm(loyaltyForm)
      }
      setLoyaltySaveState("success")
      setLoyaltyMessage("Loyalty settings saved.")
    } catch (error) {
      setLoyaltySaveState("error")
      setLoyaltyMessage(error instanceof Error ? error.message : "Failed to save loyalty settings.")
    } finally {
      setSavingLoyalty(false)
    }
  }

  if (loading) {
    return (
      <div role="region" aria-label="Loading settings" className="p-6 space-y-6">
        <div>
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72 mt-2" />
        </div>
        <Skeleton className="h-10 w-full max-w-md" />
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-64 mt-1" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-64 mt-1" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div role="region" aria-label="Settings" className="p-6 space-y-6 fade-in">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage business information, receipt preferences, and notification settings.
        </p>
      </div>

      {!isAdmin && !isSuperAdmin ? (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertCircle className="h-4 w-4 text-amber-700" />
          <AlertDescription className="text-amber-800">
            You do not have permission to modify settings. Contact an administrator for changes.
          </AlertDescription>
        </Alert>
      ) : (
        <Tabs defaultValue={defaultTab} className="space-y-6">
          <TabsList className={`grid w-full ${visibleTabs.length === 2 ? "grid-cols-2" : visibleTabs.length === 4 ? "grid-cols-4" : "grid-cols-1"}`}>
            {visibleTabs.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="receipts" className="space-y-6">
            {!isAdmin && (
              <Alert className="border-blue-200 bg-blue-50">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800">
                  Receipt settings are visible here, but only administrators can save changes.
                </AlertDescription>
              </Alert>
            )}

            <Card role="region" aria-label="Global receipt settings">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Printer className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle>Global Receipt Details</CardTitle>
                    <CardDescription>
                      These values are printed unless a branch-specific override exists.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {receiptSaveState !== "idle" && (
                  <Alert className={receiptSaveState === "success" ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
                    {receiptSaveState === "success" ? (
                      <CheckCircle className="h-4 w-4 text-green-600" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-red-600" />
                    )}
                    <AlertDescription className={receiptSaveState === "success" ? "text-green-800" : "text-red-800"}>
                      {receiptMessage}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="business_name">Business Name</Label>
                    <Input
                      id="business_name"
                      value={receiptForm.business_name || ""}
                      onChange={(event) => handleReceiptFieldChange("business_name", event.target.value)}
                      disabled={!isAdmin}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone_number">Phone Number</Label>
                    <Input
                      id="phone_number"
                      value={receiptForm.phone_number || ""}
                      onChange={(event) => handleReceiptFieldChange("phone_number", event.target.value)}
                      disabled={!isAdmin}
                    />
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={receiptForm.email || ""}
                      onChange={(event) => handleReceiptFieldChange("email", event.target.value)}
                      disabled={!isAdmin}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tax_pin">Tax PIN</Label>
                    <Input
                      id="tax_pin"
                      value={receiptForm.tax_pin || ""}
                      onChange={(event) => handleReceiptFieldChange("tax_pin", event.target.value)}
                      disabled={!isAdmin}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input
                    id="address"
                    value={receiptForm.address || ""}
                    onChange={(event) => handleReceiptFieldChange("address", event.target.value)}
                    disabled={!isAdmin}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="business_pin">Business PIN</Label>
                  <Input
                    id="business_pin"
                    value={receiptForm.business_pin || ""}
                    onChange={(event) => handleReceiptFieldChange("business_pin", event.target.value)}
                    disabled={!isAdmin}
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="receipt_footer_text">Receipt Footer</Label>
                  <Textarea
                    id="receipt_footer_text"
                    value={receiptForm.receipt_footer_text || ""}
                    onChange={(event) => handleReceiptFieldChange("receipt_footer_text", event.target.value)}
                    disabled={!isAdmin}
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="thank_you_message">Thank You Message</Label>
                  <Textarea
                    id="thank_you_message"
                    value={receiptForm.thank_you_message || ""}
                    onChange={(event) => handleReceiptFieldChange("thank_you_message", event.target.value)}
                    disabled={!isAdmin}
                    rows={2}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="return_policy_text">Return Policy</Label>
                  <Textarea
                    id="return_policy_text"
                    value={receiptForm.return_policy_text || ""}
                    onChange={(event) => handleReceiptFieldChange("return_policy_text", event.target.value)}
                    disabled={!isAdmin}
                    rows={2}
                  />
                </div>

                {isAdmin && (
                  <div className="flex justify-end">
                    <Button onClick={handleSaveReceiptSettings} disabled={savingReceipt}>
                      {savingReceipt ? "Saving..." : "Save Global Settings"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {isAdmin && (
              <Card role="region" aria-label="Branch receipt overrides">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <MapPin className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle>Branch Receipt Overrides</CardTitle>
                      <CardDescription>
                        Override selected receipt fields for a specific branch.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {branchSaveState !== "idle" && (
                    <Alert className={branchSaveState === "success" ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
                      {branchSaveState === "success" ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-red-600" />
                      )}
                      <AlertDescription className={branchSaveState === "success" ? "text-green-800" : "text-red-800"}>
                        {branchMessage}
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="branch_select">Branch</Label>
                    <Select value={selectedBranch} onValueChange={loadBranchOverrides}>
                      <SelectTrigger id="branch_select">
                        <SelectValue placeholder={branches.length === 0 ? "No branches available" : "Select a branch"} />
                      </SelectTrigger>
                      <SelectContent>
                        {branches.map((branch) => (
                          <SelectItem key={branch.id} value={branch.id}>
                            {branch.name} ({branch.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {branches.length === 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        No branches found. Visit the admin panel to create branches first.
                      </p>
                    )}
                  </div>

                  {selectedBranch && (
                    <>
                      <Alert className="border-blue-200 bg-blue-50">
                        <AlertCircle className="h-4 w-4 text-blue-600" />
                        <AlertDescription className="text-blue-800">
                          Leave a field blank to fall back to the global receipt setting.
                        </AlertDescription>
                      </Alert>

                      {loadingBranchOverrides ? (
                        <div className="grid gap-4 md:grid-cols-2">
                          {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="space-y-2">
                              <Skeleton className="h-4 w-24" />
                              <Skeleton className="h-10 w-full" />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="grid gap-4 md:grid-cols-2">
                          {BRANCH_OVERRIDE_FIELDS.map((field) => {
                            const value = (branchOverrides[field.key] as string | null | undefined) || ""

                            if (field.type === "textarea") {
                              return (
                                <div key={field.key} className="space-y-2 md:col-span-2">
                                  <Label htmlFor={field.key}>{field.label}</Label>
                                  <Textarea
                                    id={field.key}
                                    value={value}
                                    onChange={(event) => handleBranchFieldChange(field.key, event.target.value)}
                                    placeholder={field.placeholder}
                                    rows={2}
                                  />
                                </div>
                              )
                            }

                            return (
                              <div key={field.key} className="space-y-2">
                                <Label htmlFor={field.key}>{field.label}</Label>
                                <Input
                                  id={field.key}
                                  type={field.type || "text"}
                                  value={value}
                                  onChange={(event) => handleBranchFieldChange(field.key, event.target.value)}
                                  placeholder={field.placeholder}
                                />
                              </div>
                            )
                          })}
                        </div>
                      )}

                      <div className="flex justify-end">
                        <Button onClick={handleSaveBranchOverrides} disabled={savingBranch || loadingBranchOverrides}>
                          {savingBranch ? "Saving..." : "Save Branch Overrides"}
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {(isSuperAdmin || isAdmin) && (
            <TabsContent value="security" className="space-y-6">
              <Card role="region" aria-label="Security settings">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Shield className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle>Security</CardTitle>
                      <CardDescription>
                        Account security and session information.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Account Status</p>
                        <p className="text-sm text-muted-foreground">Your current account status</p>
                      </div>
                      <Badge variant="secondary">Active</Badge>
                    </div>
                  </div>
                  <div className="rounded-lg border p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Role</p>
                        <p className="text-sm text-muted-foreground">Your access level</p>
                      </div>
                      <Badge variant="outline" className="capitalize">
                        {profile?.role?.replace("_", " ") || "N/A"}
                      </Badge>
                    </div>
                  </div>
                  <div className="rounded-lg border p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Email</p>
                        <p className="text-sm text-muted-foreground">Registered email address</p>
                      </div>
                      <span className="text-sm">{profile?.email || "N/A"}</span>
                    </div>
                  </div>
                  <div className="rounded-lg border p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Assigned Branch</p>
                        <p className="text-sm text-muted-foreground">Your default branch</p>
                      </div>
                      <span className="text-sm">
                        {profile?.branch?.name || profile?.branch_id ? `Branch ID: ${profile.branch_id?.slice(0, 8)}` : "Not assigned"}
                      </span>
                    </div>
                  </div>
                  <div className="rounded-lg border p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">Last Login</p>
                        <p className="text-sm text-muted-foreground">Most recent login time</p>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        Current session
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Security settings are managed by your system administrator.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {(isSuperAdmin || isAdmin) && (
            <TabsContent value="notifications" className="space-y-6">
              <Card role="region" aria-label="Notification settings">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Bell className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle>Notifications</CardTitle>
                      <CardDescription>
                        Configure how you receive system notifications.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Email Notifications</h3>
                    <div className="flex items-center justify-between rounded-lg border p-4">
                      <div>
                        <p className="font-medium">Low Stock Alerts</p>
                        <p className="text-sm text-muted-foreground">Receive email when products are below reorder level.</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-4 mt-2">
                      <div>
                        <p className="font-medium">Daily Sales Summary</p>
                        <p className="text-sm text-muted-foreground">End-of-day sales report via email.</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-4 mt-2">
                      <div>
                        <p className="font-medium">New User Registration</p>
                        <p className="text-sm text-muted-foreground">Notify when a new user is created.</p>
                      </div>
                      <Switch />
                    </div>
                  </div>
                  <Separator />
                  <div>
                    <h3 className="text-lg font-semibold mb-4">SMS Notifications</h3>
                    <div className="flex items-center justify-between rounded-lg border p-4">
                      <div>
                        <p className="font-medium">Low Stock Alerts</p>
                        <p className="text-sm text-muted-foreground">Receive SMS when stock runs low.</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-4 mt-2">
                      <div>
                        <p className="font-medium">Shift Reminders</p>
                        <p className="text-sm text-muted-foreground">Remind cashiers to open and close shifts.</p>
                      </div>
                      <Switch defaultChecked />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-4 mt-2">
                      <div>
                        <p className="font-medium">Transfer Notifications</p>
                        <p className="text-sm text-muted-foreground">Notify on stock transfer requests.</p>
                      </div>
                      <Switch />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Notification channels are configured in the system settings.
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          {(isSuperAdmin || isAdmin) && (
            <TabsContent value="loyalty" className="space-y-6">
              <Card role="region" aria-label="Loyalty rules">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Gift className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle>Loyalty Rules</CardTitle>
                      <CardDescription>
                        Configure how customers earn and redeem loyalty points.
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {loyaltySaveState !== "idle" && (
                    <Alert className={loyaltySaveState === "success" ? "border-green-200 bg-green-50" : "border-red-200 bg-red-50"}>
                      {loyaltySaveState === "success" ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-red-600" />
                      )}
                      <AlertDescription className={loyaltySaveState === "success" ? "text-green-800" : "text-red-800"}>
                        {loyaltyMessage}
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* General */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4">General</h3>
                    <div className="flex items-center justify-between rounded-lg border p-4">
                      <div>
                        <p className="font-medium">Enable Loyalty Earning</p>
                        <p className="text-sm text-muted-foreground">Customers can earn points from eligible sales.</p>
                      </div>
                      <Switch
                        checked={loyaltyForm.earn_enabled ?? true}
                        onCheckedChange={(value) => handleLoyaltyChange("earn_enabled", value)}
                        disabled={savingLoyalty}
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-4 mt-2">
                      <div>
                        <p className="font-medium">Enable Loyalty Redemption</p>
                        <p className="text-sm text-muted-foreground">Customers can spend saved points at checkout.</p>
                      </div>
                      <Switch
                        checked={loyaltyForm.redeem_enabled ?? false}
                        onCheckedChange={(value) => handleLoyaltyChange("redeem_enabled", value)}
                        disabled={savingLoyalty}
                      />
                    </div>
                  </div>

                  <Separator />

                  {/* Earning Rules */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Earning Rules</h3>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="earn_threshold_cents">Spend per Point (cents)</Label>
                        <Input
                          id="earn_threshold_cents"
                          type="number"
                          min="100"
                          value={loyaltyForm.earn_threshold_cents ?? 15000}
                          onChange={(event) => handleLoyaltyChange("earn_threshold_cents", parseInt(event.target.value || "0", 10))}
                          disabled={savingLoyalty}
                        />
                        <p className="text-xs text-muted-foreground">
                          = {((loyaltyForm.earn_threshold_cents ?? 15000) / 100).toFixed(0)} KSh per point
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="earn_minimum_basket_cents">Minimum Basket to Earn (cents)</Label>
                        <Input
                          id="earn_minimum_basket_cents"
                          type="number"
                          min="0"
                          value={loyaltyForm.earn_minimum_basket_cents ?? 15000}
                          onChange={(event) => handleLoyaltyChange("earn_minimum_basket_cents", parseInt(event.target.value || "0", 10))}
                          disabled={savingLoyalty}
                        />
                        <p className="text-xs text-muted-foreground">
                          = {((loyaltyForm.earn_minimum_basket_cents ?? 15000) / 100).toFixed(0)} KSh minimum basket
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-4 mt-4">
                      <div>
                        <p className="font-medium">Allow Earning on Discounted Sales</p>
                        <p className="text-sm text-muted-foreground">Keep loyalty accrual active even when a discount is applied.</p>
                      </div>
                      <Switch
                        checked={loyaltyForm.earn_on_discounted ?? true}
                        onCheckedChange={(value) => handleLoyaltyChange("earn_on_discounted", value)}
                        disabled={savingLoyalty}
                      />
                    </div>
                  </div>

                  <Separator />

                  {/* Point Value */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Point Value</h3>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="point_value_cents">Point Value (cents)</Label>
                        <Input
                          id="point_value_cents"
                          type="number"
                          min="1"
                          value={loyaltyForm.point_value_cents ?? 50}
                          onChange={(event) => handleLoyaltyChange("point_value_cents", parseInt(event.target.value || "0", 10))}
                          disabled={savingLoyalty}
                        />
                        <p className="text-xs text-muted-foreground">
                          = {(loyaltyForm.point_value_cents ?? 50) / 100} KSh per point
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="redeem_value_cents">Redeem Value (cents)</Label>
                        <Input
                          id="redeem_value_cents"
                          type="number"
                          min="1"
                          value={loyaltyForm.redeem_value_cents ?? 50}
                          onChange={(event) => handleLoyaltyChange("redeem_value_cents", parseInt(event.target.value || "0", 10))}
                          disabled={savingLoyalty}
                        />
                        <p className="text-xs text-muted-foreground">
                          = {(loyaltyForm.redeem_value_cents ?? 50) / 100} KSh per point redeemed
                        </p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Redemption Rules */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Redemption Rules</h3>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="redeem_minimum_points">Minimum Points to Redeem</Label>
                        <Input
                          id="redeem_minimum_points"
                          type="number"
                          min="0"
                          value={loyaltyForm.redeem_minimum_points ?? 25}
                          onChange={(event) => handleLoyaltyChange("redeem_minimum_points", parseInt(event.target.value || "0", 10))}
                          disabled={savingLoyalty}
                        />
                        <p className="text-xs text-muted-foreground">
                          = {((loyaltyForm.redeem_minimum_points ?? 25) * ((loyaltyForm.redeem_value_cents ?? 50) / 100)).toFixed(2)} KSh minimum
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="redeem_max_percent_per_sale">Max Discount per Sale (%)</Label>
                        <Input
                          id="redeem_max_percent_per_sale"
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          value={loyaltyForm.redeem_max_percent_per_sale ?? 20}
                          onChange={(event) => handleLoyaltyChange("redeem_max_percent_per_sale", parseFloat(event.target.value || "0"))}
                          disabled={savingLoyalty}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="redeem_minimum_basket_cents">Minimum Basket to Redeem (cents)</Label>
                        <Input
                          id="redeem_minimum_basket_cents"
                          type="number"
                          min="0"
                          value={loyaltyForm.redeem_minimum_basket_cents ?? 0}
                          onChange={(event) => handleLoyaltyChange("redeem_minimum_basket_cents", parseInt(event.target.value || "0", 10))}
                          disabled={savingLoyalty}
                        />
                        <p className="text-xs text-muted-foreground">
                          = {((loyaltyForm.redeem_minimum_basket_cents ?? 0) / 100).toFixed(0)} KSh minimum basket
                        </p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Multipliers */}
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold">Multipliers</h3>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Enable Tiers</span>
                        <Switch
                          checked={loyaltyForm.enable_tiers ?? true}
                          onCheckedChange={(value) => handleLoyaltyChange("enable_tiers", value)}
                          disabled={savingLoyalty}
                        />
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">
                      Tier-based point multipliers applied automatically at checkout.
                    </p>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="tier_bronze_multiplier">Bronze Multiplier</Label>
                        <Input
                          id="tier_bronze_multiplier"
                          type="number"
                          min="0.5"
                          step="0.25"
                          value={loyaltyForm.tier_bronze_multiplier ?? 1.0}
                          onChange={(event) => handleLoyaltyChange("tier_bronze_multiplier", parseFloat(event.target.value || "1"))}
                          disabled={savingLoyalty || !(loyaltyForm.enable_tiers ?? true)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="tier_silver_multiplier">Silver Multiplier</Label>
                        <Input
                          id="tier_silver_multiplier"
                          type="number"
                          min="0.5"
                          step="0.25"
                          value={loyaltyForm.tier_silver_multiplier ?? 1.25}
                          onChange={(event) => handleLoyaltyChange("tier_silver_multiplier", parseFloat(event.target.value || "1"))}
                          disabled={savingLoyalty || !(loyaltyForm.enable_tiers ?? true)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="tier_gold_multiplier">Gold Multiplier</Label>
                        <Input
                          id="tier_gold_multiplier"
                          type="number"
                          min="0.5"
                          step="0.25"
                          value={loyaltyForm.tier_gold_multiplier ?? 1.5}
                          onChange={(event) => handleLoyaltyChange("tier_gold_multiplier", parseFloat(event.target.value || "1"))}
                          disabled={savingLoyalty || !(loyaltyForm.enable_tiers ?? true)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="tier_platinum_multiplier">Platinum Multiplier</Label>
                        <Input
                          id="tier_platinum_multiplier"
                          type="number"
                          min="0.5"
                          step="0.25"
                          value={loyaltyForm.tier_platinum_multiplier ?? 2.0}
                          onChange={(event) => handleLoyaltyChange("tier_platinum_multiplier", parseFloat(event.target.value || "1"))}
                          disabled={savingLoyalty || !(loyaltyForm.enable_tiers ?? true)}
                        />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Bonuses */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Bonuses</h3>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="holiday_multiplier">Holiday Multiplier</Label>
                        <Input
                          id="holiday_multiplier"
                          type="number"
                          min="1"
                          step="0.5"
                          value={loyaltyForm.holiday_multiplier ?? 2.0}
                          onChange={(event) => handleLoyaltyChange("holiday_multiplier", parseFloat(event.target.value || "1"))}
                          disabled={savingLoyalty}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="birthday_multiplier">Birthday Multiplier</Label>
                        <Input
                          id="birthday_multiplier"
                          type="number"
                          min="1"
                          step="0.5"
                          value={loyaltyForm.birthday_multiplier ?? 3.0}
                          onChange={(event) => handleLoyaltyChange("birthday_multiplier", parseFloat(event.target.value || "1"))}
                          disabled={savingLoyalty}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="weekend_multiplier">Weekend Multiplier</Label>
                        <Input
                          id="weekend_multiplier"
                          type="number"
                          min="1"
                          step="0.5"
                          value={loyaltyForm.weekend_multiplier ?? 1.5}
                          onChange={(event) => handleLoyaltyChange("weekend_multiplier", parseFloat(event.target.value || "1"))}
                          disabled={savingLoyalty}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="campaign_multiplier">Campaign Multiplier</Label>
                        <Input
                          id="campaign_multiplier"
                          type="number"
                          min="1"
                          step="0.5"
                          value={loyaltyForm.campaign_multiplier ?? 2.0}
                          onChange={(event) => handleLoyaltyChange("campaign_multiplier", parseFloat(event.target.value || "1"))}
                          disabled={savingLoyalty}
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-4 mt-4">
                      <div>
                        <p className="font-medium">Enable Birthday Bonus</p>
                        <p className="text-sm text-muted-foreground">Apply birthday multiplier on the customer&apos;s birthday.</p>
                      </div>
                      <Switch
                        checked={loyaltyForm.enable_birthday_bonus ?? true}
                        onCheckedChange={(value) => handleLoyaltyChange("enable_birthday_bonus", value)}
                        disabled={savingLoyalty}
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-4 mt-2">
                      <div>
                        <p className="font-medium">Enable Holiday Bonus</p>
                        <p className="text-sm text-muted-foreground">Apply holiday multiplier on public holidays.</p>
                      </div>
                      <Switch
                        checked={loyaltyForm.enable_holiday_bonus ?? true}
                        onCheckedChange={(value) => handleLoyaltyChange("enable_holiday_bonus", value)}
                        disabled={savingLoyalty}
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-4 mt-2">
                      <div>
                        <p className="font-medium">Enable Weekend Bonus</p>
                        <p className="text-sm text-muted-foreground">Apply weekend multiplier on Saturdays and Sundays.</p>
                      </div>
                      <Switch
                        checked={loyaltyForm.enable_weekend_bonus ?? true}
                        onCheckedChange={(value) => handleLoyaltyChange("enable_weekend_bonus", value)}
                        disabled={savingLoyalty}
                      />
                    </div>
                  </div>

                  <Separator />

                  {/* Advanced */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Advanced</h3>
                    <div className="flex items-center justify-between rounded-lg border p-4">
                      <div>
                        <p className="font-medium">Enable Points Expiry</p>
                        <p className="text-sm text-muted-foreground">Automatically expire points after the configured period.</p>
                      </div>
                      <Switch
                        checked={loyaltyForm.expiry_enabled ?? false}
                        onCheckedChange={(value) => handleLoyaltyChange("expiry_enabled", value)}
                        disabled={savingLoyalty}
                      />
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 mt-4">
                      <div className="space-y-2">
                        <Label htmlFor="expiry_days">Points Expiry (days)</Label>
                        <Input
                          id="expiry_days"
                          type="number"
                          min="0"
                          value={loyaltyForm.expiry_days ?? 365}
                          onChange={(event) => handleLoyaltyChange("expiry_days", parseInt(event.target.value || "0", 10))}
                          disabled={savingLoyalty}
                        />
                        <p className="text-xs text-muted-foreground">Points expire after this many days (0 = never).</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        if (window.confirm("Reset all unsaved loyalty settings changes?")) {
                          setLoyaltyForm(loyaltySettings || {})
                          setLoyaltySaveState("idle")
                          setLoyaltyMessage("")
                        }
                      }}
                      disabled={savingLoyalty}
                    >
                      Reset
                    </Button>
                    <Button onClick={handleSaveLoyalty} disabled={savingLoyalty}>
                      {savingLoyalty ? "Saving..." : "Save Loyalty Settings"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      )}
    </div>
  )
}
