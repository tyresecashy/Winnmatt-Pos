# Suppliers & Purchases System - Comprehensive Audit

**Date:** April 5, 2026  
**Status:** PRELIMINARY IMPLEMENTATION - Schema defined, UI mockup only, zero database connectivity

---

## EXECUTIVE SUMMARY

The Suppliers and Purchases system has **database schema ready but NO functional implementation**:
- ✅ Database tables: `suppliers`, `purchase_orders`, `purchase_order_items` created in migrations
- ✅ TypeScript types defined in `db.types.ts`
- ✅ Mock data: 4 suppliers + 3 purchase orders in `mock-data.ts`
- ❌ **CRITICAL:** No server actions (no `suppliers-actions.ts` or `purchase-actions.ts`)
- ❌ **CRITICAL:** UI pages show MOCK DATA only
- ❌ **CRITICAL:** No CRUD operations wired to database
- ❌ **CRITICAL:** No inventory update logic on receipt
- ❌ **CRITICAL:** No stock movement recording

All buttons ("Add Supplier", "New Purchase Order", "Edit", "View Orders", etc.) are **non-functional**.

---

## 1. SUPPLIERS PAGE

### Location
[app/(dashboard)/suppliers/page.tsx](app/(dashboard)/suppliers/page.tsx)

### Current Implementation
- **Status:** UI mockup with search/filter
- **Data Source:** Mock data from `lib/mock-data.ts` (`suppliers` array)
- **Search:** Working locally on:
  - Supplier name
  - Contact person name
  - Category

### Data Displayed (ALL MOCK)
```typescript
// From mock-data.ts
suppliers = [
  { id, name, contact, phone, email, category, paymentTerms, balance },
  ...
]

Example:
- Kenya Breweries Ltd | Samuel Ndungu | 0722111222 | Beverages | Net 30 | KSh 125,000
- Brookside Dairy | Faith Njeri | 0733222333 | Dairy & Eggs | COD | KSh 0
- Bidco Africa | Patrick Kimani | 0711333444 | Cooking Essentials | Net 14 | KSh 85,000
- Unilever Kenya | Christine Auma | 0799444555 | Household | Net 21 | KSh 42,000
```

### UI Metrics (Hardcoded)
| Metric | Value | Source |
|--------|-------|--------|
| Total Suppliers | 4 | Mock data length |
| Total Payables | KSh 252,000 | Sum of all balances |
| Active Orders | 2 | Hardcoded - not linked to actual POs |

### CRUD Operations
| Operation | Status | Details |
|-----------|--------|---------|
| Create (Add Supplier) | ❌ Non-functional | Button exists, no handler |
| Read | ✅ Partial | Mock data only, no database |
| Update (Edit) | ❌ Non-functional | Menu item exists, no handler |
| Delete | ❌ Missing | No Delete option in dropdown |
| View Orders | ❌ Non-functional | Menu item exists, no dialog/page |
| Record Payment | ❌ Non-functional | Menu item exists, no handler |

### Contact Details Shown
- ✅ Supplier name
- ✅ Contact person name
- ✅ Phone number
- ✅ Email address
- ✅ Category (badge)
- ✅ Payment terms (badge)
- ✅ Balance owed (KSh format)

### Search/Filter Functionality
- ✅ **Live search** on supplier name, contact person, category (case-insensitive)
- ❌ No filtering by category dropdown
- ❌ No filtering by payment terms
- ❌ No filtering by balance range
- ❌ No sorting by column headers

### Dropdown Actions
```
More (...) menu contains:
1. Edit - ❌ Not functional
2. View Orders - ❌ Not functional (no supplier PO history page)
3. Record Payment - ❌ Not functional (no payment dialog)
```

---

## 2. PURCHASES PAGE

### Location
[app/(dashboard)/purchases/page.tsx](app/(dashboard)/purchases/page.tsx)

### Current Implementation
- **Status:** UI mockup with search, status filter, and detail actions
- **Data Source:** Mock data from `lib/mock-data.ts` (`purchaseOrders` array)
- **Search:** Working locally on:
  - Order number (PO-20260328-001, etc.)
  - Supplier name

### Data Displayed (ALL MOCK)
```typescript
// From mock-data.ts
purchaseOrders = [
  {
    id, orderNo, supplier, items, totalValue, status, orderDate, deliveryDate
  },
  ...
]

Example:
- PO-20260328-001 | Kenya Breweries Ltd | 8 items | KSh 125,000 | delivered | 2026-03-25 to 2026-03-28
- PO-20260330-001 | Bidco Africa | 5 items | KSh 85,000 | pending | 2026-03-30 to (null)
- PO-20260329-001 | Unilever Kenya | 12 items | KSh 42,000 | in-transit | 2026-03-29 to 2026-03-31
```

