# CUSTOMERS - DEVELOPER QUICK START

## What Changed?

✅ Mock data → Real database
✅ Dead button → Working CRUD
✅ Fake purchases → Real sales data
❌ Static values → Dynamic calculations

---

## Files to Know

| File | Purpose | Change |
|------|---------|--------|
| `lib/customers-actions.ts` | Server actions | NEW - 9 CRUD functions |
| `components/customers/customer-form-dialog.tsx` | Add/Edit form | NEW - Reusable dialog |
| `components/customers/customer-details-dialog.tsx` | View details | NEW - Shows real history |
| `app/(dashboard)/customers/page.tsx` | Page component | MODIFIED - Complete rewrite |

---

## Key Functions

### Server Actions (lib/customers-actions.ts)

```typescript
// Get all customers with stats
await getCustomersWithStats()
// Returns: Customer[] with total_purchases, purchase_count

// Create customer
await createCustomer(name, type, phone?, email?, creditLimit?)
// Returns: { success, customer, message }

// Update customer
await updateCustomer(customerId, { name?, phone?, email?, type?, credit_limit? })
// Returns: { success, customer, message }

// Search customers
await searchCustomers(query)
// Returns: Customer[] matching name/phone/email

// Get customer counts
await getCustomerCounts()
// Returns: { total, retail, wholesale, business }

// Get purchase history
await getCustomerPurchases(customerId, limit?)
// Returns: Sale[] with receipt_number, total_amount, created_at
```

### UI Components

```typescript
// Add/Edit dialog
<CustomerFormDialog
  isOpen={boolean}
  onOpenChange={(open) => void}
  customer={Customer | undefined} // undefined = create, filled = edit
  onSaveSuccess={() => void}
/>

// View details dialog
<CustomerDetailsDialog
  isOpen={boolean}
  onOpenChange={(open) => void}
  customer={Customer}
  onEdit={() => void}
/>
```

---

## Database Schema

```typescript
// customers table
{
  id: UUID
  name: string (required)
  phone?: string
  email?: string
  type: 'retail' | 'wholesale' | 'business'
  loyalty_points: number
  credit_limit: number
  credit_balance: number
  created_at: timestamp
  updated_at: timestamp
}
```

---

## Usage Examples

### Create Customer
```typescript
const result = await createCustomer(
  "John Kamau",
  "retail",
  "0722123456",
  "john@example.com"
)
if (result.success) {
  console.log("Customer ID:", result.customer.id)
}
```

### Search Customers
```typescript
const customers = await searchCustomers("john")
// Returns all customers with "john" in name/phone/email
```

### Get Customer with Stats
```typescript
const customers = await getCustomersWithStats()
customers.forEach(c => {
  console.log(`${c.name}: ${c.total_purchases} spent in ${c.purchase_count} purchases`)
})
```

### Edit Customer
```typescript
const result = await updateCustomer(customerId, {
  type: "wholesale",
  credit_limit: 50000
})
```

---

## No Mock Data

❌ Don't use: `import { customers } from '/lib/mock-data'`
✅ Use: `import { getCustomersWithStats } from '/lib/customers-actions'`

---

## Testing Quick Commands

```bash
# 1. Go to customers page
http://localhost:3000/dashboard/customers

# 2. Create new customer
Click "Add Customer" → Fill form → Save

# 3. Edit customer
Click "Edit" → Modify → Update

# 4. View details
Click "View" → See real purchase history

# 5. Verify in SQL
SELECT name FROM customers WHERE name = 'Your Customer';
```

---

## Common Tasks

### Need to search for customer?
```typescript
const results = await searchCustomers(query)
```

### Need to get all retail customers?
```typescript
const retail = await getCustomersByType("retail")
```

### Need customer's recent purchases?
```typescript
const purchases = await getCustomerPurchases(customerId)
```

### Need total customer counts?
```typescript
const counts = await getCustomerCounts()
console.log(`Total: ${counts.total}, Retail: ${counts.retail}`)
```

---

## Status

✅ Ready to use
✅ No dependencies on mock data
✅ Real database operations
✅ Type-safe functions
✅ Error handling included

---

## Next: POS Integration

When building customer selection in POS:
```typescript
import { searchCustomers } from '@/lib/customers-actions'

// In your POS component
const handleCustomerSearch = async (query: string) => {
  const results = await searchCustomers(query)
  // Show results for user to select from
}
```

---

That's it! Use functions from `lib/customers-actions.ts` and components handle the UI.
