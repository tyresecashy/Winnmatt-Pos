# AUDIT FIXES - QUICK REFERENCE GUIDE

## Priority Order & Time Estimates

```
CRITICAL FIX #1: M-Pesa Loyalty Points        ⏱️  30 min   → lib/mpesa-actions.ts
CRITICAL FIX #2: M-Pesa Redemption           ⏱️  90 min   → 3 files + schema
CRITICAL FIX #3: Mock Data in UI             ⏱️  90 min   → 2 files
MAJOR FIX   #4: Error Handling               ⏱️  60 min   → app/api/mpesa/callback/route.ts
MINOR FIX   #5: Import Locations             ⏱️  60 min   → create 1 file + update 20 imports

TOTAL: ~6 hours of development work
       +2-3 hours of testing
       = ~1 working day for one developer
```

---

## FIX #1: M-PESA LOYALTY POINTS (30 MIN)

**File**: `lib/mpesa-actions.ts`

**Find this function**:
```typescript
export async function finalizeMpesaSale(saleId: string) {
  try {
    // Update sale status to completed
    const { error: saleError } = await supabaseAdmin
      .from('sales')
      .update({
        payment_status: 'completed',
      })
      .eq('id', saleId)

    if (saleError) throw saleError
    
    // Update M-Pesa transaction
    const { error: txError } = await supabaseAdmin
```

**Replace with**:
```typescript
export async function finalizeMpesaSale(saleId: string) {
  try {
    // Update sale status to completed - return full sale data
    const { data: saleData, error: saleError } = await supabaseAdmin
      .from('sales')
      .update({
        payment_status: 'completed',
      })
      .eq('id', saleId)
      .select('*')  // ← ADD THIS
      .single()     // ← ADD THIS

    if (saleError) throw saleError

    // 🆕 NEW: Award loyalty points now that payment is confirmed
    if (saleData && saleData.customer_id) {
      try {
        const { awardLoyaltyPoints } = await import('@/lib/loyalty-actions')
        const loyaltyResult = await awardLoyaltyPoints(
          saleData.customer_id,
          saleData.id,
          saleData.total_amount,
          saleData.discount_amount,
          saleData.branch_id,
          'system' // Mark as system-processed from M-Pesa
        )
        if (loyaltyResult) {
          console.log(`[M-PESA] ✅ Awarded ${loyaltyResult.pointsAwarded} loyalty points. New balance: ${loyaltyResult.newBalance}`)
        }
      } catch (loyaltyError) {
        console.error('[M-PESA] Failed to award loyalty points:', loyaltyError)
        // Don't fail the sale - loyalty is secondary
      }
    }
    
    // Update M-Pesa transaction
    const { error: txError } = await supabaseAdmin
```

**Test**:
```bash
1. Create M-Pesa transaction with customer
2. Complete payment
3. Query DB: SELECT * FROM loyalty_transactions WHERE sale_id = '...'
4. Expected: New row with type='earn_sale' and points_delta > 0
```

---

## FIX #2: M-PESA REDEMPTION (90 MIN)

### Step 2.1: Add schema column (5 min)

**File**: `mpesa-migration.sql`

**Add after the trigger definition** (around line 46):
```sql
-- 2024-04-10: Add redemption tracking
ALTER TABLE mpesa_transactions 
ADD COLUMN IF NOT EXISTS redemption_data JSONB DEFAULT NULL;

COMMENT ON COLUMN mpesa_transactions.redemption_data IS 
'Stores {pointsToRedeem, discountApplied} if loyalty redemption was applied at checkout';
```

### Step 2.2: Accept redemption in STK Push (20 min)

**File**: `app/api/mpesa/stk-push/route.ts`

**Find**:
```typescript
interface STKPushRequest {
  saleId: string
  phoneNumber: string
  amount: number
  accountReference: string
  cashierId: string
  branchId: string
}
```

**Change to**:
```typescript
interface STKPushRequest {
  saleId: string
  phoneNumber: string
  amount: number
  accountReference: string
  cashierId: string
  branchId: string
  // 🆕 NEW: Add optional redemption data
  redemption?: {
    pointsToRedeem: number
    discountApplied: number
  } | null
}
```

**Find** (after validation):
```typescript
    // Create M-Pesa transaction record
    const transactionResult = await createMpesaTransaction(
      body.saleId,
      stkResponse.MerchantRequestID,
      stkResponse.CheckoutRequestID,
      body.phoneNumber,
      body.amount
    )
```

**Change to**:
```typescript
    // Create M-Pesa transaction record
    const transactionResult = await createMpesaTransaction(
      body.saleId,
      stkResponse.MerchantRequestID,
      stkResponse.CheckoutRequestID,
      body.phoneNumber,
      body.amount,
      body.redemption || null  // 🆕 NEW
    )
```