### UI Metrics (Hardcoded)
| Metric | Value | Source |
|--------|-------|--------|
| Total Orders | 3 | Mock data length |
| Total Value | KSh 252,000 | Sum of all order values |
| Pending | 1 | Filter mock data (status='pending') |
| In Transit | 1 | Filter mock data (status='in-transit') |

### Purchase Workflow Status
- **Current Worflow:** Limited status states shown
- **Status States Available:** `pending`, `in-transit`, `delivered`
- **Missing Statuses:** `draft`, `received`, `cancelled` (defined in DB but UI only shows 3)
- **Stock-in Process:** ❌ NO (not implemented)
- **Inventory Update:** ❌ NO (no logic on "Mark as Received")
- **Stock Movement Recording:** ❌ NO

### CRUD Operations
| Operation | Status | Details |
|-----------|--------|---------|
| Create (New PO) | ❌ Non-functional | Button exists, no handler |
| Read | ✅ Partial | Mock data with search/filter |
| Update (Change Status) | ❌ Partial | "Mark as Received" shows conditionally but not functional |
| Delete | ❌ Missing | No delete option |
| View Details | ❌ Non-functional | Menu item exists, no detail page/dialog |

### How Inventory Updates Happen
**CURRENT:** ❌ DOES NOT HAPPEN
- No "Mark as Received" action implemented
- No `receivePurchaseOrderItems()` function
- No inventory update trigger
- No stock_movements entry on receipt

### Dropdown Actions
```
More (...) menu contains:
1. View Details - ❌ Not functional (no detail modal/page)
2. Mark as Received - ❌ Conditional (only on "in-transit")
                     ❌ Not functional (no receipt workflow)
```

### Status Filtering
- ✅ Dropdown filter for status: All, Pending, In Transit, Delivered
- ✅ Working with mock data
- ❌ No multi-select filtering

---

## 3. DATABASE SCHEMA

### Suppliers Table
```sql
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  payment_terms TEXT,
  balance INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Missing fields for full supplier management:
-- - category (hardcoded in mock but not in DB)
-- - location/address
-- - tax_id
-- - account_manager
-- - status (active/inactive)
-- - website
-- - preferred_payment_method
```

### Purchase Orders Table
```sql
CREATE TABLE purchase_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  branch_id UUID NOT NULL REFERENCES branches(id),
  status TEXT CHECK (status IN ('draft','pending','received','cancelled')) DEFAULT 'draft',
  subtotal INTEGER NOT NULL DEFAULT 0,
  tax_amount INTEGER NOT NULL DEFAULT 0,
  total_amount INTEGER NOT NULL DEFAULT 0,
  expected_delivery TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Status states: draft → pending → received (or cancelled)
-- Missing fields:
-- - delivered_date (actual receipt date)
-- - created_by (user_id who created PO)
-- - approved_by (user_id who approved)
-- - approval_date
-- - po_number generation strategy
```

### Purchase Order Items Table
```sql
CREATE TABLE purchase_order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id),
  product_id UUID NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL,
  unit_price INTEGER NOT NULL,
  line_total INTEGER NOT NULL,
  received_quantity INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Fields explained:
-- - quantity: ordered quantity
-- - received_quantity: partial receipt tracking
-- - Can handle partial receipts
-- Missing:
-- - acceptance_notes
-- - quality_check_status
```

### Related Tables (Support)
- **Stock Movements Table:** Tracks receipt type: `INSERT INTO stock_movements (type='receipt', ...)`
- **Index:** `idx_purchase_orders_supplier` - Fast lookup by supplier
- **Index:** `idx_purchase_orders_status` - Fast filtering by status

---

## 4. DATABASE SEEDING

### Suppliers Seed Data (db-seed.sql)
```sql
INSERT INTO suppliers (...) VALUES
  ('Fresh Beverages Ltd', 'Mr. Kiprop', '0701234567', ..., 'Net 30', 150000),
  ('Dairy Farms Kenya', 'Ms. Wanjiru', '0712345678', ..., 'Net 15', 200000),
  ('Snacks Wholesale', 'Mr. Ochieng', '0723456789', ..., 'Net 45', 350000),
  ('Bakery Supplies', 'Ms. Nyambura', '0734567890', ..., 'COD', 0),
  ('Commodity Trading', 'Mr. Kamau', '0745678901', ..., 'Net 30', 500000);
```
- ✅ **5 suppliers** seeded to database
- ✅ Different payment terms and balances
- **Mismatch:** Mock data has 4 different suppliers with different names

