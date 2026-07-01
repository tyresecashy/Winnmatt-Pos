# Shift Management System - Architecture & Data Flow Overview

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     CASHIER INTERFACE (POS)                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────┐         ┌──────────────────────────┐  │
│  │  ShiftOperations     │         │  Active Shift Card       │  │
│  │  Component           │────────▶│  - Shift Number          │  │
│  │                      │         │  - Duration              │  │
│  │  - Open Shift Dialog │         │  - Opening Float         │  │
│  │  - Close Shift Dialog│         │  - Status                │  │
│  │  - View Summary      │         │  - Actions               │  │
│  └──────────────────────┘         └──────────────────────────┘  │
│           │                                  │                   │
│           │ Call openShift()                 │                   │
│           │                                  │                   │
│           ▼                                  │                   │
│  ┌──────────────────────────────────────────▼──────────────────┐ │
│  │         Server-Side Actions (lib/shift-actions.ts)          │ │
│  ├──────────────────────────────────────────────────────────────┤ │
│  │ • openShift()          • getActiveShift()                    │ │
│  │ • closeShift()         • getShiftSummary()                   │ │
│  │ • reopenShift()        • getShiftHistory()                   │ │
│  └──────────────────────────────────────────────────────────────┘ │
│           │ Validates, Calculates, Logs                          │
│           ▼                                                       │
└─────────────────────────────────────────────────────────────────┘
             │
             │ Database Operations
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PostgreSQL DATABASE                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────┐ │
│  │ shifts           │  │ shift_ledgers    │  │ shift_audit_log│ │
│  ├──────────────────┤  ├──────────────────┤  ├────────────────┤ │
│  │ id (PK)          │  │ id (PK)          │  │ id (PK)        │ │
│  │ shift_number     │  │ shift_id (FK)    │  │ shift_id (FK)  │ │
│  │ opened_at        │  │ action           │  │ action         │ │
│  │ closed_at        │  │ counted_cash     │  │ performed_by   │ │
│  │ opening_float    │  │ expected_cash    │  │ notes          │ │
│  │ cashier_id       │  │ difference       │  │ details (JSON) │ │
│  │ branch_id        │  │ payment_breakdown│  │ created_at     │ │
│  │ status           │  │ (JSON)           │  │                │ │
│  │ closing_notes    │  │ created_at       │  │                │ │
│  └──────────────────┘  └──────────────────┘  └────────────────┘ │
│          │                      │                      │          │
│          └──────────┬───────────┴──────────┬───────────┘          │
│                     │ Views & Queries      │                     │
│                     ▼                      ▼                      │
│  ┌────────────────────────┐  ┌──────────────────────────────┐   │
│  │ shift_summaries        │  │ daily_reconciliation_summary │   │
│  │ (Unified View)         │  │ (Management Reporting)       │   │
│  └────────────────────────┘  └──────────────────────────────┘   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
             │
             │ Query Results
             │
             ▼
┌─────────────────────────────────────────────────────────────────┐
│                   MANAGER DASHBOARD (Settings)                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              ShiftDashboard Component                    │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │                                                            │   │
│  │  ┌─────────────────┐  ┌─────────────────┐               │   │
│  │  │ Summary Metrics │  │  Daily Trend    │               │   │
│  │  │ - Total Shifts  │  │  Bar Chart      │               │   │
│  │  │ - Active        │  │  (3 payment     │               │   │
│  │  │ - Closed        │  │   methods)      │               │   │
│  │  │ - Total Sales   │  │                 │               │   │
│  │  └─────────────────┘  └─────────────────┘               │   │
│  │                                                            │   │
│  │  ┌──────────────────┐  ┌──────────────────┐             │   │
│  │  │ Payment Methods  │  │ Shifts Table     │             │   │
│  │  │ Pie Chart        │  │ - Filterable     │             │   │
│  │  │ - Cash           │  │ - Sortable       │             │   │
│  │  │ - Card           │  │ - View Details   │             │   │
│  │  │ - M-Pesa         │  │ - Reopen Option  │             │   │
│  │  └──────────────────┘  └──────────────────┘             │   │
│  │                                                            │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Data Flow: Opening a Shift

