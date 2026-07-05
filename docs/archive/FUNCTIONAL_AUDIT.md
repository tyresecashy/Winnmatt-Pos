# Comprehensive Functional Audit - WINNMATT POS

**Date:** April 4, 2026
**Status:** Pre-Implementation Phase 1
**Scope:** All major pages in dashboard

---

## Executive Summary

**CRITICAL FINDING:** Entire dashboard is using mock data. UI exists but **business logic is disconnected**. 
- ✅ UI components built correctly (buttons, tables, filters exist)
- ❌ No event handlers wired to buttons (dead buttons)
- ❌ No modals/dialogs for add/edit operations
- ❌ Filters update local state but don't query database
- ❌ Export buttons have no implementation
- ✅ Database schema exists and seed data loaded
- ✅ Server actions partially created (products-actions.ts, sales-actions.ts exist)
- ❌ Pages not importing server actions

---

## Page-by-Page Audit

### 1. **Products Page** [app/(dashboard)/products/page.tsx]

#### Status: Dead UI
- **Import:** `import { products, categories, branches, formatKSh } from "@/lib/mock-data"`
- **Data Source:** 100% mock (18 hardcoded products)
- **Buttons:**
  - ✅ UI: "Add Product" button exists
  - ❌ Handler: NO onClick event (dead button)
  - ❌ Modal: NO modal/dialog for form
  - ❌ Result: Clicking does nothing

- **Edit/Delete:**
  - ✅ UI: Dropdown menu with "Edit" and "Delete" items
  - ❌ Handlers: NO onClick events (dead menu items)
  - ❌ Result: Clicking does nothing

- **Filters (Working Locally Only):**
  - ✅ Search term updates state (works)
  - ✅ Category filter updates state (works)
  - ❌ BUT: Still shows mock data (not filtered from DB)

- **Stats Cards:**
  - ❌ "Total Products": Counts mock data (18)
  - ❌ "Low Stock": Counts mock data
  - ❌ Not reflecting real database

#### Dependencies Needed:
- Dialog/Modal component (exists: @/components/ui/dialog)
- Form component (exists: @/components/ui/form)
- Server actions for CRUD (EXISTS: @/lib/products-actions.ts)

#### Implementation Needed:
1. Create AddProductDialog component
2. Wire "Add Product" button to open dialog
3. Create EditProductDialog component
4. Wire dropdown "Edit" to open edit dialog
5. Replace mock data with `getProductsForPOS()` or similar
6. Wire "Delete" to `deleteProduct()` server action
7. Add form validation
8. Add success/error feedback
9. Refetch products after CRUD operation

---

### 2. **Suppliers Page** [app/(dashboard)/suppliers/page.tsx]

#### Status: Dead UI
- **Import:** `import { suppliers, formatKSh } from "@/lib/mock-data"`
- **Data Source:** 100% mock (5 hardcoded suppliers)
- **Buttons:**
  - ✅ UI: "Add Supplier" button exists
  - ❌ Handler: NO onClick event (dead button)
  - ❌ Modal: NO modal/dialog for form

- **Edit Dropdown:**
  - ✅ UI: "Edit" menu item exists
  - ❌ Handler: NO handler

- **Filters:**
  - ✅ Search works locally (not on DB)

#### Root Cause:
- No server actions for supplier CRUD
- No dialog/form component
- No event handlers

#### Implementation Needed:
1. Create server actions: `createSupplier()`, `updateSupplier()`, `deleteSupplier()`
2. Create SupplierDialog component
3. Wire buttons to open dialog
4. Load real supplier data from DB

---

### 3. **Customers Page** [app/(dashboard)/customers/page.tsx]

#### Status: Dead UI
- **Import:** `import { customers, formatKSh, formatDate } from "@/lib/mock-data"`
- **Data Source:** 100% mock (6 hardcoded customers)
- **Buttons:**
  - ✅ UI: "Add Customer" button exists
  - ❌ Handler: NO onClick event