### Purchase Orders Seed Data
❌ **NONE** - No INSERT statements for purchase_orders or purchase_order_items in db-seed.sql
- Manual PO creation not yet tested
- Database starts empty for POs

### Mock Data in lib/mock-data.ts
```typescript
suppliers = [
  { id: 'sup-001', name: 'Kenya Breweries Ltd', ... },
  { id: 'sup-002', name: 'Brookside Dairy', ... },
  { id: 'sup-003', name: 'Bidco Africa', ... },
  { id: 'sup-004', name: 'Unilever Kenya', ... },
];

purchaseOrders = [
  { id: 'po-001', orderNo: 'PO-20260328-001', supplier: 'Kenya Breweries Ltd', ... },
  { id: 'po-002', orderNo: 'PO-20260330-001', supplier: 'Bidco Africa', ... },
  { id: 'po-003', orderNo: 'PO-20260329-001', supplier: 'Unilever Kenya', ... },
];
```

**Issue:** Mock data suppliers ≠ seeded suppliers (different names, IDs are fake)

---

## 5. MISSING SERVER ACTIONS

### Critical Missing Files
| File | Purpose | Status |
|------|---------|--------|
| `lib/suppliers-actions.ts` | Supplier CRUD + payments | ❌ DOES NOT EXIST |
| `lib/purchase-actions.ts` | PO creation, receipt, inventory | ❌ DOES NOT EXIST |

### Required Actions (NOT IMPLEMENTED)

#### Suppliers Actions Needed:
```typescript
// CRUD
getSuppliers(branchId?: string): Supplier[]
getSupplierById(id: string): Supplier
createSupplier(data: SupplierInput): Supplier
updateSupplier(id: string, data: SupplierInput): Supplier
deleteSupplier(id: string): boolean

// Payments
getSupplierBalance(id: string): number
recordSupplierPayment(id: string, amount: number): Payment
getSupplierPaymentHistory(id: string): Payment[]

// Orders
getSupplierOrders(id: string): PurchaseOrder[]
getSupplierStats(id: string): SupplierStats
```

#### Purchase Orders Actions Needed:
```typescript
// CRUD
getPurchaseOrders(filters?: { status?, supplierId?, branchId? }): PurchaseOrder[]
getPurchaseOrderById(id: string): PurchaseOrder (with items)
createPurchaseOrder(data: CreatePOInput): PurchaseOrder
updatePurchaseOrder(id: string, data: UpdatePOInput): PurchaseOrder
cancelPurchaseOrder(id: string): PurchaseOrder

// Workflow
changePoStatus(id: string, newStatus: string): PurchaseOrder
markAsReceived(id: string, receivedItems?: ReceivedItem[]): PurchaseOrder

// Inventory Integration
receivePurchaseOrderItems(poId: string, receivedItems: ReceivedItem[]): {
  updatedInventory: InventoryRecord[]
  stockMovements: StockMovement[]
}

// Reporting
getPurchaseOrderStats(): POStats
```

---

## 6. COMPONENT STRUCTURE

### No Dedicated Supplier Components
```
components/
  └─ (no suppliers/ directory)
      └─ No dialogs, forms, etc.
```

### No Dedicated Purchase Components
```
components/
  └─ (no purchases/ directory)
      └─ No detail modals, receipt forms, etc.
```

### Required Components (NOT CREATED)
- `<AddSupplierDialog />` - Form to add supplier
- `<EditSupplierDialog />` - Form to edit supplier
- `<SupplierDetailsDialog />` - Supplier details + order history
- `<CreatePurchaseOrderDialog />` - Multi-step PO creation with line items
- `<PurchaseOrderDetailsDialog />` - PO details + items + receipt
- `<ReceiveGoodsDialog />` - Receive items, select quantities, quality check
- `<SupplierPaymentDialog />` - Record payment against balance
- `<PurchaseOrderItemsTable />` - Table with item details within PO

---

## 7. MOCK DATA ANALYSIS

### Suppliers Mock Data
```typescript
suppliers = [
  {
    id: 'sup-001',
    name: 'Kenya Breweries Ltd',
    contact: 'Samuel Ndungu',
    phone: '0722111222',
    email: 'orders@kbl.co.ke',
    category: 'Beverages',              // ← NOT in DB schema
    paymentTerms: 'Net 30',
    balance: 125000                     // KSh
  },
  // ... 3 more
];
```

