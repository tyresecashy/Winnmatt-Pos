# Phase 1 Implementation: Before/After Code Snippets

> Copy-paste ready code for each of the 5 changes

---

## CHANGE 1: customer-lookup.tsx - Loyalty KSh Display

### Step 1.1: Update Props Interface

**File**: `components/pos/customer-lookup.tsx`  
**Find and replace** (top of file):

```typescript
// BEFORE
interface CustomerLookupProps {
  onSelect: (customer: SelectedCustomer) => void
  onClose?: () => void
  isOpen?: boolean
}

export function CustomerLookup({ onSelect, onClose, isOpen }: CustomerLookupProps) {
```

```typescript
// AFTER
interface CustomerLookupProps {
  onSelect: (customer: SelectedCustomer) => void
  onClose?: () => void
  isOpen?: boolean
  loyaltyRedeemValue?: number // in cents
}

export function CustomerLookup({ onSelect, onClose, isOpen, loyaltyRedeemValue }: CustomerLookupProps) {
```

### Step 1.2: Update Loyalty Display JSX

**File**: `components/pos/customer-lookup.tsx`  
**Location**: Around line 71 (near loyalty_points display)  
**Find** (current):

```typescript
<p className="text-xs font-medium text-primary">
  {selectedCustomer.loyalty_points?.toLocaleString()} pts
</p>
```

**Replace with**:

```typescript
<div className="flex items-center justify-between">
  <p className="text-xs font-medium text-primary">
    {selectedCustomer.loyalty_points?.toLocaleString()} pts
  </p>
  {loyaltyRedeemValue && (
    <p className="text-xs text-muted-foreground">
      (KSh {formatKSh((selectedCustomer.loyalty_points || 0) * loyaltyRedeemValue)})
    </p>
  )}
</div>
```

### Step 1.3: Add Import (if missing)

**File**: `components/pos/customer-lookup.tsx`  
**Add to imports** (top):

```typescript
import { formatKSh } from "@/lib/mock-data"
```

---

## CHANGE 2: pos/page.tsx - Load Loyalty Settings

### Step 2.1: Add Imports

**File**: `app/(dashboard)/pos/page.tsx`  
**Find the imports section and add** (if not present):

```typescript
import { getLoyaltySettings } from "@/lib/loyalty-actions"
```

### Step 2.2: Add State

**File**: `app/(dashboard)/pos/page.tsx`  
**Location**: Near other useState declarations (around customer state)  
**Add**:

```typescript
const [loyaltySettings, setLoyaltySettings] = useState<any>(null)
```

### Step 2.3: Add useEffect

**File**: `app/(dashboard)/pos/page.tsx`  
**Add new useEffect block** (after other useEffects):

```typescript
// Load loyalty settings on mount
useEffect(() => {
  async function loadLoyalty() {
    try {
      const settings = await getLoyaltySettings()
      setLoyaltySettings(settings)
    } catch (error) {
      console.error('Failed to load loyalty settings:', error)
    }
  }
  loadLoyalty()
}, [])
```

### Step 2.4: Pass Prop to CustomerLookup

**File**: `app/(dashboard)/pos/page.tsx`  
**Find**: Where `<CustomerLookup` is rendered  
**Update**:

```typescript
// BEFORE
<CustomerLookup
  onSelect={setSelectedCustomer}
  onClose={() => setShowCustomerLookup(false)}
  isOpen={showCustomerLookup}
/>

// AFTER
<CustomerLookup
  onSelect={setSelectedCustomer}
  onClose={() => setShowCustomerLookup(false)}
  isOpen={showCustomerLookup}
  loyaltyRedeemValue={loyaltySettings?.redeem_value_cents}
/>
```

---

## CHANGE 3: shopping-cart.tsx - Line + Unit Count

### Step 3.1: Update Cart Header

**File**: `components/pos/shopping-cart.tsx`  
**Location**: Around line 61-72 (cart header badge)  
**Find**:

```typescript
<span className="font-medium">Cart</span>
{itemCount > 0 && (
  <Badge variant="secondary" className="bg-primary/10 text-primary">
    {itemCount} items
  </Badge>
)}
```

**Replace with**:

```typescript
<span className="font-medium">Cart</span>
{itemCount > 0 && (
  <Badge variant="secondary" className="bg-primary/10 text-primary">
    {items.length} {items.length === 1 ? 'line' : 'lines'}, {itemCount} units
  </Badge>
)}
```

---

## CHANGE 4: payment-panel.tsx - Points to Earn KSh Value

### Step 4.1: Main Cart Panel Section

**File**: `components/pos/payment-panel.tsx`  
**Location**: Around lines 566-573  
**Find**:

```typescript
{/* Loyalty Points Preview */}
{customer && loyaltySettings?.earn_enabled && loyaltyPointsToEarn > 0 && (
  <div className="flex justify-between text-sm pt-1 text-primary items-center gap-2">
    <div className="flex items-center gap-1">
      <Gift className="h-4 w-4" />
      <span>Will Earn</span>
    </div>
    <span className="font-semibold">{loyaltyPointsToEarn.toLocaleString()} pts</span>
  </div>
)}
```

**Replace with**:

```typescript
{/* Loyalty Points Preview */}
{customer && loyaltySettings?.earn_enabled && loyaltyPointsToEarn > 0 && (
  <div className="flex justify-between text-sm pt-1 text-primary items-center gap-2">
    <div className="flex items-center gap-1">
      <Gift className="h-4 w-4" />
      <span>Will Earn</span>
    </div>
    <div className="flex items-center gap-1">
      <span className="font-semibold">{loyaltyPointsToEarn.toLocaleString()} pts</span>
      <span className="text-xs text-muted-foreground">
        ({formatKSh(loyaltyPointsToEarn * (loyaltySettings.redeem_value_cents || 50))})
      </span>
    </div>
  </div>
)}
```

### Step 4.2: Payment Dialog Section

**File**: `components/pos/payment-panel.tsx`  
**Location**: Around lines 633-640 (inside Dialog)  
**Find**:

```typescript
{/* Loyalty Earning Preview */}
{customer && loyaltySettings?.earn_enabled && loyaltyPointsToEarn > 0 && (
  <div className="flex justify-between text-primary border-t border-border pt-2">
    <span className="text-muted-foreground flex items-center gap-1">
      <Gift className="h-4 w-4" />
      Will Earn
    </span>
    <span className="font-semibold">{loyaltyPointsToEarn.toLocaleString()} pts</span>
  </div>
)}
```

**Replace with**:

```typescript
{/* Loyalty Earning Preview */}
{customer && loyaltySettings?.earn_enabled && loyaltyPointsToEarn > 0 && (
  <div className="flex justify-between text-primary border-t border-border pt-2">
    <span className="text-muted-foreground flex items-center gap-1">
      <Gift className="h-4 w-4" />
      Will Earn
    </span>
    <span className="font-semibold">
      {loyaltyPointsToEarn.toLocaleString()} pts 
      ({formatKSh(loyaltyPointsToEarn * (loyaltySettings.redeem_value_cents || 50))})
    </span>
  </div>
)}
```

---

## CHANGE 5: payment-panel.tsx - Redemption Eligibility Feedback

### Step 5.1: Full Redemption Section Replacement

**File**: `components/pos/payment-panel.tsx`  
**Location**: Lines 500-564 (entire Redemption Section)  
**Find** (entire section):