- **Detail Dialog:**
  - ✅ UI: Dialog exists in JSX (DialogTrigger on customer rows)
  - ❌ BUT: Dialog never opens (no state management for opening/closing)
  - ❌ selectedCustomer state exists but never triggers dialog

#### Root Cause:
- Dialog code exists but never opens (missing isOpen state or trigger logic)
- Buttons have no onClick handlers
- No CRUD server actions

#### Implementation Needed:
1. Create server actions for customer CRUD
2. Fix dialog open/close logic
3. Wire add button to open dialog
4. Replace mock data with real queries

---

### 4. **Business Accounts Page** [app/(dashboard)/business-accounts/page.tsx]

#### Status: Not yet examined (assumed similar to Customers)
- Likely uses mock data
- Likely has dead "Add" button
- Likely missing CRUD handlers

---

### 5. **Sales History Page** [app/(dashboard)/sales-history/page.tsx]

#### Status: Partially Dead
- **Import:** `import { recentSales, branches, formatKSh, formatTime, formatDate } from "@/lib/mock-data"`
- **Data Source:** 100% mock (mock sales transactions)

- **Filters (All Working Locally):**
  - ✅ Search by receipt/customer (works)
  - ✅ Branch filter (works)
  - ✅ Payment method filter (works)
  - ❌ BUT: Not filtering real database (filtering mock data)

- **Export Button:**
  - ✅ UI: "Download" button with icon exists
  - ❌ Handler: NO onClick event (dead button)
  - ❌ Result: Clicking does nothing

- **Stats:**
  - ❌ "Total Sales (Shown)": Shows mock total
  - ❌ "Transactions": Counts mock data
  - ❌ "Average Transaction": Calculated from mock

#### Root Cause:
- Using mock data instead of real sales from database
- Export button not wired
- Real sales data not loaded

#### Implementation Needed:
1. Load real sales from database (use `getSales()` from sales-actions.ts)
2. Apply filters to DB query
3. Implement export to CSV functionality
4. Wire Export button

---

### 6. **Reports Page** [app/(dashboard)/reports/page.tsx]

#### Status: Mostly Dead
- **Data Source:** 100% mock
  - `weeklySalesData`, `monthlySalesData`, `topSellingProducts`, `todaySalesData` - ALL MOCK
  - Hardcoded arrays for branch performance, cashier performance, etc.

- **Date Filter:**
  - ✅ UI: Select dropdown exists (Today/Week/Month/Quarter)
  - ❌ Handler: NO onChange handler
  - ❌ Filter does NOT change displayed data
  - ❌ Same data always shown regardless of selection

- **Export Button:**
  - ✅ UI: "Download" button exists
  - ❌ Handler: NO onClick event (dead button)

- **Tab Navigation:**
  - ✅ UI: Tabs work (Sales/Branches/Products/Inventory/Cashiers)
  - ✅ Behavior: Switching tabs works (local state)
  - ❌ BUT: All tabs show mock data

#### Root Cause:
- All data hardcoded
- Period selector has no effect on data
- Export not implemented
- Not querying database for reports

#### Implementation Needed:
1. Load real sales data from database
2. Wire date filter to query different date ranges
3. Implement real calculations for each tab
4. Implement CSV export
5. Wire Export button

---

### 7. **Users Page** [app/(dashboard)/users/page.tsx]

#### Status: Dead UI
- **Import:** `import { users, formatDate, formatTime } from "@/lib/mock-data"`
- **Data Source:** 100% mock (4 hardcoded users)

- **Add User Button:**
  - ✅ UI: "Add User" button exists
  - ❌ Handler: NO onClick event (dead button)
  - ❌ Modal: NO modal for form

- **Edit/Delete Dropdown:**
  - ✅ UI: Menu items exist
  - ❌ Handlers: NO onClick events

- **Filters:**
  - ✅ Search works locally

#### Root Cause:
- No user CRUD server actions
- No dialog/form for user management
- No event handlers

#### Implementation Needed:
1. Create server actions (already in custom users table provisioning)
2. Create user management dialog
3. Wire buttons
4. Load real users from database

---

### 8. **Inventory Page** [app/(dashboard)/inventory/page.tsx]