**Mismatch:** `category` field is in mock but NOT in actual database schema
- UI filters/displays category ✅
- Database has no category column ❌

### Purchase Orders Mock Data
```typescript
purchaseOrders = [
  {
    id: 'po-001',
    orderNo: 'PO-20260328-001',
    supplier: 'Kenya Breweries Ltd',
    items: 8,                           // ← Count only, no actual items
    totalValue: 125000,                 // KSh
    status: 'delivered',
    orderDate: '2026-03-25',
    deliveryDate: '2026-03-28'
  },
  // ... 2 more
];
```

**Issues with mock PO data:**
- ✅ Status values match DB schema
- ❌ No `purchase_order_items` mock data (items count only)
- ❌ No pricing breakdown shown
- ❌ No received_quantity tracking

### Hardcoded Values in UI
| Value | Location | Should Be |
|-------|----------|-----------|
| "Active Orders: 2" | Suppliers page card | Sum of POcount by status ≠ 'cancelled' |
| status colors | Purchases page | Correct mapping |
| Empty delivery date "-" | Purchases page | Handled correctly in nulls |

---

## 8. INVENTORY & STOCK INTEGRATION

### How Stock Should Update on Receipt
**CURRENT:** ❌ NOT IMPLEMENTED

**SHOULD BE:**
```typescript
async function receivePurchaseOrderItems(
  orderId: string,
  receivedItems: [{ itemId, receivedQty, notes }]
) {
  // 1. Update purchase_order_items.received_quantity
  // 2. Create stock_movements entry (type='receipt')
  // 3. Update inventory quantities per branch
  // 4. Check if PO fully received → mark status='received'
  // 5. Return updated inventory state
}
```

### Stock Movements Table Connection
- ✅ Schema supports: `type IN ('sale', 'receipt', 'transfer', 'adjustment', 'damage')`
- ❌ No receipt workflow to trigger `type='receipt'` entries
- ❌ No reference linking to `purchase_order_id`

### Partial Receipt Handling
- ✅ Schema supports: `received_quantity` field in `purchase_order_items`
- ❌ No UI or logic for partial receipts
- ❌ No "Receive" dialog for selecting quantities

---

## 9. WORKFLOW GAPS

### Purchase Order Lifecycle (SHOULD BE)
```
draft → (submit) → pending → (goods arrive) → received/cancelled
```

### Current UI Status Mapping
```
pending → in-transit → delivered
```

**MISMATCH:** 
- DB defines: `draft`, `pending`, `received`, `cancelled`
- UI shows: `pending`, `in-transit`, `delivered`
- No handling of `draft` status
- No mapping for actual `received` status

### Missing Workflow Steps
1. ❌ **Create Draft PO** - Select supplier, branch, add items
2. ❌ **Submit for Approval** - Draft → Pending (if approval flow exists)
3. ❌ **Receive Goods** - Scan items, quantities, quality check
4. ❌ **Record Receipt** - Update inventory, create stock_movements, mark status
5. ❌ **Handle Partial Shipments** - Receive some items, await rest
6. ❌ **Cancel/Reject** - If damaged or not needed

---

## 10. API/DATABASE CONNECTIVITY

### Current State: ✅ ZERO

### Pages Connected to DB?
| Page | Connected | Details |
|------|-----------|---------|
| Suppliers | ❌ NO | Uses mock `lib/mock-data.ts` |
| Purchases | ❌ NO | Uses mock `lib/mock-data.ts` |

### Data Flow (What SHOULD Happen)
```
Page → Server Action → DB Query → Type Safety (db.types.ts) → UI
  ❌     ❌ (missing)  ✅ exists   ✅ exists                   ✅
```

### No Error Handling for:
- Network failures
- Missing suppliers
- Invalid PO numbers
- Duplicate orders
- Stock unavailability on receipt

---

## 11. VALIDATION & BUSINESS RULES

### Missing Validations
- ❌ Supplier name uniqueness
- ❌ Email format
- ❌ Phone format
- ❌ Payment terms against allowed values
- ❌ PO quantity > 0
- ❌ Unit price > 0
- ❌ Received quantity ≤ ordered quantity
- ❌ Delivery date ≥ order date
- ❌ Cannot receive goods for cancelled PO
- ❌ Cannot delete supplier with active orders

---

## 12. SUMMARY TABLE: Current vs Complete

