# Receipt Printing Implementation Plan

## Current State Analysis

### ✅ What Already Exists
1. **Receipt Data Retrieval** (`lib/sales-actions.ts`)
   - `getSaleById(saleId: string)`: Fetches full sale with items and product details
   - Returns: sale + branch + cashier + customer + sale_items with products
   - **This is exactly what we need for receipt display**

2. **Receipt UI Structure** (`components/pos/payment-panel.tsx`)
   - Receipt dialog exists with basic layout
   - Shows: receipt number, amount, payment method, change, customer name
   - Shows: business settings (name, phone, address, header/footer text, tax pin)
   - Has `useReceiptSettings()` hook to load branch settings
   - But currently only shows transaction summary, NOT line items

3. **Receipt Settings Tables** (database)
   - `business_settings`: Global business info
   - `branch_receipt_settings`: Branch-specific receipt customization
   - All data is available for display

### ❌ What's Missing
1. **No Receipt Component** for line items display
   - Current receipt dialog shows only totals
   - Doesn't show what items were sold (product names, quantities, prices)
   - Missing itemized breakdown that's essential for a real receipt

2. **No Print Functionality**
   - Receipt dialog has buttons for "New Transaction" and "Print & Continue"
   - Both buttons just call `handleComplete()` - no actual printing
   - No `window.print()` implementation

3. **No Data Flow from Sale to Receipt**
   - `createSale()` generates receipt_number but returns only bare saleData
   - Payment panel doesn't call `getSaleById()` to fetch full sale with items
   - Receipt dialog receives only: receiptNumber, selectedMethod, total, change, customer
   - Missing: sale_items array with product details

4. **No Reprint Capability from Sales History**
   - Sales history details modal doesn't show items list
   - No way to print/reprint receipts from historical sales
   - No receipt preview in that section

## Root Causes Identified

| Gap | Root Cause | Impact |
|-----|-----------|--------|
| Receipt shows no items | Payment panel doesn't fetch getSaleById() | Receipts incomplete, no items listed |
| No print button | Receipt dialog buttons don't call window.print() | Can't print receipts, customers have no hard copy |
| Sales history missing items | Details modal doesn't fetch sale_items | Can't verify what was sold, can't reprint |
| Incomplete receipt | Receipt preview component doesn't exist | No dedicated printable receipt format |

## Implementation Strategy

### Phase 1: Create Printable Receipt Component
**File**: `components/receipt-preview.tsx` (NEW)
**Purpose**: Reusable receipt display component formatted for printing

**Component API**:
```typescript
interface SaleDetailsData {
  id: string
  receipt_number: string
  created_at: string
  subtotal: number
  discount_amount: number
  tax_amount: number
  total_amount: number
  payment_method: string
  payment_status: string
  notes: string | null
  
  // Relations
  cashier: { id: string; full_name: string }
  customer: { id: string; name: string; phone: string } | null
  branch: { id: string; name: string; code: string }
  items: Array<{
    id: string
    product_id: string
    quantity: number
    unit_price: number
    discount_percent: number
    line_total: number
    product: { id: string; sku: string; name: string }
  }>
  
  // Settings
  businessSettings: {
    business_name: string
    phone: string
    email: string
    address: string
    tax_pin: string
    receipt_footer_text: string
    thank_you_message: string
  }
  branchSettings?: {
    receipt_header_text: string
    phone_number: string
    email: string
    address: string
  }
}

interface ReceiptPreviewProps {
  saleData: SaleDetailsData
  showPrintButton?: boolean
  onPrint?: () => void
}
```

**Features**:
- Clean, professional receipt layout
- Shows: business header, receipt number, date/time
- Shows: customer name and phone (or "Walk-in Customer")
- Shows: cashier name
- **Line items table**: Product SKU/Name, Quantity, Unit Price, Discount, Line Total
- Shows: Subtotal, Discount (if any), Tax (16% VAT if any), Total
- Shows: Payment method
- Shows: business footer messages and tax pin
- Print-friendly: CSS that hides unnecessary UI, uses good spacing
- Loads receipt settings from database (not hardcoded)

### Phase 2: Update Payment Panel Receipt Dialog
**File**: `components/pos/payment-panel.tsx` (MODIFY)

**Changes Required**:
1. After `handlePayment()` succeeds and receipt_number is generated:
   - Call `getSaleById(saleData.id)` to fetch full sale with items
   - Store full sale data in state (e.g., `fullSaleData`)
   - Load business settings (already done via `useReceiptSettings`)

2. Replace current receipt dialog content:
   - Instead of hardcoded "Payment Successful!" message
   - Render `<ReceiptPreview saleData={fullSaleData} showPrintButton={true} />`

3. Update buttons:
   - "Print & Continue": Calls `window.print()` then `handleComplete()`
   - "New Transaction": Just calls `handleComplete()` (closes receipt, clears cart)

4. Add print styling:
   - @media print CSS rules for clean printed output
   - Or use ReceiptPreview's built-in print styles

### Phase 3: Add Reprint to Sales History
**File**: `app/(dashboard)/sales-history/client.tsx` (MODIFY)

**Changes Required**:
1. Add new state:
   - `showReceiptPreview`: boolean for receipt preview modal
   - `selectedSaleForReceipt`: full sale data for printing

