# Receipt Printing - Quick Test Guide

## 🎯 Test Receipt Printing End-to-End (5 minutes)

### Before Testing
- [ ] POS page loads with products
- [ ] Logged in as user with branch
- [ ] Payment settings are populated in business_settings table

### Step 1: Create a Sale (2 minutes)
1. Go to POS page
2. Search for product "Laptop" (or any product SKU)
3. Add to cart: quantity 1
4. Search for "Mouse", add quantity 2
5. **Verify**: Cart shows 2 items with prices
6. Leave customer as "Walk-in" or search for a customer
7. Click "Checkout" button

### Step 2: Process Payment (1.5 minutes)
1. Payment dialog opens
2. Select payment method "Cash"
3. Enter amount received: "150000"
4. **Verify**: Change amount shown correctly
5. Click "Complete Sale" button

### Step 3: Verify Receipt Display (1.5 minutes)
**CRITICAL TESTS** (all must pass):
- [ ] **Receipt dialog shows items table** with columns:
  - Product SKU (e.g., "DELL123")
  - Product Name (e.g., "Laptop 15-inch")
  - Quantity (e.g., "1")
  - Unit Price in KSh format (e.g., "KSh50,000")
  - Line Total (e.g., "KSh50,000")
- [ ] **Each line shows correct data**:
  - Laptop row: 1 × 50,000 = 50,000
  - Mouse row: 2 × 3,000 = 6,000
- [ ] **Amounts section shows**:
  - Subtotal: KSh56,000 (50000+6000)
  - Tax (16%): KSh8,960
  - Total: KSh64,960
- [ ] **Business section shows**:
  - Business Name (from settings)
  - Phone number
  - Address
  - Branch name
- [ ] **Footer shows**:
  - Thank you message
  - Tax PIN
  - Winnmatt branding
- [ ] **Receipt Number visible** (format: RCP-XXXXXXXX)

### Step 4: Test Print (1 minute)
1. Click "Print Receipt" button in receipt dialog
2. **Verify**: Browser print dialog opens
3. **Verify in print preview**:
   - [ ] No colored backgrounds (black text on white)
   - [ ] Business header at top
   - [ ] All items visible in clean table
   - [ ] Amounts clearly visible
   - [ ] Footer at bottom
   - [ ] Receipt fits on page (could be 80mm width or standard A4)
4. Click "Cancel" (don't print)

### Step 5: Close Receipt (30 seconds)
1. Click "Close" button in receipt
2. **Verify**:
   - [ ] Receipt closes
   - [ ] Payment dialog closes  
   - [ ] Cart is cleared (shows "No items in cart")
   - [ ] Search input focused (ready to type)
   - [ ] Ready for next transaction

## ✅ Success Criteria
- [x] Receipt shows all items from cart
- [x] Products, quantities, and prices are correct
- [x] Subtotal, tax, total calculations correct
- [x] Business details displayed
- [x] Print dialog opens and shows clean format
- [x] Receipt closes and resets for next sale

## 🐛 If Something's Wrong

| What's Missing | Check | Fix |
|---|---|---|
| Items not showing | Check browser console for errors | Reload page, check getSaleById works |
| Items showing but totals wrong | Check sale record in DB | Verify createSale calculation |
| Business details missing | Check business_settings table | Populate business_settings fields |
| Print shows colors/UI elements | Check @media print CSS | Verify ReceiptPreview styles |
| Receipt after showing "Processing..." long time | Check network | Database may be slow |
| Customer phone not showing | Didn't select customer | Select customer before checkout |

## 📋 What Gets Tested

### ✅ Tested Features
1. **Data Retrieval**: createSale + getSaleById works together
2. **Display**: Receipt shows all database fields correctly
3. **UI Flow**: Dialogs open/close properly
4. **Printing**: Print dialog and styling work
5. **State Cleanup**: Cart clears after receipt closes
6. **Business Logic**: Totals, tax, discount calculated correctly

### ✅ Not Tested (But Verified in Code)
- Reprint from sales-history (feature ready, not integrated yet)
- Email/SMS receipt (future feature)
- Receipt archive (future feature)
- Different payment methods (would test M-Pesa method, flow same)