| Feature | Suppliers | Purchases | Status |
|---------|-----------|-----------|--------|
| **Display** | ✅ Mock | ✅ Mock | UI only |
| **Search** | ✅ Working | ✅ Working | Client-side |
| **Filter** | ✅ Local | ✅ Local | No DB |
| **Sort** | ❌ Missing | ❌ Missing | - |
| **Add** | ❌ Non-functional | ❌ Non-functional | Button exists |
| **Edit** | ❌ Non-functional | ❌ Non-functional | Menu item |
| **Delete** | ❌ Missing | ❌ Missing | No UI |
| **View Details** | ❌ Non-functional | ❌ Non-functional | Menu item |
| **Database Read** | ❌ NO | ❌ NO | All mock |
| **Database Write** | ❌ NO | ❌ NO | No actions |
| **Inventory Update** | N/A | ❌ NO | Critical |
| **Stock Movements** | N/A | ❌ NO | Critical |
| **Payment Tracking** | ❌ NO | N/A | - |
| **Reporting** | ❌ NO | ❌ NO | - |

---

## 13. IMPLEMENTATION ROADMAP

### Phase 1: Data Layer (1-2 days)
1. Create `lib/suppliers-actions.ts`
   - GET, POST, PUT, DELETE functions
   - Error handling, validation
   
2. Create `lib/purchase-actions.ts`
   - GET, POST, PUT for POs
   - `receivePurchaseOrderItems()` - core functionality
   - Stock movement recording

3. Integration with supabaseAdmin client (follow `customers-actions` pattern)

### Phase 2: Components (2-3 days)
1. Create supplier dialogs (Add, Edit, Details)
2. Create PO dialogs (Create, Details, Receive)
3. Add form validation + error messages

### Phase 3: Page Integration (1-2 days)
1. Connect pages to server actions
2. Replace mock data with real data
3. Add loading states, error handling

### Phase 4: Workflows (2-3 days)
1. Implement "Mark as Received" → inventory update
2. Implement PO creation flow
3. Test partial receipts

### Phase 5: Polish (1 day)
1. Add sorting, pagination
2. Add reporting queries
3. Performance optimization

---

## 14. CRITICAL ISSUES

### 🔴 Blocker #1: No Inventory Update on Receipt
When user clicks "Mark as Received", **nothing happens**. No inventory updated, no stock_movements created.

### 🔴 Blocker #2: Mock vs Real Data Mismatch
Suppliers page shows 4 mock suppliers, but DB has 5 real (seeded) suppliers. Users will see different data when connected to DB.

### 🔴 Blocker #3: Database Schema/UI Mismatch  
Mock includes "category" field that doesn't exist in DB schema. UI will break when loading real data.

### 🔴 Blocker #4: Status State Mismatch
DB defines: `draft`, `pending`, `received`, `cancelled`  
UI shows: `pending`, `in-transit`, `delivered`  
No mapping strategy defined.

### 🟡 Issue #5: No Partial Receipt Support
UI and workflow designed for full receipt only. Cannot handle partial shipments or create "back orders".

### 🟡 Issue #6: No Approval Workflow
No distinction between who creates, who approves, who receives. Might be needed for audit trail.

---

## 15. FILES & LOCATIONS

### Existing Files
- [app/(dashboard)/suppliers/page.tsx](app/(dashboard)/suppliers/page.tsx) - 165 lines, mock UI
- [app/(dashboard)/purchases/page.tsx](app/(dashboard)/purchases/page.tsx) - 200+ lines, mock UI
- [lib/mock-data.ts](lib/mock-data.ts) - Mock suppliers & POs
- [lib/db.types.ts](lib/db.types.ts) - Type definitions ✅
- [db-migrations.sql](db-migrations.sql) - Schema ✅
- [db-seed.sql](db-seed.sql) - Supplier seed data ✅

### Missing Files (Must Create)
- `lib/suppliers-actions.ts` - Server actions
- `lib/purchase-actions.ts` - Server actions
- `components/suppliers/` - Dialog, form components
- `components/purchases/` - Dialog, form components

---

## CONCLUSION

**The Suppliers & Purchases system is a UI shell with zero backend connectivity.** All data is mock, all buttons are non-functional. The database schema is well-designed and seed data exists, but there is no bridge between the frontend and database.

**To move to production, must:**
1. Implement server actions
2. Connect UI to database
3. Build inventory receipt workflow
4. Resolve schema/UI mismatches
5. Add validation and error handling

**Estimated effort:** 1-2 weeks for full implementation from current state.

