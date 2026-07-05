# WINNMATT POS - Demo Presentation Guide

## System Overview

**WINNMATT** is a complete Point-of-Sale and supermarket management system built for multi-branch retail businesses in East Africa.

### Tech Stack
- **Frontend:** Next.js 16 + React 19 + TypeScript + Tailwind CSS
- **Backend/Database:** Supabase (PostgreSQL + Auth)
- **Payments:** M-Pesa Daraja API Integration (Safaricom)
- **UI:** Radix UI primitives with custom WINNMATT branding (Red, White, Yellow)

---

## 1. System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Next.js 16 Application                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐  │
│  │ POS       │ │ Inventory│ │ Customers│ │ Reports &     │  │
│  │ Terminal  │ │ Mgmt     │ │ & Sales  │ │ Analytics     │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────────┘  │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐  │
│  │ Suppliers │ │Purchases │ │Transfers │ │Settings/Admin │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────────┘  │
│                     │ Server Actions │                      │
├─────────────────────┴─────────────────────────────────────┤
│              Supabase (PostgreSQL + Auth)                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐  │
│  │  12 Core  │ │ Row-Level│ │ Real-time│ │   M-Pesa      │  │
│  │  Tables   │ │ Security │ │  Events  │ │   Callbacks   │  │
│  └──────────┘ └──────────┘ └──────────┘ └───────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Features to Demo (In Order)

### A. Login & Authentication
- Secure login via Supabase Auth
- Role-based access (cashier, manager, admin, owner)
- Account provisioning verification

### B. Dashboard (Home Page)
- Real-time sales stats for today
- Sales trend chart (7 days)
- Branch comparison (multi-branch)
- Top selling products
- Payment method breakdown (cash vs M-Pesa)
- Low stock alerts
- Recent transactions

### C. POS Terminal (Core Feature)
- **Product Search:** Real-time search by name, SKU, or barcode
- **Category Filtering:** Filter products by category
- **Wholesale Mode:** Toggle for 15% discount pricing
- **Shopping Cart:** Add/remove items, adjust quantities
- **Item Discounts:** Per-item discount via popover
- **Cart Discount:** Overall discount on entire sale
- **Customer Lookup:** Search & select customers for loyalty
- **Loyalty Redemption:** Cash-only customers can redeem points
- **Payment Methods:**
  - **Cash:** Enter amount received, see change due
  - **M-Pesa:** STK Push prompt to customer phone
- **Receipt Printing:** Full printable receipt with business details

### D. Inventory Management
- Stock levels per branch with real-time updates
- Low stock alerts (red/orange indicators)
- Stock adjustment with movement history
- Stock movement audit trail

### E. Products
- Full product CRUD with categories
- SKU management
- Pricing (purchase/selling)
- Reorder level alerts

### F. Customer Management
- Customer profiles with contact details
- Customer types: Retail, Wholesale, Business
- Loyalty points tracking
- Credit account management
- Purchase history

### G. Suppliers & Purchases
- Supplier CRUD with balance tracking
- Purchase order creation
- Goods receiving (auto-inventory update)

### H. Branch Transfers
- Multi-branch inventory transfers
- Approval workflow (manager/admin)
- Transfer history tracking

### I. Reports & Analytics
- Sales statistics by period (today/week/month/quarter)
- Top/bottom selling products
- Inventory value by category
- Branch performance comparison
- Cashier performance metrics
- Daily sales trends
- Stock movement summary

### J. Sales History
- Paginated transaction list
- Payment status tracking
- Sale voiding with audit trail
- Receipt re-printing

### K. Shift Management
- Open/close cashier shifts
- Shift reconciliation
- Daily summaries

### L. Settings
- **Receipt Settings:** Business name, phone, email, address, tax PIN, footer
- **Branch Overrides:** Per-branch receipt customizations
- **Loyalty Rules:** Points earning, redemption value, minimum baskets

### M. User Management (Admin)
- Create/manage user accounts
- Role assignment
- Branch assignment

---

## 3. Demo Script (15-20 minutes)

### Setup (2 min)
```
1. Open browser at http://localhost:3000
2. Log in as admin@winnmatt.com / admin123
```

### Dashboard Walkthrough (2 min)
```
1. Show the dashboard with today's stats
2. Point out sales chart, top products, low stock alerts
3. Show branch comparison if multi-branch set up
```