```typescript
{/* Redemption Section */}
{customer && redemptionEligibility?.eligible && (
  <div className="pt-2 space-y-2 bg-blue-50 rounded p-2 border border-blue-100">
    <div className="flex items-center gap-2">
      <input
        type="checkbox"
        id="apply-redemption"
        checked={applyRedemption}
        onChange={(e) => setApplyRedemption(e.target.checked)}
        className="w-4 h-4 cursor-pointer"
      />
      <label htmlFor="apply-redemption" className="text-sm font-medium cursor-pointer flex-1">
        Redeem Points
      </label>
      <span className="text-xs text-muted-foreground">
        {redemptionEligibility.currentBalance} available
      </span>
    </div>
    
    {applyRedemption && (
      <div className="space-y-2 border-t border-blue-100 pt-2">
        <div className="text-xs text-muted-foreground">
          Max: {redemptionEligibility.maxRedeemablePoints.toLocaleString()} pts ({formatKSh(redemptionEligibility.maxRedeemableDiscount)})
        </div>
        
        <div className="flex gap-2">
          <input
            type="number"
            min="0"
            max={redemptionEligibility.maxRedeemablePoints}
            value={pointsToRedeem}
            onChange={(e) => {
              const value = Math.min(
                parseInt(e.target.value) || 0,
                redemptionEligibility.maxRedeemablePoints
              )
              setPointsToRedeem(value)
            }}
            placeholder="Points to redeem"
            className="flex-1 px-2 py-1 border rounded text-sm"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPointsToRedeem(redemptionEligibility.maxRedeemablePoints)}
            className="text-xs"
          >
            Max
          </Button>
        </div>
        
        {pointsToRedeem > 0 && (
          <div className="text-sm font-medium text-primary">
            -{formatKSh(redemptionDiscount)} discount
          </div>
        )}
      </div>
    )}
  </div>
)}
```

**Replace with**:

```typescript
{/* Redemption Section */}
{customer && loyaltySettings?.redeem_enabled && (
  <>
    {redemptionEligibility?.eligible ? (
      // ELIGIBLE: Show redemption controls
      <div className="pt-2 space-y-2 bg-blue-50 rounded p-2 border border-blue-100">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="apply-redemption"
            checked={applyRedemption}
            onChange={(e) => setApplyRedemption(e.target.checked)}
            className="w-4 h-4 cursor-pointer"
          />
          <label htmlFor="apply-redemption" className="text-sm font-medium cursor-pointer flex-1">
            Redeem Points
          </label>
          <span className="text-xs text-muted-foreground">
            {redemptionEligibility.currentBalance} available
          </span>
        </div>
        
        {applyRedemption && (
          <div className="space-y-2 border-t border-blue-100 pt-2">
            <div className="text-xs text-muted-foreground">
              Max: {redemptionEligibility.maxRedeemablePoints.toLocaleString()} pts ({formatKSh(redemptionEligibility.maxRedeemableDiscount)})
            </div>
            
            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                max={redemptionEligibility.maxRedeemablePoints}
                value={pointsToRedeem}
                onChange={(e) => {
                  const value = Math.min(
                    parseInt(e.target.value) || 0,
                    redemptionEligibility.maxRedeemablePoints
                  )
                  setPointsToRedeem(value)
                }}
                placeholder="Points to redeem"
                className="flex-1 px-2 py-1 border rounded text-sm"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPointsToRedeem(redemptionEligibility.maxRedeemablePoints)}
                className="text-xs"
              >
                Max
              </Button>
            </div>
            
            {pointsToRedeem > 0 && (
              <div className="text-sm font-medium text-primary">
                -{formatKSh(redemptionDiscount)} discount
              </div>
            )}
          </div>
        )}
      </div>
    ) : (
      // INELIGIBLE: Show reason why
      <div className="pt-2 px-2 py-2 rounded bg-amber-50 border border-amber-200">
        <div className="flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-xs text-amber-800">
            <p className="font-medium mb-1">Cannot Redeem Points</p>
            <p className="text-amber-700">
              {redemptionEligibility?.reason || 'Not eligible for redemption on this purchase'}
            </p>
          </div>
        </div>
      </div>
    )}
  </>
)}
```

### Step 5.2: Add AlertCircle Import (if missing)

**File**: `components/pos/payment-panel.tsx`  
**Find the IconImports line** (starts with `import { Banknote, ...`):

```typescript
// BEFORE
import { Banknote, Smartphone, CreditCard, Receipt, Check, X, Percent, ChevronDown, ChevronUp, RotateCcw, Gift } from "lucide-react"

// AFTER (add AlertCircle)
import { Banknote, Smartphone, CreditCard, Receipt, Check, X, Percent, ChevronDown, ChevronUp, RotateCcw, Gift, AlertCircle } from "lucide-react"
```

