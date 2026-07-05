# Phase 1: Cashier UX Implementation - Complete Spec

## Executive Summary

**Objective**: Make cashier checkout experience clear, modern, and instantly informative about loyalty values.

**Scope**: 3 component files, 5 targeted changes, 0 new components, 0 database changes

**Timeline**: 1-2 hours (straightforward JSX updates + one new API call)

**Changes**:
1. ✅ Customer loyalty display: Add KSh equivalent  
2. ✅ Cart header: Show line count + units breakdown
3. ✅ Points to earn: Display KSh value alongside points
4. ✅ Redemption ineligibility: Show reason/feedback when can't redeem
5. ✅ Payment dialog: Display KSh worth of loyalty balance

---

## CHANGE 1: Customer Loyalty Balance - Show KSh Value

**File**: [components/pos/customer-lookup.tsx](components/pos/customer-lookup.tsx)

**Location**: Lines 65-80 (selected customer display section)

**Current Code** (line 71):
```typescript
<p className="text-xs font-medium text-primary">
  {selectedCustomer.loyalty_points?.toLocaleString()} pts
</p>
```

**Issue**: Shows "156 pts" with no context on value or redemption eligibility.

**Required Change**:

Need to pass loyalty settings to this component so it can calculate KSh value.

### Step 1A: Update Props
**Change type**: Add prop to component interface

**Before**:
```typescript
interface CustomerLookupProps {
  onSelect: (customer: SelectedCustomer) => void
  // ... other props
}
```

**After**:
```typescript
interface CustomerLookupProps {
  onSelect: (customer: SelectedCustomer) => void
  loyaltyRedeemValue?: number // cents per point
  // ... other props
}
```

### Step 1B: Update Loyalty Display
**Location**: Line 71 in customer-lookup.tsx

**Current**:
```typescript
<p className="text-xs font-medium text-primary">
  {selectedCustomer.loyalty_points?.toLocaleString()} pts
</p>
```

**New**:
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

### Step 1C: Pass Prop from Parent (POS Page)
**File**: [app/(dashboard)/pos/page.tsx](app/(dashboard)/pos/page.tsx)

**Action**: Find where `CustomerLookup` is rendered and:
1. Extract `loyaltySettings` from payment-panel state (or load it separately)
2. Pass `loyaltyRedeemValue={loyaltySettings?.redeem_value_cents}` prop

**Location to find**: Search for `<CustomerLookup` in pos/page.tsx

**Add before component**:
```typescript
const [loyaltySettings, setLoyaltySettings] = useState<any>(null)

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

**Then pass to component**:
```typescript
<CustomerLookup
  onSelect={setSelectedCustomer}
  loyaltyRedeemValue={loyaltySettings?.redeem_value_cents}
/>
```

**Import needed**: Add to imports if not present:
```typescript
import { getLoyaltySettings } from "@/lib/loyalty-actions"
```

---

## CHANGE 2: Cart Header - Show Line Count + Units

**File**: [components/pos/shopping-cart.tsx](components/pos/shopping-cart.tsx)

**Location**: Lines 58-72 (cart header section)

**Current Code**:
```typescript
<span className="font-medium">Cart</span>
{itemCount > 0 && (
  <Badge variant="secondary" className="bg-primary/10 text-primary">
    {itemCount} items
  </Badge>
)}
```

Where: `const itemCount = items.reduce((sum, item) => sum + item.quantity, 0)`

**Issue**: Shows only "12 items" (total units). If 2 lines (A qty 5, B qty 7), should show "2 lines, 12 units".

**New Code**:
```typescript
{itemCount > 0 && (
  <Badge variant="secondary" className="bg-primary/10 text-primary">
    {items.length} {items.length === 1 ? 'line' : 'lines'}, {itemCount} units
  </Badge>
)}
```

**Explanation**:
- `items.length` = number of different products (lines)
- `itemCount` = total units across all products

**Result**: 
- Before: "Cart 12 items"
- After: "Cart 2 lines, 12 units"

---

## CHANGE 3: Points to Earn - Show KSh Value in Display

**File**: [components/pos/payment-panel.tsx](components/pos/payment-panel.tsx)

**Two locations to update**:

### 3A: Main Panel (Cart Section)

**Location**: Lines 566-573

**Current Code**:
```typescript
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