```
CASHIER OPENS SHIFT
       │
       ▼
┌─────────────────────────────────┐
│ ShiftOperations Dialog          │
│ Input: Opening Float = 5000 KShs│
└─────────────────────────────────┘
       │
       ▼ User clicks "Open Shift"
┌──────────────────────────────────────┐
│ openShift() Server Action            │
│ - Validate input                     │
│ - Check for existing open shift      │
│ - Generate shift number (HQ-...)     │
│ - Create database entry              │
└──────────────────────────────────────┘
       │
       ├─────────▶ INSERT INTO shifts
       │           values(...)
       │
       ├─────────▶ INSERT INTO shift_ledgers
       │           action='opening'
       │
       ├─────────▶ INSERT INTO shift_audit_log
       │           action='opened'
       │
       ▼
┌──────────────────────────────────┐
│ Return Success Response           │
│ - shift object                    │
│ - success: true                   │
│ - message: "Shift opened"         │
└──────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────┐
│ ShiftOperations UI Updates        │
│ - Shows "Active Shift" card       │
│ - Displays shift number           │
│ - Shows opening float             │
│ - Ready for sales                 │
└──────────────────────────────────┘
```

---

## Data Flow: Closing a Shift (Reconciliation)

```
CASHIER CLOSES SHIFT
       │
       ▼
┌──────────────────────────────────┐
│ ShiftOperations Dialog           │
│ Input: Counted Cash = 7500 KShs  │
│        Notes = "Perfect count"   │
└──────────────────────────────────┘
       │
       ▼ User clicks "Close Shift"
┌──────────────────────────────────────────┐
│ closeShift() Server Action               │
│ - Fetch shift details from DB            │
│ - Get all non-voided sales since open    │
│ - Calculate Payment Breakdown:           │
│   • Cash Sales: 2000                     │
│   • Card Sales: 1500                     │
│   • M-Pesa Sales: 1000                   │
│ - Calculate Expected:                    │
│   Expected = 5000 (opening) + 2000 = 7000
│ - Calculate Difference:                  │
│   Difference = 7500 (counted) - 7000 = +500
│   (Result: Over by 5 KShs)               │
└──────────────────────────────────────────┘
       │
       ├─────────▶ UPDATE shifts SET status='closed'
       │
       ├─────────▶ INSERT INTO shift_ledgers
       │           action='closing'
       │           counted_cash=750000
       │           expected_cash=700000
       │           difference=50000
       │           payment_breakdown={...}
       │
       ├─────────▶ INSERT INTO shift_audit_log
       │           action='closed'
       │           notes="Over by 50 KShs"
       │           details={...}
       │
       ▼
┌──────────────────────────────────────────┐
│ Return Success Response                   │
│ - Shift reconciliation details           │
│ - Opening: 5000                          │
│ - Cash Sales: 2000                       │
│ - Expected: 7000                         │
│ - Counted: 7500                          │
│ - Difference: +500 (Over!)               │
│ - success: true                          │
│ - message: "Over by KShs 5.00"           │
└──────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│ ShiftOperations UI Updates               │
│ - Shows "No active shift" message        │
│ - Shift closed successfully              │
│ - Ready to open new shift                │
└──────────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────┐
│ Manager can now see in Dashboard:        │
│ - Shift in table with "closed" status    │
│ - Over/short amount in table             │
│ - Included in analytics (trend, pie)     │
│ - Audit trail visible                    │
└──────────────────────────────────────────┘
```

---

## Reconciliation Calculation Logic