---

## CHANGE 6: payment-panel.tsx - Customer Loyalty in Dialog

### Step 6.1: Update Dialog Header/Description

**File**: `components/pos/payment-panel.tsx`  
**Location**: Around line 605 (inside Payment Dialog)  
**Find**:

```typescript
<DialogDescription>
  {customer && (
    <span className="text-sm block mb-2">
      Customer: {customer.name}
    </span>
  )}
</DialogDescription>
```

**Replace with**:

```typescript
<DialogDescription>
  {customer && (
    <div className="text-sm space-y-1 mb-2">
      <div>Customer: {customer.name}</div>
      {loyaltySettings && (
        <div className="text-xs text-muted-foreground">
          Loyalty Balance: {customer.loyalty_points?.toLocaleString()} pts 
          = {formatKSh((customer.loyalty_points || 0) * (loyaltySettings.redeem_value_cents || 50))}
        </div>
      )}
    </div>
  )}
</DialogDescription>
```

---

## Import Verification Checklist

### customer-lookup.tsx
```typescript
import { formatKSh } from "@/lib/mock-data"  // ← Must have this
```

### pos/page.tsx
```typescript
import { getLoyaltySettings } from "@/lib/loyalty-actions"  // ← Must have this
```

### shopping-cart.tsx
- No new imports needed

### payment-panel.tsx
```typescript
import { AlertCircle } from "lucide-react"  // ← Add to icon imports
import { formatKSh } from "@/lib/mock-data"  // ← Should already be there
```

---

## What Each Change Does

| Change | File | Purpose | Impact |
|--------|------|---------|--------|
| 1 | customer-lookup.tsx | Show KSh value of loyalty balance | Cashier sees "156 pts (KSh 78.00)" |
| 2 | pos/page.tsx | Load loyalty settings for child components | Enables all loyalty displays |
| 3 | shopping-cart.tsx | Show product lines + unit count | Cashier sees "2 lines, 12 units" |
| 4 | payment-panel.tsx | Show KSh value of earned points | Cashier sees "Will Earn 3 pts (KSh 1.50)" |
| 5 | payment-panel.tsx | Show why customer can't redeem | Cashier sees "Cannot Redeem: Not enough points" |
| 6 | payment-panel.tsx | Show loyalty balance in dialog | Payment dialog shows full context |

---

## Testing Each Change Immediately After Implementation

### Test 1: Customer Loyalty Display
1. Open POS
2. Search for customer with points (e.g., "John")
3. Should see in customer card: "156 pts (KSh 78.00)" ✅

### Test 2: Cart Header
1. Add 1 coffee to cart
2. Badge should show "1 line, 1 unit"
3. Add another product (qty 3)
4. Badge should update to "2 lines, 4 units" ✅

### Test 3: Points to Earn
1. Add KSh 250 to cart
2. Customer selected with earning enabled
3. Should show "Will Earn 2 pts (KSh 1.00)" ✅
4. Click Checkout
5. Should also see in payment dialog ✅

### Test 4: Redemption Feedback
1. Add product for ineligible customer
2. Should see amber box: "Cannot Redeem Points - {reason}"
3. Select eligible customer
4. Should see blue box with checkbox ✅

### Test 5: Payment Dialog
1. Select customer → open checkout
2. Dialog should show both:
   - "Customer: John Doe"
   - "Loyalty Balance: 156 pts = KSh 78.00" ✅

---

## Rollback Instructions

If anything breaks, revert in this order:
1. Undo CHANGE 5 (redemption section) - most complex
2. Undo CHANGE 4 (points display)
3. Undo CHANGE 6 (dialog)
4. Undo CHANGE 3 (cart header) - safest edit
5. Undo CHANGE 2 (pos/page setup)
6. Undo CHANGE 1 (customer-lookup)

All changes are isolated - removing one won't break others.