### Step 2.3: Store redemption in transaction (15 min)

**File**: `lib/mpesa-actions.ts`

**Find**:
```typescript
export async function createMpesaTransaction(
  saleId: string,
  merchantRequestId: string,
  checkoutRequestId: string,
  phoneNumber: string,
  amount: number
) {
```

**Change to**:
```typescript
export async function createMpesaTransaction(
  saleId: string,
  merchantRequestId: string,
  checkoutRequestId: string,
  phoneNumber: string,
  amount: number,
  // 🆕 NEW:
  redemption?: {
    pointsToRedeem: number
    discountApplied: number
  } | null
) {
```

**Find** (inside function):
```typescript
      .insert({
        sale_id: saleId,
        merchant_request_id: merchantRequestId,
        checkout_request_id: checkoutRequestId,
        phone_number: phoneNumber,
        amount: Math.round(amount),
        status: 'pending',
        initiated_at: new Date().toISOString(),
      })
```

**Change to**:
```typescript
      .insert({
        sale_id: saleId,
        merchant_request_id: merchantRequestId,
        checkout_request_id: checkoutRequestId,
        phone_number: phoneNumber,
        amount: Math.round(amount),
        status: 'pending',
        initiated_at: new Date().toISOString(),
        // 🆕 NEW: Store redemption if present
        redemption_data: redemption ? JSON.stringify(redemption) : null,
      })
```

### Step 2.4: Pass redemption from POS (20 min)

**File**: `app/(dashboard)/pos/page.tsx`

**Find** (around line 440):
```typescript
                  try {
                    // Send STK Push to Daraja
                    const stkResponse = await fetch('/api/mpesa/stk-push', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        saleId: result.sale.id,
                        phoneNumber: options.mpesaPhone,
                        amount: total,
                        accountReference: '7617748',
                        cashierId: profile.id,
                        branchId: profile.branch_id,
                      })
                    })
```

**Change to**:
```typescript
                  try {
                    // Send STK Push to Daraja
                    const stkResponse = await fetch('/api/mpesa/stk-push', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        saleId: result.sale.id,
                        phoneNumber: options.mpesaPhone,
                        amount: total,
                        accountReference: '7617748',
                        cashierId: profile.id,
                        branchId: profile.branch_id,
                        // 🆕 NEW: Include redemption info
                        redemption: options?.redemption || null,
                      })
                    })
```

### Step 2.5: Apply redemption in callback (30 min)

**File**: `app/api/mpesa/callback/route.ts`

**Find** (after payment confirmed, before finalizeMpesaSale):
```typescript
    // Handle success case (result code 0)
    if (resultCode === 0) {
      console.log('M-Pesa: Payment confirmed', {
        saleId,
        checkoutRequestId,
        mpesaReceiptNumber,
      })

      // Finalize the sale (mark as completed)
      const finalizeResult = await finalizeMpesaSale(saleId)
```

**Change to**:
```typescript
    // Handle success case (result code 0)
    if (resultCode === 0) {
      console.log('M-Pesa: Payment confirmed', {
        saleId,
        checkoutRequestId,
        mpesaReceiptNumber,
      })

      // 🆕 NEW: Apply loyalty redemption if present
      if (transaction.redemption_data) {
        try {
          const redemption = JSON.parse(transaction.redemption_data)
          const { redeemLoyaltyPoints } = await import('@/lib/loyalty-actions')
          
          const redemptionResult = await redeemLoyaltyPoints(
            transaction.sale_id,  // WE NEED TO QUERY TO GET customer_id
            saleId,
            redemption.pointsToRedeem,
            redemption.discountApplied,
            'system'
          )
          console.log('[M-PESA] Applied redemption:', redemption)
        } catch (redemptionError) {
          console.error('[M-PESA] Failed to apply redemption:', redemptionError)
          // Don't fail - loyalty is bonus feature
        }
      }

      // Finalize the sale (mark as completed)
      const finalizeResult = await finalizeMpesaSale(saleId)
```

**Test**:
```bash
1. In POS: Select loyalty redemption (50 points)
2. Select cash/card payment and complete (should work - this is baseline)
3. Verify points deducted from customer
4. Now try SAME transaction with M-Pesa:
   - Select loyalty redemption in UI
   - Pay with M-Pesa
   - Check customer balance after callback
   - Expected: Points deducted
```

---

## FIX #3: MOCK DATA IN UI (90 MIN)

### Step 3.1: Business Accounts Page (45 min)

**File**: `app/(dashboard)/business-accounts/page.tsx`

**Replace entire file** with proper DB queries:

```typescript
'use client'

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
// ... other imports stay the same

import { formatKSh } from "@/lib/formatters"  // 🆕 Fix import too

// 🆕 NEW: Import DB functions
import { getCustomersByType } from "@/lib/customers-actions"

export default function BusinessAccountsPage() {
  const [businessAccounts, setBusinessAccounts] = useState([])  // 🆕 NEW
  const [loading, setLoading] = useState(true)  // 🆕 NEW
  const [error, setError] = useState("")  // 🆕 NEW
  const [searchTerm, setSearchTerm] = useState("")
  const [selectedAccount, setSelectedAccount] = useState(null)

  // 🆕 NEW: Load from DB instead of import
  useEffect(() => {
    async function loadAccounts() {
      try {
        setLoading(true)
        const accounts = await getCustomersByType('business')
        setBusinessAccounts(accounts || [])
      } catch (err) {
        console.error('Failed to load business accounts:', err)
        setError('Failed to load business accounts')
      } finally {
        setLoading(false)
      }
    }
    loadAccounts()
  }, [])

  if (loading) {
    return <div className="p-6">Loading...</div>
  }

  if (error) {
    return <div className="p-6 text-red-600">{error}</div>
  }

  const filteredAccounts = businessAccounts.filter((account) => {
    return (
      account.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (account.contact_person || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (account.phone || '').includes(searchTerm)
    )
  })

  const totalCreditLimit = businessAccounts.reduce((sum, a) => sum + (a.credit_limit || 0), 0)
  const totalBalance = businessAccounts.reduce((sum, a) => sum + (a.credit_balance || 0), 0)
  const utilizationRate = totalCreditLimit > 0 ? (totalBalance / totalCreditLimit) * 100 : 0

  // ... rest of component uses real data from state
}
```

### Step 3.2: Settings Page - Branches (45 min)

**File**: `app/(dashboard)/settings/page.tsx`

**Find**:
```typescript
import { branches } from "@/lib/mock-data"
```

**Remove that line and add**:
```typescript
import { getBranches } from "@/lib/branch-actions" // 🆕 NEW
```

**Find**:
```typescript
export default function SettingsPage() {
  const { profile } = useAuth()
  
  // Business settings state
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings | null>(null)
```

**Add these new state vars**:
```typescript
export default function SettingsPage() {
  const { profile } = useAuth()
  
  // 🆕 NEW: Branches state
  const [branches, setBranches] = useState([])
  const [branchesLoading, setBranchesLoading] = useState(true)
  
  // Business settings state
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings | null>(null)
```

**Find** (the useEffect that loads settings):
```typescript
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const [business, loyalty] = await Promise.all([
          getBusinessSettings(),
          getLoyaltySettings()
        ])
```

**Change to**:
```typescript
  useEffect(() => {
    const loadSettings = async () => {
      try {
        // 🆕 NEW: Load branches too
        const [business, loyalty, branchList] = await Promise.all([
          getBusinessSettings(),
          getLoyaltySettings(),
          getBranches()  // 🆕 NEW
        ])
        
        // 🆕 NEW: Set branches
        if (branchList) {
          setBranches(branchList)
        }
        setBranchesLoading(false)  // 🆕 NEW
```

**Find** (where branches are shown in JSX):
```typescript
                <SelectContent>
                  <SelectItem value="branch-1">Main Branch - Nakuru</SelectItem>
                  <SelectItem value="branch-2">Eldoret Branch</SelectItem>
                </SelectContent>
```

**Change to**:
```typescript
                <SelectContent>
                  {/* 🆕 NEW: Show real branches from DB */}
                  {branches.length === 0 ? (
                    <SelectItem disabled>No branches available</SelectItem>
                  ) : (
                    branches.map(branch => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
```

**Test**:
```bash
1. Create a new business customer in POS
2. Go to Business Accounts page
3. Search for the new business
4. Verify it shows in the list (not hardcoded fake data)

1. Go to Settings page
2. Check Branches dropdown
3. Verify it shows real branches from DB (not just Nakuru + Eldoret)
4. Add a new branch to DB
5. Refresh page
6. New branch should appear in dropdown
```

---

## FIX #4: ERROR HANDLING (60 MIN)

**File**: `app/api/mpesa/callback/route.ts`

**Status**: Good structure, just needs better error wrapping

**Add these changes**:

1. After callback extraction (line 30):
```typescript
    // 🆕 NEW: Add better error context
    if (!stkCallback) {
      console.error('[M-PESA] Invalid callback payload:', {
        hasBody: !!body,
        hasBody_Body: !!(body as any)?.Body,
        payloadKeys: Object.keys((body as any) || {})
      })
      return NextResponse.json(
        { success: false, error: 'Invalid callback payload' },
        { status: 200 }
      )
    }
```