```
RECONCILIATION FORMULA
┌────────────────────────────────────────┐
│ Expected Cash = Opening Float + Sales  │
│ Difference = Counted - Expected        │
└────────────────────────────────────────┘

EXAMPLE 1: PERFECT RECONCILIATION
┌─────────────────────────────────────────┐
│ Opening Float:        5,000 KShs        │
│ Cash Sales:         + 2,000 KShs        │
│ ─────────────────────────────           │
│ Expected:             7,000 KShs        │
│                                         │
│ Counted:              7,000 KShs        │
│ ─────────────────────────────           │
│ Difference:               0 ✓ Perfect!  │
└─────────────────────────────────────────┘

EXAMPLE 2: CASH OVER
┌─────────────────────────────────────────┐
│ Opening Float:        5,000 KShs        │
│ Cash Sales:         + 2,000 KShs        │
│ ─────────────────────────────           │
│ Expected:             7,000 KShs        │
│                                         │
│ Counted:              7,100 KShs        │
│ ─────────────────────────────           │
│ Difference:         +   100 ✓ Over!     │
└─────────────────────────────────────────┘

EXAMPLE 3: CASH SHORT
┌─────────────────────────────────────────┐
│ Opening Float:        5,000 KShs        │
│ Cash Sales:         + 2,000 KShs        │
│ ─────────────────────────────           │
│ Expected:             7,000 KShs        │
│                                         │
│ Counted:              6,900 KShs        │
│ ─────────────────────────────           │
│ Difference:         -   100 ⚠️ Short!   │
└─────────────────────────────────────────┘

KEY FACTS
┌────────────────────────────────────────┐
│ • Card & M-Pesa sales NOT in cash      │
│   drawer, so excluded from calculation │
│                                        │
│ • Voided sales EXCLUDED from calc      │
│                                        │
│ • Only CASH affects cash drawer        │
│   reconciliation                       │
│                                        │
│ • Opening float is baseline            │
│                                        │
│ • Positive difference = Extra cash     │
│ • Negative difference = Missing cash   │
│ • Zero difference = Perfect accounting │
└────────────────────────────────────────┘
```

---

## Database Relationships

```
┌─────────────────────────────────────────────────────────┐
│                   Key Relationships                     │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  users ◄──────┐                                         │
│  (cashier,    │                                         │
│   manager)    │               branches                 │
│               │         ┌──────────────┐                │
│               │         │ (location,   │                │
│               │         │  code)       │                │
│               │         └──────────────┘                │
│               │                 ▲                       │
│               │                 │                       │
│       ┌───────┴─────────────────┴────────┐             │
│       │                                  │              │
│       ▼                                  ▼              │
│  ┌─────────┐                      ┌──────────┐         │
│  │ shifts  │                      │ branches │         │
│  ├─────────┤                      └──────────┘         │
│  │ id      │                                            │
│  │ cashier │──────┐                                    │
│  │ branch  │      │                                    │
│  │  ...    │      │                                    │
│  └─────────┘      │                                    │
│       │           │                                    │
│       │ 1:N       │                                    │
│       │           │  (Many ledger entries              │
│       │           │   per shift)                       │
│       ▼           │                                    │
│  ┌──────────────┐ │                                   │
│  │shift_ledgers │◄┘                                   │
│  ├──────────────┤                                     │
│  │ id           │                                     │
│  │ shift_id     │──┐  (1:N relationship)              │
│  │ action       │  │                                  │
│  │ difference   │  │                                  │
│  │  ...         │  │                                  │
│  └──────────────┘  │                                  │
│       ▲            │                                  │
│       │            │                                  │
│       │            │                                  │
│  ┌────┴────────────┴──────┐                          │
│  │Accessed by                                         │
│  │shift_summaries view                               │
│  │+ daily_reconciliation                             │
│  │  _summary view                                    │
│  └───────────────────────┘                           │
│                                                       │
│  ┌──────────────────┐                               │
│  │shift_audit_log   │                               │
│  ├──────────────────┤    1:N Relationship            │
│  │ id               │    (Multiple audits per shift) │
│  │ shift_id ◄───────┼─────────────────────          │
│  │ action           │                                │
│  │ performed_by     │                                │
│  │  ...             │                                │
│  └──────────────────┘                               │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

## Component Interaction Map

```
┌───────────────────────────────────────────────────────────┐
│           COMPONENT ARCHITECTURE                          │
├───────────────────────────────────────────────────────────┤
│                                                            │
│  ┌─────────────────────────────────────────────────────┐  │
│  │         POS Page (app/.../pos/page.tsx)            │  │
│  ├─────────────────────────────────────────────────────┤  │
│  │                                                      │  │
│  │  ┌──────────────────────────────────────────────┐  │  │
│  │  │  ShiftOperations Component                   │  │  │
│  │  │  └─ Cashier-facing component                │  │  │
│  │  │  Props: branchId, cashierId, cashierName   │  │  │
│  │  │  Features:                                   │  │  │
│  │  │    • Show "No shift" when closed            │  │  │
│  │  │    • Show active shift card                 │  │  │
│  │  │    • Open Shift dialog (openShift)         │  │  │
│  │  │    • Close Shift dialog (closeShift)        │  │  │
│  │  │    • View Summary button                    │  │  │
│  │  │    • Toast notifications                    │  │  │
│  │  └──────────────────────────────────────────────┘  │  │
│  │                          │                           │  │
│  │                          ├──▶ openShift()           │  │
│  │                          │    closeShift()          │  │
│  │                          └──▶ getShiftSummary()     │  │
│  │                                                      │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌─────────────────────────────────────────────────────┐  │
│  │         Settings Page (.../settings/page.tsx)      │  │
│  ├─────────────────────────────────────────────────────┤  │
│  │                                                      │  │
│  │  ┌──────────────────────────────────────────────┐  │  │
│  │  │  ShiftDashboard Component                    │  │  │
│  │  │  └─ Manager-facing component                │  │  │
│  │  │  Props: branchId, userId, userRole         │  │  │
│  │  │  Permission Check:                          │  │  │
│  │  │    └─ Only visible to manager/admin         │  │  │
│  │  │  Features:                                   │  │  │
│  │  │    • Summary metric cards                   │  │  │
│  │  │    • Daily sales trend chart                │  │  │
│  │  │    • Payment method pie chart               │  │  │
│  │  │    • Shifts table (sortable/filterable)    │  │  │
│  │  │    • View shift details modal               │  │  │
│  │  │    • Reopen shift option                    │  │  │
│  │  └──────────────────────────────────────────────┘  │  │
│  │                          │                           │  │
│  │                          ├──▶ getShiftHistory()     │  │
│  │                          │    getShiftSummary()     │  │
│  │                          └──▶ reopenShift()         │  │
│  │                                                      │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                            │
└───────────────────────────────────────────────────────────┘