### POS Terminal - The Core (5 min)
```
1. Navigate to POS / Cashier
2. Search for a product (e.g., "milk", "sugar")
3. Add items to cart
4. Demonstrate category filtering
5. Toggle wholesale mode
6. Show item discount option
7. Look up a customer
8. Go to checkout → show Cash payment with change calculation
9. Show receipt preview
```

### Inventory & Products (3 min)
```
1. Show products page with all items
2. Show inventory levels per branch
3. Point out low stock alerts
4. Show stock adjustment dialog
```

### Reports (3 min)
```
1. Navigate to Reports
2. Show sales stats
3. Show top products chart
4. Show branch comparison
5. Show payment breakdown pie chart
```

### Closing (2 min)
```
1. Show settings page (receipt configuration)
2. Show user management
3. Discuss M-Pesa integration for mobile money
4. Q&A
```

---

## 4. Architecture Highlights for Presentation

### Security Model
- **Row-Level Security:** All database queries respect branch boundaries
- **Role-Based Access:** Cashiers, managers, admins, and owners each have appropriate permissions
- **Server Action Authentication:** Every server action validates the authenticated session
- **Provisioning Check:** Users must be explicitly provisioned in the app's users table

### Performance
- **Product caching:** Products refresh in background every 45 seconds
- **Debounced search:** Real-time search without excessive queries
- **Optimistic UI:** Cart updates are instant
- **Polling for M-Pesa:** 3-second polling interval for payment confirmation

### M-Pesa Integration
- **STK Push:** Sends payment prompt to customer's phone
- **Callback handling:** Webhook receives confirmation from Safaricom
- **Status polling:** POS polls for payment status
- **Inventory restore:** Automatic stock correction on failed payments

### Loyalty System
- Points earning on eligible sales
- Points redemption at configurable rates
- Owner-configurable rules (minimum basket, max discount %)
- Real-time eligibility checking at checkout

---

## 5. Database Schema (12 Core Tables)

| Table | Purpose |
|-------|---------|
| `branches` | Multi-store support |
| `users` | App users linked to Supabase Auth |
| `categories` | Product categories |
| `products` | Product catalog with SKU |
| `inventory` | Per-branch stock levels |
| `customers` | Customer profiles with loyalty |
| `suppliers` | Supplier records |
| `sales` | Transaction headers |
| `sale_items` | Transaction line items |
| `stock_movements` | Audit trail for inventory |
| `purchase_orders` | Supplier orders |
| `stock_transfers` | Branch-to-branch transfers |

Plus: `mpesa_transactions`, `shifts`, `loyalty_settings`, `loyalty_transactions`, `business_settings`, `branch_receipt_settings`, `sale_audit_log`

---

## 6. Environment Configuration

```
# Required: Supabase (from your Supabase project → Settings → API)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Optional: M-Pesa (Cash works without this)
MPESA_CONSUMER_KEY=your-key
MPESA_CONSUMER_SECRET=your-secret
MPESA_PAYBILL=522533
MPESA_PASSKEY=your-passkey        # Only needed for M-Pesa
MPESA_CALLBACK_URL=your-url       # Only needed for M-Pesa
MPESA_ENVIRONMENT=sandbox
```

## Database Setup (one-time)

Open `scripts/setup-complete.sql` — it's a single file containing all migrations +
schema + seed data. Copy the entire contents into Supabase SQL Editor and run it.
Then create 3 Auth users (Authentication → Users → Add User):
- `admin@winnmatt.com` / `admin123`
- `cashier@winnmatt.com` / `cashier123`
- `demo@winnmatt.com` / `demo123`

Finally, re-run just PART 10 of setup-complete.sql to link the Auth users to app profiles.

---

## 7. Quick Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Cashier | `demo@winnmatt.com` | `demo123` |
| Admin | `admin@winnmatt.com` | `admin123` |

---

## 8. Key Differentiators

1. **Multi-branch ready** - Single system, multiple stores
2. **M-Pesa integrated** - Mobile money payment in East Africa
3. **Loyalty program** - Build customer retention
4. **Real-time inventory** - Never oversell
5. **Comprehensive reporting** - Data-driven decisions
6. **Role-based security** - Proper access control
7. **Offline-capable architecture** - Server actions with validation
8. **Printable receipts** - Professional customer experience
