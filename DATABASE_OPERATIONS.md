# Database Operations & Server Actions Reference

## Overview

All database operations use Next.js Server Actions (`lib/actions.ts`). These are type-safe functions that run on the server and communicate securely with Supabase.

---

## Available Server Actions

### Product Operations

#### `getProducts()`
Fetch all products with their categories.

```typescript
const products = await getProducts()
// Returns: Array of Product with category info
```

**Used in:**
- Dashboard (product recommendations)
- POS terminal (product search)
- Product catalog page

---

#### `getProductsByCategory(categoryId)`
Fetch products filtered by category.

```typescript
const beverageProducts = await getProductsByCategory('category-uuid')
```

**Used in:**
- Product page (category filtering)
- POS (browse by category)

---

### Inventory Operations

#### `getInventory(branchId)`
Fetch current inventory levels for a branch.

```typescript
const inventory = await getInventory('branch-uuid')
// Returns: [{product, quantity, ...}, ...]
```

**Used in:**
- Inventory page
- Dashboard (low stock alerts)
- POS (check availability)

---

#### `reduceInventory(productId, branchId, quantity)`
Reduce inventory after sale (internal use).

```typescript
await reduceInventory('product-uuid', 'branch-uuid', 5)
// Subtracts 5 from current quantity
```

**Called by:** `completeSale()` function

---

### Category Operations

#### `getCategories()`
Fetch all product categories.

```typescript
const categories = await getCategories()
// Returns: Array of Category objects
```

**Used in:**
- Product page (filter sidebar)
- Reports (category analysis)
- Dashboard (category breakdown)

---

### Customer Operations

#### `getCustomers()`
Fetch all customers.

```typescript
const customers = await getCustomers()
// Returns: Array of Customer with loyalty points, credit info
```

**Used in:**
- Customer page (customer list)
- POS (customer lookup)
- Dashboard (top customers)

---

### Supplier Operations

#### `getSuppliers()`
Fetch all suppliers.

```typescript
const suppliers = await getSuppliers()
// Returns: Array of Supplier with balance and terms
```

**Used in:**
- Supplier page
- Purchases page (PO creation)

---

### Branch Operations

#### `getBranches()`
Fetch all branches.

```typescript
const branches = await getBranches()
// Returns: Array of Branch objects
```

**Used in:**
- Branch selector (sidebar)
- Dashboard (branch comparison)
- Reports (branch analytics)

---

### Sales Operations

#### `getSales(branchId, limit)`
Fetch sales transactions for a branch.

```typescript
const sales = await getSales('branch-uuid', 50)
// Returns: Latest 50 sales with items and customer info
```

**Used in:**
- Sales history page
- Dashboard (recent transactions)
- Reports (daily sales)

---

#### `createSale(saleData)`
Create a new sales transaction.

```typescript
const sale = await createSale({
  branch_id: 'branch-uuid',
  cashier_id: 'user-uuid',
  customer_id: 'customer-uuid' || null,
  subtotal: 10000,            // in KShs (integers, no decimals)
  discount_amount: 1000,
  tax_amount: 0,
  total_amount: 9000,
  payment_method: 'cash',     // or 'card', 'bank_transfer', 'cheque', 'credit'
  payment_status: 'completed', // 'pending' or 'failed'
  receipt_number: 'RCP-20250404-001',
  notes: 'Optional notes'
})
// Returns: Created sale with ID for linking items
```

**Called by:** POS checkout flow

---

#### `createSaleItems(items)`
Record individual items in a sale.

```typescript
await createSaleItems([
  {
    sale_id: 'sale-uuid',
    product_id: 'product-uuid',
    quantity: 2,
    unit_price: 5000,
    discount_percent: 0,
    line_total: 10000
  },
  // more items...
])
```

**Called by:** POS checkout after creating sale

---

### Stock Movement Operations

#### `recordStockMovement(movement)`
Log every inventory change for audit trail.

```typescript
await recordStockMovement({
  product_id: 'product-uuid',
  branch_id: 'branch-uuid',
  type: 'sale',           // or 'receipt', 'transfer', 'adjustment', 'damage'
  quantity: 5,            // negative for reduction
  reference_id: 'sale-uuid',  // links back to source (sale_id, po_id, etc)
  notes: 'Optional notes'
})
```

**Used for:**
- Sales checkout
- Receiving goods
- Branch transfers
- Stock adjustments
- Damage/waste recording

---

## Usage Patterns

### Complete POS Sale Transaction