SERVER ACTIONS (lib/shift-actions.ts)
┌──────────────────────────────────────────────────────────┐
│ openShift      → Validate, Generate Number, Log          │
│ closeShift     → Calculate, Reconcile, Log               │
│ getActiveShift → Query DB                                │
│ getShiftSummary → Fetch + Include Ledgers                │
│ getShiftHistory → Query Multiple                         │
│ reopenShift    → Permission Check, Log                   │
│ getShiftsForDateRange → Analytics Query                  │
└──────────────────────────────────────────────────────────┘
       │
       └──▶ All queries → PostgreSQL (Supabase)
       └──▶ All writes → Create audit entries
       └──▶ All actions → Log with timestamp
```

---

## State Flow

```
CASHIER VIEW STATE MACHINE

┌──────────────────┐
│  "No Shift"      │  (Initial state)
│  state           │
├──────────────────┤
│ Button: "Open"   │
└──────────────────┘
       │ User clicks "Open Shift"
       │ Enters: Opening Float
       ▼
┌──────────────────┐
│  "Active"        │  (Open shift exists)
│  state           │
├──────────────────┤
│ Shows:           │  
│ • Shift #        │
│ • Duration       │
│ • Float Amount   │
│ Button: "Close"  │
└──────────────────┘
       │ User clicks "Close Shift"
       │ Enters: Counted Cash, Notes
       ▼
┌──────────────────┐
│  "Closed"        │  (Returning to no shift)
│  state           │
├──────────────────┤
│ Result:          │
│ • Perfect        │
│ • Over/Short     │
│ • Summary Modal  │
└──────────────────┘
       │ User sees summary
       ▼
┌──────────────────┐
│  "No Shift"      │  (Back to start for next day)
│  state           │
└──────────────────┘
```

---

## Permissions Flow

```
USER ACCESSES SHIFT SYSTEM
       │
       ▼
   Check Role
   │
   ├─ Cashier
   │  └─▶ Can:
   │      • Open/close own shift
   │      • View own shift summary
   │      • See own shift status
   │      └─ Cannot: Manage others, Reopen
   │
   ├─ Manager
   │  └─▶ Can:
   │      • View all shifts
   │      • Access dashboard
   │      • View analytics
   │      • Reopen closed shifts (with reason)
   │      • View audit trails
   │      └─ Cannot: Delete shifts
   │
   └─ Admin
      └─▶ Can:
          • Full access to everything
          • View all data
          • Advanced reporting
          • Audit log management
```

---

## Data Transformation Pipeline

```
USER INPUT
    │
    ▼
