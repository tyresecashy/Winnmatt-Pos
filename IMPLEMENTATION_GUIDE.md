# WINNMATT POS Implementation Guide

## Phase 1: Foundation ✅ (Completed)

### What Was Done

1. **Database Schema Created**
   - Created PostgreSQL schema with 12 core tables
   - File: `db-migrations.sql`
   - Tables: users, branches, products, inventory, customers, suppliers, sales, sale_items, stock_movements, purchase_orders, stock_transfers
   - Added Row-Level Security (RLS) policies
   - Created performance indexes

2. **Seed Data Prepared**
   - File: `db-seed.sql`
   - 3 branches (Main, Westlands, Karen)
   - 10 product categories
   - 18 products across categories
   - 6 customers (retail/wholesale/business types)
   - 5 suppliers
   - Complete inventory for all branches

3. **Backend Infrastructure**
   - `lib/supabase.ts` - Client-side Supabase connection
   - `lib/supabase-server.ts` - Server-side admin connection
   - `lib/db.types.ts` - Full TypeScript database types
   - `lib/actions.ts` - Server Actions for all database operations

4. **Authentication System**
   - `contexts/auth-context.tsx` - React Context for auth state
   - `components/protected-route.tsx` - Route protection wrapper
   - Supports: signIn, signUp, signOut
   - Session management with Supabase Auth

5. **Configuration Files**
   - `.env.local.example` - Template for environment variables
   - Updated `app/layout.tsx` to include AuthProvider and ThemeProvider
   - Fixed `next.config.mjs` to enable build errors (was ignoring them)

6. **New Pages**
   - `app/login/page.tsx` - Real authentication login page
   - `app/page.tsx` - Redirect to dashboard or login based on auth state

### Dependencies Added
- `@supabase/supabase-js` - Supabase SDK (in progress)

---

## Phase 2: Setup & Configuration ⏳ (Next)

### Prerequisites

You need a Supabase account. Here's how to set it up:

#### Step 1: Create Supabase Project
1. Go to https://supabase.com
2. Click "Start Your Project"
3. Sign up or log in
4. Create a new project:
   - Name: `winnmatt-pos`
   - Password: (strong password - save this!)
   - Region: Select your region
5. Wait 2-3 minutes for project to initialize

#### Step 2: Get Your Credentials
1. Once project is ready, go to **Settings → API**
2. Copy these three values:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **Anon Public Key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - **Service Role Secret** → `SUPABASE_SERVICE_ROLE_KEY` (careful with this!)

#### Step 3: Create .env.local File
Create file `c:\Users\tyres\Desktop\123\.env.local` with:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...
NEXT_PUBLIC_APP_NAME=WINNMATT POS
NEXT_PUBLIC_API_URL=http://localhost:3000
```

#### Step 4: Run Database Migrations

1. In Supabase, go to **SQL Editor**
2. Click **New Query**
3. Copy contents of `db-migrations.sql` and paste into query
4. Click **Run**
5. Wait for success message

#### Step 5: Run Database Seed Data

1. In Supabase SQL Editor, click **New Query**
2. Copy contents of `db-seed.sql` and paste
3. Click **Run**
4. Verify data was inserted

#### Step 6: Create Demo Users in Supabase Auth

1. In Supabase, go to **Authentication → Users**
2. Click **Add User**
3. Create demo user:
   - Email: `demo@winnmatt.com`
   - Password: `demo123`
   - Auto confirm
4. Create admin user:
   - Email: `admin@winnmatt.com`
   - Password: `admin123`
   - Auto confirm

#### Step 7: Create User Records in Database

In Supabase SQL Editor, run:

```sql
-- Get the user IDs from auth (replace with actual UUIDs from Authentication tab)
INSERT INTO users (id, email, full_name, branch_id, role) VALUES
  ('USER_ID_1', 'demo@winnmatt.com', 'Demo Cashier', (SELECT id FROM branches WHERE code = 'MAIN-001'), 'cashier'),
  ('USER_ID_2', 'admin@winnmatt.com', 'Admin User', (SELECT id FROM branches WHERE code = 'MAIN-001'), 'admin');