**New Code**:
```typescript
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

### 3B: Payment Dialog (Summary Section)

**Location**: Lines 633-640

**Current Code**:
```typescript
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

**New Code**:
```typescript
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

## CHANGE 4: Redemption Ineligibility - Show Reason/Feedback

**File**: [components/pos/payment-panel.tsx](components/pos/payment-panel.tsx)

**Location**: Lines 500-564 (Redemption Section)

**Current Code**:
```typescript
{/* Redemption Section */}
{customer && redemptionEligibility?.eligible && (
  <div className="pt-2 space-y-2 bg-blue-50 rounded p-2 border border-blue-100">
    {/* ... checkbox and input ...*/}
  </div>
)}
```

**Issue**: Only shows section IF eligible. If ineligible, cashier sees nothing - no explanation why.

**New Code** (Replace entire section from line 500-564):
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

**What this does**:
- If eligible: Shows checkbox, input, max button (same as before) ✅
- If ineligible: Shows amber alert box with reason text
- Reason = from `redemptionEligibility.reason` (populated by `getRedemptionEligibility()`)

**Possible reasons from API**:
- "Not enough points (need X, have Y)"
- "Basket too small (min KSh X)"
- "Loyalty program disabled"
- "Customer has no loyalty account"

**Alert icon**: Make sure `AlertCircle` is imported:
```typescript
import { AlertCircle, /* ... other icons ... */ } from "lucide-react"
```

---

## CHANGE 5: Payment Dialog - Show Customer Loyalty Balance KSh Value

**File**: [components/pos/payment-panel.tsx](components/pos/payment-panel.tsx)

**Location**: Lines 600-610 (Payment dialog header)

**Current Code**:
```typescript
<DialogDescription>
  {customer && (
    <span className="text-sm block mb-2">
      Customer: {customer.name}
    </span>
  )}