┌──────────────────────────────────────┐
│ CLIENT VALIDATION                    │
│ • Check amount is number             │
│ • Check required fields filled       │
│ • User-friendly error messages       │
└──────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────┐
│ SERVER VALIDATION (shift-actions.ts) │
│ • Duplicate shift check              │
│ • Permission verification            │
│ • Business rule validation           │
│ • Database constraint checks         │
└──────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────┐
│ PROCESSING                           │
│ • Calculations                       │
│ • Lookups                            │
│ • Transformations                    │
│ • Reconciliations                    │
└──────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────┐
│ DATABASE OPERATIONS                  │
│ • INSERT/UPDATE shifts               │
│ • INSERT ledger entries              │
│ • INSERT audit logs                  │
│ • QUERY views                        │
└──────────────────────────────────────┘
    │
    ▼
┌──────────────────────────────────────┐
│ RESPONSE TRANSFORMATION              │
│ • Format amounts (cents → KShs)      │
│ • Format dates (ISO → readable)      │
│ • Calculate display values           │
│ • Create friendly messages           │
└──────────────────────────────────────┘
    │
    ▼
UI PRESENTATION
    │
    ├─ Component updates
    ├─ Toast notifications
    ├─ Modal dialogs
    └─ Chart data
```

---

## Timeline: Day in the Life

```
08:00 AM
  │  Cashier arrives at POS
  │  │
  │  ├─▶ Click "Open Shift"
  │  │   Enter: 5,000 KShs (opening float)
  │  │   System creates: Shift HQ-2024-01-15-01
  │  │
  │  ├─▶ INSERT shifts (opened_at: 08:00)
  │  ├─▶ INSERT shift_ledgers (opening entry)
  │  └─▶ INSERT shift_audit_log (opened action)
  │
08:00 AM - 04:30 PM
  │  │
  │  ├─▶ Process sales (all tied to shift)
  │  │   • 47 sales total
  │  │   • 20,000 KShs cash
  │  │   • 15,000 KShs card
  │  │   • 10,000 KShs M-Pesa
  │  │
  │  └─▶ POS records sale_status = 'completed'
  │
04:30 PM
  │  Cashier ends shift
  │  │
  │  ├─▶ Count cash in drawer: 24,200 KShs
  │  │
  │  ├─▶ Click "Close Shift"
  │  │   Enter: 24,200 KShs (counted amount)
  │  │   Notes: "Customer returned chair with minor damage"
  │  │
  │  ├─▶ System calculates:
  │  │   Opening: 5,000 KShs
  │  │   Cash sales: 20,000 KShs
  │  │   Expected: 25,000 KShs
  │  │   Counted: 24,200 KShs
  │  │   Difference: -800 KShs (SHORT)
  │  │
  │  ├─▶ UPDATE shifts SET status='closed'
  │  ├─▶ INSERT shift_ledgers (closing entry)
  │  └─▶ INSERT shift_audit_log (closed action)
  │
04:35 PM
  │  Manager reviews in Settings
  │  │
  │  ├─▶ Sees shift in table
  │  ├─▶ Notices: SHORT by 800 KShs ⚠️
  │  │
  │  ├─▶ Clicks "View" for details
  │  │   • Opens detail modal
  │  │   • Reviews payment breakdown
  │  │   • Checks audit trail
  │  │   • Sees all 47 transactions
  │  │
  │  └─▶ Notes: "Customer refund likely due to returned item"
  │
04:40 PM
  │  Manager approves reconciliation
  │  │
  │  ├─▶ Shift marked as reviewed
  │  ├─▶ Alert note: "Short amount documented"
  │  │
  │  └─▶ Shift closed and finalized
  │
DAILY REPORT (6:00 PM)
  │
  ├─▶ Manager reviews daily_reconciliation_summary
  │   • 3 shifts closed
  │   • Total sales: 150,000 KShs
  │   • Total difference: -800 KShs (one short)
  │   • Payment breakdown visible
  │
  └─▶ Ready for accounting department
```

---

## Summary

The shift management system provides:
- **Clear separation** of concerns (UI, business logic, data)
- **Secure operations** with permission checks
- **Complete audit trail** for compliance
- **Accurate reconciliation** with automatic calculations
- **Efficient queries** with optimized views
- **User-friendly interface** for all roles

All components work together seamlessly to provide complete shift accountability!