```

Note: Replace USER_ID_1 and USER_ID_2 with actual UUIDs from your Supabase Users table.

#### Step 8: Start the Application

```bash
npm run dev
```

Navigate to http://localhost:3000

---

## Phase 3: Database Integration (3-4 hours)

### Objectives
- ✅ Get products from real database
- ✅ Get customers from real database  
- ✅ Get inventory from real database
- ✅ Update all pages to use server actions

### Work Items

1. **Update Dashboard Page**
   - Replace mock data with real SQL queries
   - Fetch: Sales, top products, branch comparison
   - Load: Real inventory low stock alerts

2. **Update POS Page**
   - Load products from DB
   - Load customers from DB
   - Load inventory quantities

3. **Update Inventory Page**
   - Show real stock levels per branch
   - Load supplier info
   - Show cost vs selling price margins

4. **Update Product Page**
   - Display all products from DB
   - Show category filtering
   - Add product CRUD operations

5. **Update Customer Page**
   - Show all customers
   - Display loyalty points
   - Show credit balance for wholesale

6. **Update Supplier Page**
   - Show all suppliers
   - Display payment terms
   - Show current balance

---

## Phase 4: POS Checkout Logic (2-3 hours)

### Objectives
- Complete sale transaction
- Update inventory
- Record payment
- Award loyalty points
- Generate receipt

### Implementation

```typescript
// In shopping-cart.tsx
async function completeSale() {
  // 1. Create sale record
  const sale = await createSale({
    branch_id: currentBranch,
    cashier_id: currentUser.id,
    customer_id: selectedCustomer?.id || null,
    subtotal: subtotal,
    discount_amount: totalDiscount,
    tax_amount: taxAmount,
    total_amount: total,
    payment_method: paymentMethod,
    payment_status: 'completed',
    receipt_number: generateReceiptNumber(),
  })

  // 2. Create sale items
  await createSaleItems(
    cartItems.map(item => ({
      sale_id: sale.id,
      product_id: item.id,
      quantity: item.quantity,
      unit_price: item.price,
      discount_percent: item.discount,
      line_total: item.total,
    }))
  )

  // 3. Update inventory for each item
  for (const item of cartItems) {
    await reduceInventory(item.id, currentBranch, item.quantity)
    await recordStockMovement({
      product_id: item.id,
      branch_id: currentBranch,
      type: 'sale',
      quantity: item.quantity,
      reference_id: sale.id,
    })
  }

  // 4. Award loyalty points
  if (selectedCustomer) {
    const pointsEarned = Math.floor(total / 100) // 1 point per 100 KShs
    await updateCustomerLoyaltyPoints(selectedCustomer.id, pointsEarned)
  }

  // 5. Show receipt
  showReceipt(sale)
}
```

---

## Phase 5: Inventory Management (2-3 hours)

### Objectives
- Track all stock movements
- Implement receiving goods
- Implement branch transfers
- Show low stock alerts

### Implementation

1. **Purchase Order Flow**
   - Create purchase order in DB
   - When goods received, update inventory
   - Record stock movement

2. **Branch Transfer Flow**
   - Create transfer request
   - Reduce from source branch
   - Add to destination branch
   - Track in transit status

3. **Low Stock Alerts**
   - Query inventory where quantity < reorder_level
   - Show in dashboard
   - Alert notifications

---

## Phase 6: Analytics & Reports (2-3 hours)

### Objectives
- Real sales analytics
- Transaction reports
- Inventory reports
- Performance metrics

### Queries to Implement

```sql
-- Daily Sales Summary
SELECT DATE(created_at) as date, COUNT(*) as transactions, SUM(total_amount) as daily_sales
FROM sales
WHERE branch_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

-- Top Products
SELECT p.name, SUM(si.quantity) as total_sold, SUM(si.line_total) as revenue
FROM sale_items si
JOIN products p ON si.product_id = p.id
JOIN sales s ON si.sale_id = s.id
WHERE s.branch_id = $1 AND s.created_at >= NOW() - INTERVAL '30 days'
GROUP BY p.id, p.name
ORDER BY total_sold DESC
LIMIT 10;

-- Payment Methods Breakdown
SELECT payment_method, COUNT(*) as count, SUM(total_amount) as amount
FROM sales
WHERE branch_id = $1 AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY payment_method;

-- Inventory Value by Branch
SELECT b.name, SUM(i.quantity * p.selling_price) as inventory_value
FROM inventory i
JOIN branches b ON i.branch_id = b.id
JOIN products p ON i.product_id = p.id
GROUP BY b.id, b.name;
```

---

## Phase 7: Business Features (1-2 hours)

### Objectives
- Customer CRUD operations
- Supplier management
- Wholesale credit accounts
- Loyalty program

---

## Phase 8: Polish & Testing (1-2 hours)

### Objectives
- Error handling
- Input validation
- Loading states
- Testing workflows

---

## Important Notes

### Environment Variables
Secure these! Never commit to git:
- `SUPABASE_SERVICE_ROLE_KEY` - This is admin key, keep secret!
- Add `.env.local` to `.gitignore` (already done)

### Database Security
- RLS policies are active on all tables
- Users can only see data for their branch
- Implement stricter policies in production

### Authentication
- Supabase Auth handles passwords securely
- JWT tokens in browser
- Server actions run with current user context

---

## Troubleshooting

### npm install taking too long?
```bash
npm cache clean --force
npm install @supabase/supabase-js --save
```

### Getting "SUPABASE_URL not found"?
Make sure `.env.local` exists with all correct values

### Login not working?
1. Check user exists in Supabase Auth
2. Check user record exists in users table
3. Verify branch exists

### Build errors?
```bash
npm run build
# or
next build
```

---

## Next Steps

1. Complete Supabase setup (Steps 1-8 above)
2. Start app: `npm run dev`
3. Test login at http://localhost:3000/login
4. Verify data loads on dashboard
5. Then proceed with Phase 3 (Database Integration)

---

## Success Criteria

✅ App runs without errors
✅ Login page loads
✅ Database connection successful
✅ Dashboard shows real data
✅ POS checkout saves sales
✅ Inventory updates after sale
✅ All reports working
✅ Ready for production testing