</DialogDescription>
```

**New Code**:
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

**Result**: Dialog now shows both name and loyalty value in KSh equivalent.

---

## Implementation Order (Priority)

### Phase 1A: Formatting/Display Only (5 min)
**These are JSX-only changes, no new state/API calls**

1. ✅ **CHANGE 2**: Cart header line + unit count (shopping-cart.tsx)
   - Simplest change
   - Immediate visual improvement
   - No dependencies

2. ✅ **CHANGE 3**: Points to earn - add KSh value display (payment-panel.tsx, 2 locations)
   - Uses existing state
   - Pure calculation display
   - Clear improvement

### Phase 1B: Data Flow Changes (10 min)
**Require passing new props, but no new API calls**

3. ✅ **CHANGE 1**: Customer loyalty KSh display (customer-lookup.tsx)
   - Add loyaltyRedeemValue prop
   - Load loyaltySettings in pos/page.tsx
   - Pass to customer-lookup
   - Display KSh equivalent

4. ✅ **CHANGE 5**: Payment dialog loyalty balance KSh (payment-panel.tsx)
   - Uses existing loyaltySettings already in component
   - Simple display addition
   - Immediate value

### Phase 1C: Conditional Rendering (5 min)
**Logic change but no new calculations**

5. ✅ **CHANGE 4**: Ineligibility feedback (payment-panel.tsx)
   - Restructure existing conditional
   - Add else branch with alert styling
   - Show reason text from API
   - Uses existing redemptionEligibility state

---

## File-by-File Implementation Checklist

### File 1: [components/pos/customer-lookup.tsx](components/pos/customer-lookup.tsx)

- [ ] Add `loyaltyRedeemValue?: number` to component props interface
- [ ] Update line 71-72 loyalty display to show KSh value
- [ ] Add import: `import { formatKSh } from "@/lib/mock-data"` (if not present)

### File 2: [components/pos/shopping-cart.tsx](components/pos/shopping-cart.tsx)

- [ ] Update lines 58-72 cart header badge
- [ ] Change `{itemCount} items` to `{items.length} lines, {itemCount} units`
- [ ] Add proper pluralization check

### File 3: [app/(dashboard)/pos/page.tsx](app/(dashboard)/pos/page.tsx)

- [ ] Add import: `import { getLoyaltySettings } from "@/lib/loyalty-actions"`
- [ ] Add state: `const [loyaltySettings, setLoyaltySettings] = useState<any>(null)`
- [ ] Add useEffect to load loyalty settings on mount
- [ ] Pass `loyaltyRedeemValue={loyaltySettings?.redeem_value_cents}` to CustomerLookup component

### File 4: [components/pos/payment-panel.tsx](components/pos/payment-panel.tsx)

**CHANGE 3A - Main panel (lines 566-573)**:
- [ ] Add KSh value display next to "Will Earn" points

**CHANGE 3B - Payment dialog (lines 633-640)**:
- [ ] Add KSh value display next to "Will Earn" points

**CHANGE 4 - Redemption section (lines 500-564)**:
- [ ] Restructure to check `redemptionEligibility?.eligible`
- [ ] Keep existing HTML for eligible case
- [ ] Add new amber alert box for ineligible case
- [ ] Import `AlertCircle` icon if not present

**CHANGE 5 - Payment dialog (lines 600-610)**:
- [ ] Add loyalty balance display with KSh value

---

## Testing Plan

### Unit: Customer Loyalty Display

**Scenario 1**: Customer with points, loyalty enabled
- ✅ Should see "156 pts (KSh 78.00)" in customer lookup
- ✅ Value matches settings (e.g., 156 * 50 cents = KSh 78)

**Scenario 2**: No customer selected
- ✅ Customer section should not show loyalty info

### Unit: Cart Header

**Scenario 1**: Single product, qty 5
- ✅ Badge shows "1 lines, 5 units"

**Scenario 2**: Two products, qty 3 and qty 7
- ✅ Badge shows "2 lines, 10 units"

**Scenario 3**: Empty cart
- ✅ Badge doesn't show

### Unit: Points to Earn

**Scenario 1**: Customer with $100 purchase at KSh 100 per point threshold
- ✅ Main panel shows "Will Earn 1 pts (KSh 0.50)"
- ✅ Payment dialog shows same

**Scenario 2**: $500 purchase at KSh 100 threshold
- ✅ Shows "Will Earn 5 pts (KSh 2.50)"

**Scenario 3**: Earn disabled in settings
- ✅ "Will Earn" section doesn't show

### Unit: Redemption Eligibility

**Scenario 1**: Customer eligible (enough points, basket large enough)
- ✅ Shows "Redeem Points [checkbox]"
- ✅ Shows available point count
- ✅ Can check box and enter points

**Scenario 2**: Not enough points (min 25, customer has 10)
- ✅ Shows amber alert: "Cannot Redeem Points"
- ✅ Shows reason: "Not enough points (need 25, have 10)"
- ✅ No checkbox visible

**Scenario 3**: Basket too small (min KSh 500, basket is KSh 100)
- ✅ Shows amber alert with reason
- ✅ No checkbox

**Scenario 4**: Ineligible but redemption enabled in settings
- ✅ Shows amber message (not removed from UI)
- ✅ Reason visible

### Unit: Payment Dialog

**Scenario 1**: When customer selected
- ✅ Shows "Customer: John Doe"
- ✅ Shows "Loyalty Balance: 156 pts = KSh 78.00"

**Scenario 2**: When redeeming 50 points
- ✅ Shows "Redeem -50 pts (-KSh 25.00)"
- ✅ Shows "Final Total" after discount

**Scenario 3**: When earning 3 points
- ✅ Shows "Will Earn 3 pts (KSh 1.50)"

---

## Potential Bugs to Watch For

### Bug 1: Null Reference in KSh Calculation
**Where**: Customer loyalty display calculation
**Issue**: If `loyaltyRedeemValue` undefined, format throws error
**Fix**: Use optional chaining and nullish coalescing
```typescript
(customer.loyalty_points || 0) * (loyaltyRedeemValue || 50)
```

### Bug 2: Cart Header Shows 0 Lines When Empty
**Where**: shopping-cart.tsx after emptying last item
**Issue**: `items.length` becomes 0, badge shows "0 lines, 0 units"
**Fix**: Already handled - `{itemCount > 0 && ...}` conditionally renders


### Bug 3: Eligibility Check Stale Cache
**Where**: payment-panel.tsx effect dependencies
**Issue**: If total changes but eligibility not recalculated
**Fix**: Verify dependencies include `[customer?.id, total, loyaltySettings?.redeem_enabled]`
(Already correct in current code)

### Bug 4: Redemption Ineligibility Not Rechecked on Paymethod Change
**Where**: Payment dialog opens/closes
**Issue**: If cashier selects M-Pesa, eligibility should probably stay same
**Status**: Not applicable to Phase 1 scope

---

## Code Quality Checklist

- [ ] All new JSX uses consistent formatting (2-space indent)
- [ ] All calculations include null guards / optional chaining
- [ ] formatKSh() imported where needed
- [ ] Icons (AlertCircle, Gift) imported
- [ ] No hardcoded magic numbers (use settings values)
- [ ] Color scheme consistent (blue for eligible, amber for ineligible)
- [ ] Text is concise and user-friendly
- [ ] Accessibility: proper label associations, alt text if needed

---

## Hidden Issues Found & Fixed

### Issue H1: Missing Import in customer-lookup
**Finding**: formatKSh may not be imported in customer-lookup.tsx
**Fix**: Add `import { formatKSh } from "@/lib/mock-data"` if missing

### Issue H2: Loyalty Settings Race Condition
**Finding**: If payment-panel renders before loyaltySettings loads, UI shows nothing
**Current Guard**: `{customer && loyaltySettings?.earn_enabled && ...}`
**Status**: ✅ Already safe with optional chaining

### Issue H3: Cart Discount Not Surfaced Visually
**Finding**: Cart discount is a collapsible, easy to miss that discount was applied
**Decision**: Out of Phase 1 scope (only affects cart discount visibility, not loyalty)
**Note**: Could be Phase 1B enhancement

---

## Deployment Checklist

- [ ] All 5 changes implemented
- [ ] No console errors
- [ ] Customer lookup shows KSh loyalty value
- [ ] Cart header shows line + unit count
- [ ] "Will Earn" shows points + KSh value (both panels)
- [ ] Ineligibility shows reason alert (not hidden)
- [ ] Payment dialog shows loyalty balance + KSh
- [ ] All values format correctly (KSh no decimals)
- [ ] Styling matches: blue for loyalty, amber for ineligibility
- [ ] Test with different customer types (new, loyal, no points)

---

## Summary

**What's Fixed**:
1. ✅ Customer loyalty points now show KSh equivalent
2. ✅ Cart header clarity: "2 lines, 12 units" instead of "12 items"
3. ✅ "Will Earn" now displays points + KSh value
4. ✅ Ineligibility reason now visible to cashier
5. ✅ Payment dialog shows full loyalty context

**Time to Complete**: 15-20 minutes of focused coding + 10 minutes testing

**Risk Level**: 🟢 LOW - all changes are display/formatting only, no business logic changes

**Ready for Production**: Yes - all changes are isolated UI improvements