2. Add "Reprint Receipt" action button:
   - In the sales table row, add another icon button
   - Or add button in the details dialog

3. Implement reprint handler:
   - Click reprint → Fetch full sale via `getSaleById(sale.id)`
   - Fetch business settings via `useReceiptSettings()` hook
   - Show `<ReceiptPreview>` in a modal with print button
   - User clicks print or close

**Implementation Pattern**:
```typescript
const handleRePrint = async (saleId: string) => {
  const fullSaleData = await getSaleById(saleId)
  if (fullSaleData) {
    setSelectedSaleForReceipt(fullSaleData)
    setShowReceiptPreview(true)
  }
}
```

### Phase 4: Update Sales History Details Modal
**File**: `app/(dashboard)/sales-history/client.tsx` (MODIFY)

**Changes Required**:
1. When "View Details" is clicked, fetch full sale via `getSaleById()`
2. Enhance the details dialog to show line items:
   - Add items table showing: Product SKU/Name, Qty, Unit Price, Discount, Line Total
3. Add "Print Receipt" button in details modal
   - Opens receipt preview component for printing

## Database Schema Already Supports This

### Tables Used
- **sales**: receipt_number, subtotal, discount_amount, tax_amount, total_amount, payment_method, payment_status, cashier_id, customer_id, branch_id, created_at
- **sale_items**: product_id, quantity, unit_price, discount_percent, line_total, sale_id
- **products**: id, sku, name (used via products relation in sale_items)
- **business_settings**: business_name, phone, email, address, tax_pin, receipt_footer_text, thank_you_message
- **branch_receipt_settings**: receipt_header_text, phone_number, email, address, branch_id
- **branches**: id, name, code
- **users**: id, full_name
- **customers**: id, name, phone

### Key Queries Already Working
- `getSaleById()` returns full structure with items + products ✅
- `useReceiptSettings()` loads business/branch settings ✅
- Sales created with proper receipt_number ✅

## Implementation Order

1. **Create ReceiptPreview component** (NEW FILE - highest priority)
   - Format data correctly
   - Style for printing
   - Test with sample data

2. **Update payment-panel.tsx** (MODIFY)
   - Fetch full sale after createSale()
   - Pass to ReceiptPreview
   - Add print button functionality

3. **Update sales-history client.tsx** (MODIFY)
   - Fetch full sale in details modal
   - Show line items in table
   - Add print button
   - Add reprint capability

4. **Test End-to-End**
   - Complete sale in POS
   - Receipt shows real items
   - Print works
   - Reprint from sales history works

## Print Styling Approach

The receipt should use:
- **On Screen**: Full UI with close button, dark theme colors
- **On Print**: Clean black & white, receipt width (80mm equivalent), no UI chrome

**CSS Strategy**:
```css
.receipt-container {
  /* Screen styles */
}

@media print {
  .receipt-container {
    width: 80mm;
    margin: 0;
    padding: 10mm;
    background: white;
    color: black;
    font-family: monospace; /* Thermal printer style */
  }
  
  /* Hide non-print content */
  .receipt-action-buttons { display: none; }
  .dialog-close-button { display: none; }
}
```

## Testing Checklist

### POS Receipt Flow
- [ ] Complete a sale with 2-3 items
- [ ] Receipt preview shows correct items (SKU, product name, quantity, price)
- [ ] Receipt shows correct subtotal, discount, tax, total
- [ ] Receipt shows business details from settings
- [ ] Receipt shows cashier name
- [ ] Receipt shows customer name (or "Walk-in")
- [ ] Receipt shows payment method (Cash/M-Pesa/Paybill)
- [ ] "Print & Continue" button prints receipt and closes
- [ ] "New Transaction" button closes without printing
- [ ] After receipt closes, cart is cleared and ready for next sale

### Sales History Reprint
- [ ] Click "View Details" on a historical sale
- [ ] Details dialog shows line items (not currently showing)
- [ ] "Print Receipt" button opens receipt preview
- [ ] Receipt shows all correct data
- [ ] Can print from receipt preview
- [ ] Reprint shows same data
- [ ] Multiple sales can be reprinted without issues

### Print Output
- [ ] Receipt prints on standard A4 paper
- [ ] Layout is clean and readable
- [ ] No extra UI elements in printout
- [ ] Amounts are formatted with KSh (no currency symbol)
- [ ] Items list is complete and aligned
- [ ] Business info is at top, footer at bottom

## Files to Create
- `components/receipt-preview.tsx` - NEW

## Files to Modify
- `components/pos/payment-panel.tsx` - Add getSaleById fetch, pass full sale to receipt dialog
- `app/(dashboard)/sales-history/client.tsx` - Add items display and reprint capability

## No Database Changes Required
All needed data already exists in the schema. No migrations needed.

## Expected Outcome

**Before**: Users see a basic "Payment Successful" message with no item details, no print capability, can't reprint old receipts

**After**: 
- ✅ Full professional receipts showing all items and details
- ✅ Working print button that outputs printer-ready format
- ✅ Can reprint any historical receipt from Sales History
- ✅ All data comes from database (no hardcoded text)
- ✅ Business customization (settings, footer text) displays correctly
- ✅ Fast for cashier workflow (no unnecessary delays)