2. In the failure section (around line 140):
```typescript
    } else {
      console.log('M-Pesa: Payment failed', {
        saleId,
        checkoutRequestId, 
        resultCode,
        resultDesc,
      })

      try {
        const failResult = await failMpesaSale(
          saleId,
          resultMapping[resultCode] || resultDesc
        )
        
        if (!failResult.success) {
          console.error('[M-PESA ERROR] Failed to mark sale as failed:', {
            saleId,
            error: failResult.error,
            resultCode
          })
          // Alert ops team if needed
          // await alertOpsTeam({...})
        }
      } catch (failError) {
        console.error('[M-PESA CRITICAL] Unexpected error in failure handling:', {
          saleId,
          error: failError,
          resultCode,
          resultDesc
        })
      }
    }
```

---

## FIX #5: IMPORT LOCATIONS (60 MIN)

### Step 5.1: Create new formatters file (5 min)

**Create new file**: `lib/formatters.ts`

```typescript
/**
 * Utility formatters for display values
 */

export function formatKSh(amountCents: number): string {
  if (!amountCents && amountCents !== 0) {
    return 'KSh 0.00'
  }
  const amountKSh = amountCents / 100
  return `KSh ${amountKSh.toLocaleString('en-KE', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function formatDate(date: string | Date): string {
  try {
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  } catch {
    return 'Invalid date'
  }
}

export function formatTime(date: string | Date): string {
  try {
    const d = typeof date === 'string' ? new Date(date) : date
    return d.toLocaleTimeString('en-KE', {
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return 'Invalid time'
  }
}
```

### Step 5.2: Update 20+ imports (55 min)

**Search & Replace in these files**:

```
FROM:  import { formatKSh, formatDate, formatTime } from '@/lib/mock-data'
TO:    import { formatKSh, formatDate, formatTime } from '@/lib/formatters'
```

**Files to update**:
- `app/(dashboard)/sales-history/page.tsx`
- `app/(dashboard)/sales-history/client.tsx`
- `app/(dashboard)/reports/page.tsx`
- `app/(dashboard)/purchases/page.tsx`
- `app/(dashboard)/suppliers/page.tsx`
- `app/(dashboard)/settings/page.tsx`
- `app/(dashboard)/users/page.tsx`
- `components/pos/payment-panel.tsx`
- `components/pos/shopping-cart.tsx`
- `components/pos/product-grid.tsx`
- `components/pos/product-list.tsx`
- `components/pos/recent-transactions.tsx`
- `components/dashboard/top-products.tsx`
- `components/dashboard/sales-trend-chart.tsx`
- `components/dashboard/seasonal-insights.tsx`
- `components/dashboard/payment-breakdown.tsx`
- `components/dashboard/recent-transactions.tsx`
- `components/dashboard/dashboard-stats.tsx`
- Plus any others found with: `grep -r "from.*mock-data" --include="*.tsx"`

---

## TESTING CHECKLIST

After all fixes, run these tests:

### Unit Tests
- [ ] `awardLoyaltyPoints()` returns correct points
- [ ] `redeemLoyaltyPoints()` deducts correctly
- [ ] `finalizeMpesaSale()` marks sale as completed
- [ ] `formatKSh()` formats correctly

### Integration Tests
- [ ] Create order + cash payment + verify loyalty earning
- [ ] Create order + loyalty redemption + verify deduction
- [ ] Create order + M-Pesa payment + verify loyalty (now working!)
- [ ] Create order + M-Pesa + redemption + verify both
- [ ] Void sale with loyalty + verify reversal
- [ ] Business Accounts page loads real data
- [ ] Settings shows real branches

### E2E Tests
- [ ] Full POS flow: scan → add → discount → M-Pesa → receipt
- [ ] Full loyalty flow: earn points → redeem → void

### Production Checks
- [ ] M-Pesa environment set to production (not sandbox)
- [ ] Callback URL correct in Safaricom portal
- [ ] Database backups enabled
- [ ] Error logging configured

---

## ROLLBACK PLAN

If something breaks in production:

```bash
# Quick rollback without redeploying:
1. Set M-Pesa environment variable to 'sandbox'
2. Disable M-Pesa feature flag
3. Users fall back to Cash/Card (which still work)
4. Loyalty still works for cash/card
5. This buys time to debug the issue

# If database issue:
1. Restore from backup point
2. All data safe because backups enabled

# If loyalty calculation wrong:
1. Don't worry - loyalty is not payment-critical
2. Can be recalculated from audit trail
3. loyalty_transactions table has full history
```

---

**Total Development Time**: ~6 hours  
**Total Testing Time**: ~2-3 hours  
**Ready for production**: ~1 working day
