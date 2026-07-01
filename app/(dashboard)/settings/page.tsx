"use client"

import { useEffect, useMemo, useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { Alert, AlertDescription } from "@/components/ui/alert"
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
import { getLoyaltySettings, updateLoyaltySettings } from "@/lib/loyalty-actions"
import type { BranchReceiptSettings, BusinessSettings, LoyaltySettings } from "@/lib/db.types"
import { AlertCircle, CheckCircle, Gift, MapPin, Printer } from "lucide-react"

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
  const isOwner = profile?.role === "owner"

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

        console.error("Failed to load settings:", error)
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
    const tabs = [{ value: "receipts", label: "Receipts" }]

    if (isOwner) {
      tabs.push({ value: "loyalty", label: "Loyalty" })
    }

    return tabs
  }, [isOwner])

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
      console.error("Failed to load branch overrides:", error)
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
    if (!profile || !isOwner) {
      setLoyaltySaveState("error")
      setLoyaltyMessage("Only the owner can update loyalty rules.")
      return
    }

    setSavingLoyalty(true)
    setLoyaltySaveState("idle")

    try {
      const updated = await updateLoyaltySettings(profile.id, profile.role, loyaltyForm)
      if (updated) {
        setLoyaltySettings(updated)
        setLoyaltyForm(updated)
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
      <div className="p-6 space-y-6">
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
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage receipt printing preferences, loyalty program settings, and branch-level overrides.
        </p>
      </div>

      {!isAdmin && !isOwner ? (
        <Alert className="border-amber-200 bg-amber-50">
          <AlertCircle className="h-4 w-4 text-amber-700" />
          <AlertDescription className="text-amber-800">
            You do not have permission to modify settings. Contact an administrator for changes.
          </AlertDescription>
        </Alert>
      ) : (
        <Tabs defaultValue={defaultTab} className="space-y-6">
          <TabsList className={`grid w-full ${visibleTabs.length === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
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

            <Card>
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
              <Card>
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

          {isOwner && (
            <TabsContent value="loyalty" className="space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Gift className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle>Loyalty Rules</CardTitle>
                      <CardDescription>
                        These values control how customers earn and redeem points.
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

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="earn_threshold_cents">Earn Threshold (cents)</Label>
                      <Input
                        id="earn_threshold_cents"
                        type="number"
                        min="100"
                        value={loyaltyForm.earn_threshold_cents ?? 10000}
                        onChange={(event) => handleLoyaltyChange("earn_threshold_cents", parseInt(event.target.value || "0", 10))}
                        disabled={savingLoyalty}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="earn_minimum_basket_cents">Minimum Basket to Earn (cents)</Label>
                      <Input
                        id="earn_minimum_basket_cents"
                        type="number"
                        min="0"
                        value={loyaltyForm.earn_minimum_basket_cents ?? 0}
                        onChange={(event) => handleLoyaltyChange("earn_minimum_basket_cents", parseInt(event.target.value || "0", 10))}
                        disabled={savingLoyalty}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border p-4">
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

                  <Separator />

                  <div className="flex items-center justify-between rounded-lg border p-4">
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

                  {loyaltyForm.redeem_enabled && (
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="redeem_value_cents">Point Value (cents)</Label>
                        <Input
                          id="redeem_value_cents"
                          type="number"
                          min="1"
                          value={loyaltyForm.redeem_value_cents ?? 50}
                          onChange={(event) => handleLoyaltyChange("redeem_value_cents", parseInt(event.target.value || "0", 10))}
                          disabled={savingLoyalty}
                        />
                      </div>
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
                          value={loyaltyForm.redeem_minimum_basket_cents ?? 5000}
                          onChange={(event) => handleLoyaltyChange("redeem_minimum_basket_cents", parseInt(event.target.value || "0", 10))}
                          disabled={savingLoyalty}
                        />
                      </div>
                    </div>
                  )}

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