#### Status: Likely Similar to Products
- Assumed to use mock data
- Likely dead buttons

---

### 9. **POS Page** [app/(dashboard)/pos/page.tsx]

#### Status: **PARTIALLY WORKING** ✅
- **Data Source:**  Mock products initially
- **Cart Logic:** ✅ **IMPLEMENTED** (add to cart, remove, update quantity, discount logic)
- **But:**
  - ❌ Products loaded from `mock-data` (should use real database products)
  - ❌ Checkout not saving to database (needs `createSale()` integration)
  - ❌ Inventory not checked during checkout
  - ✅ UI components fully functional

#### What's Working:
- Add to cart functionality
- Update quantity/discount
- Calculate totals
- Payment panel UI

#### What's Missing:
- Real product data (should use `getProductsForPOS()`)
- Actual checkout (should call `createSale()`)
- Inventory validation
- Stock reduction after sale

---

## Summary Table

| Page | Mock Data | Dead Buttons | Missing Modals | Dead Filters | Dead Exports |
|------|-----------|--------------|----------------|--------------|--------------|
| Products | ✅ | ✅ | ✅ | ❌ | N/A |
| Inventory | ✅ | ✅ | ✅ | ? | N/A |
| Suppliers | ✅ | ✅ | ✅ | ❌ | N/A |
| Customers | ✅ | ✅ | ⚠️ | ❌ | N/A |
| Business Accounts | ? | ✅ | ? | ? | N/A |
| Sales History | ✅ | ❌ | N/A | ❌ | ✅ |
| Reports | ✅ | ❌ | N/A | ✅ | ✅ |
| Users | ✅ | ✅ | ✅ | ❌ | N/A |
| POS | ✅* | ❌ | N/A | N/A | N/A |

**Legend:**
- ✅ = Yes, this is an issue
- ❌ = No, not an issue
- ⚠️ = Partially
- N/A = Not applicable
- \* = POS uses mock products but has working cart logic

---

## Root Causes (Common Pattern)

1. **All pages import mock-data** - Data is hardcoded, not from database
2. **No event handlers on buttons** - onClick events never defined
3. **No dialogs/modals for forms** - Add/Edit buttons have nowhere to go
4. **No server action integration** - Pages don't call database functions
5. **Filters work locally only** - Update state but don't query database
6. **Export buttons unimplemented** - No file generation or download logic

---

## Implementation Roadmap

### Phase 1: Products CRUD ⬅️ **START HERE**
1. Create dialog components for Add/Edit
2. Wire Add button to open Add dialog
3. Wire Edit menu to open Edit dialog
4. Create form with validation
5. Load products from database (not mock)
6. Implement delete with confirmation
7. Add success/error feedback
8. Re-fetch after operations

### Phase 2: Suppliers CRUD
1. Create supplier CRUD server actions
2. Create dialogs
3. Wire buttons
4. Load real supplier data

### Phase 3: Customers CRUD
1. Fix customer dialog (already exists but broken)
2. Create CRUD server actions
3. Wire buttons
4. Load real customer data

### Phase 4: POS Real Checkout
1. Replace mock products with real data
2. Implement inventory validation
3. Implement checkout to database
4. Handle stock reduction
5. Add receipt generation

### Phase 5: Sales History Real Data
1. Load from database
2. Apply filters to DB query
3. Implement CSV export

### Phase 6: Reports Filters & Exports
1. Wire date filter to actual queries
2. Load real data for all tabs
3. Implement exports

### Phase 7: User Management
1. Create user CRUD (leverage existing provisioning)
2. Create dialogs
3. Wire buttons

### Phase 8: Business Accounts
1. Repeat CRUD pattern

---

## Action Items For Phase 1

✅ Create ProductDialog component (Add & Edit modes)
✅ Create ProductForm with validation
✅ Wire Add Product button
✅ Wire Edit menu item
✅ Wire Delete menu item
✅ Load products from database
✅ Integrate server actions
✅ Add loading/error states
✅ Add success feedback
✅ Test all operations
✅ Document manual testing steps