```typescript
// 1. Create the sale record
const sale = await createSale({
  branch_id: currentBranch,
  cashier_id: currentUser.id,
  customer_id: selectedCustomer?.id || null,
  subtotal: cartSubtotal,
  discount_amount: appliedDiscount,
  tax_amount: taxAmount,
  total_amount: cartTotal,
  payment_method: selectedPaymentMethod,
  payment_status: 'completed',
  receipt_number: generateReceiptNumber(),
})

if (!sale) throw new Error('Failed to create sale')

// 2. Create sale items
const items = cartItems.map(item => ({
  sale_id: sale.id,
  product_id: item.id,
  quantity: item.quantity,
  unit_price: item.price,
  discount_percent: item.discount || 0,
  line_total: item.total,
}))
await createSaleItems(items)

// 3. Update inventory for each item
for (const item of cartItems) {
  await reduceInventory(item.id, currentBranch, item.quantity)
  await recordStockMovement({
    product_id: item.id,
    branch_id: currentBranch,
    type: 'sale',
    quantity: item.quantity,   // positive for records
    reference_id: sale.id,
    notes: `Sale ${sale.receipt_number}`
  })
}

// 4. Award loyalty points (if customer)
if (selectedCustomer) {
  const points = Math.floor(cartTotal / 100) // 1 point per 100 KShs
  await updateCustomerLoyaltyPoints(selectedCustomer.id, points)
}

return sale
```

---

### Load Dashboard Data

```typescript
// Get current user's branch from localStorage or context
const branchId = localStorage.getItem('selectedBranch')

// Fetch dashboard data in parallel
const [sales, inventory, customers] = await Promise.all([
  getSales(branchId, 10),      // Recent 10 sales
  getInventory(branchId),       // All inventory for branch
  getCustomers()                // All customers
])

// Calculate metrics
const dailySales = sales
  .filter(s => isToday(new Date(s.created_at)))
  .reduce((sum, s) => sum + s.total_amount, 0)

const lowStock = inventory
  .filter(inv => inv.quantity < inv.product.reorder_level)
  .length
```

---

### Search & Filter Pattern

```typescript
// In client component
'use client'

const [products, setProducts] = useState([])
const [filtered, setFiltered] = useState([])

useEffect(() => {
  const loadProducts = async () => {
    const allProducts = await getProducts()
    setProducts(allProducts)
  }
  loadProducts()
}, [])

const handleSearch = (query: string) => {
  setFiltered(
    products.filter(p =>
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.sku.toLowerCase().includes(query.toLowerCase())
    )
  )
}
```

---

## Data Types

### Product
```typescript
{
  id: string
  sku: string
  name: string
  description?: string
  category_id: string
  purchase_price: number  // KShs
  selling_price: number   // KShs
  reorder_level: number
  created_at: string
  updated_at: string
  category?: { id, name, icon }
}
```

### Inventory
```typescript
{
  id: string
  product_id: string
  branch_id: string
  quantity: number
  last_counted_at: string
  created_at: string
  updated_at: string
  product?: Product (partial)
}
```

### Sale
```typescript
{
  id: string
  branch_id: string
  cashier_id: string
  customer_id?: string
  subtotal: number
  discount_amount: number
  tax_amount: number
  total_amount: number
  payment_method: 'cash' | 'card' | 'bank_transfer' | 'cheque' | 'credit'
  payment_status: 'pending' | 'completed' | 'failed'
  receipt_number: string
  notes?: string
  created_at: string
  updated_at: string
  customer?: { id, name }
  sale_items?: SaleItem[]
}
```

### SaleItem
```typescript
{
  id: string
  sale_id: string
  product_id: string
  quantity: number
  unit_price: number
  discount_percent: number
  line_total: number
  created_at: string
  product?: Product (partial)
}
```

### Customer
```typescript
{
  id: string
  name: string
  phone: string
  email?: string
  type: 'retail' | 'wholesale' | 'business'
  loyalty_points: number
  credit_limit: number
  credit_balance: number
  created_at: string
  updated_at: string
}
```

---

## Error Handling

All server actions catch errors and return null/empty array on failure:

```typescript
export async function getProducts() {
  try {
    const { data, error } = await supabaseAdmin
      .from('products')
      .select('*')

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching products:', error)
    return []  // Return empty array on error
  }
}
```

**Client-side handling:**

```typescript
const products = await getProducts()
if (!products || products.length === 0) {
  return <div>No products available</div>
}
```

---

## Performance Considerations

### Indexes Created for Speed
```sql
-- These are auto-created by db-migrations.sql
idx_inventory_branch       -- Fast branch lookups
idx_inventory_product      -- Fast product lookups
idx_sales_branch           -- Fast sales by branch
idx_sales_created_at       -- Fast date range queries
idx_sale_items_sale        -- Fast item lookups
idx_purchase_orders_status -- Fast PO filtering
```

### N+1 Query Prevention
All server actions use `.select()` with relationship joins when needed:

```typescript
// Good - single query with join
const { data } = await supabase
  .from('sales')
  .select(`
    *,
    customer:customers(id, name),
    sale_items(*, product:products(sku, name))
  `)

// Bad - this would cause N+1 queries (DON'T DO THIS)
const sales = await getSales()
for (const sale of sales) {
  const items = await getSaleItems(sale.id)  // Query per sale!
}
```

---

## Next Phase: Adding Operations

Phase 3-4 will add:
- `updateCustomerLoyaltyPoints()`
- `createPurchaseOrder()`
- `receivePurchaseOrderItems()`
- `createStockTransfer()`
- `completeStockTransfer()`
- `updateInventoryAdjustment()`

All following the same pattern of error handling and RLS-aware queries.

