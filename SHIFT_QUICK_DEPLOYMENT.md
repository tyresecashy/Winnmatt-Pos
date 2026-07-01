# Shift Management - Quick Deployment Guide

## 5-Minute Setup

### Prerequisites
- Existing winnmatt_pos database
- Supabase credentials in `.env`
- UI components already installed

### Step 1: Database Setup (2 min)
```bash
# Copy migration to your migrations folder
# migrations/002_shift_management.sql already created

# Option A: Using Supabase Web UI
1. Go to SQL Editor in Supabase
2. Copy entire contents of migrations/002_shift_management.sql
3. Paste and Run
4. Watch for green checkmarks

# Option B: Using psql
psql -U postgres -d your_database < migrations/002_shift_management.sql
```

### Step 2: Update POS Component (1 min)
Add to `app/(dashboard)/pos/page.tsx`:

```tsx
import { ShiftOperations } from '@/components/shift-operations'

// Inside your component:
export default async function POSPage() {
  const { user, branch } = await getAuth()
  
  return (
    <div className="space-y-6">
      {/* Add shift card here */}
      <ShiftOperations 
        branchId={branch.id}
        cashierId={user.id}
        cashierName={user.full_name}
      />
      
      {/* Rest of your POS content */}
    </div>
  )
}
```

### Step 3: Add Manager Dashboard (1 min)
Add to `app/(dashboard)/settings/page.tsx`:

```tsx
import { ShiftDashboard } from '@/components/shift-dashboard'

// Inside your component, add to the tabs/sections:
{user.role === 'manager' || user.role === 'admin' && (
  <section className="space-y-4">
    <h2 className="text-xl font-bold">Shift Management</h2>
    <ShiftDashboard 
      branchId={branch.id}
      userId={user.id}
      userRole={user.role}
    />
  </section>
)}
```

### Step 4: Test Integration (1 min)
1. Login as cashier
2. Go to POS
3. Click "Open Shift" → Enter 5000 → Submit
4. Verify shift number appears (e.g., HQ-2024-01-15-01)
5. Login as manager
6. Go to Settings → See shift in dashboard table
7. Done! ✓

---

## File Locations

| File | Purpose | Location |
|------|---------|----------|
| Migration | Database schema | `migrations/002_shift_management.sql` |
| Backend Functions | Shift operations API | `lib/shift-actions.ts` |
| Shift Card Component | For cashiers | `components/shift-operations.tsx` |
| Dashboard Component | For managers | `components/shift-dashboard.tsx` |
| Docs | Full guide | `SHIFT_MANAGEMENT_IMPLEMENTATION.md` |

---

## Key Features Summary

### For Cashiers
```
1. Open Shift
   - Enter opening float
   - System generates shift number
   - Shift ready for sales

2. Process Sales
   - All sales tied to shift
   - Payment methods recorded

3. Close Shift
   - Enter counted cash
   - System calculates reconciliation
   - Over/short detected
   - Audit log created
```

### For Managers
```
1. View All Shifts
   - All shifts in table
   - Filter by status, date range
   
2. Analytics
   - Daily sales trend
   - Payment method breakdown
   - Over/short totals
   
3. Manage Shifts
   - View shift details
   - Reopen if needed (with reason)
```

---

## Testing Scenarios

### Scenario 1: Perfect Reconciliation
```
1. Open shift: 5,000 KShs
2. Create sale: 2,500 KShs (cash)
3. Create sale: 1,500 KShs (card)
4. Create sale: 1,000 KShs (M-Pesa)
5. Close shift: Count 7,500 KShs (5k opening + 2.5k sales)
6. Result: Perfect reconciliation! ✓
```

### Scenario 2: Cash Over
```
1. Open shift: 5,000 KShs
2. Create sales: 2,000 KShs (cash)
3. Close shift: Count 7,100 KShs (100 over)
4. Result: Over by 100 KShs ✓
```

### Scenario 3: Cash Short
```
1. Open shift: 5,000 KShs
2. Create sales: 2,000 KShs (cash)
3. Close shift: Count 6,900 KShs (100 short)
4. Result: Short by 100 KShs ⚠️
```

---

## Common Issues & Fixes

### Issue: "Shift already open"
```
Fix: Close existing shift first
- Navigate to POS
- Click "Close Shift" button
- Enter counted amount
- Search will show previous shift
```

### Issue: Reconciliation doesn't match
```
Fix: Check payment methods
1. Verify cash sales total
2. Check for voided sales
3. Confirm opening float amount
4. Review all transactions for shift date
```

### Issue: Manager can't see shift
```
Fix: Check role and branch
1. Verify user role is 'manager' or 'admin'
2. Confirm branch_id matches
3. Check shift opened date
```

---

## Database Schema Quick Reference

### shifts table
```sql
- id (UUID) - Primary key
- branch_id - Links to branch
- cashier_id - Links to user
- shift_number - Auto-generated (e.g., HQ-2024-01-15-01)
- opened_at - Start time
- closed_at - End time (NULL if open)
- opening_float - Starting cash (in cents)
- status - 'open' | 'closed' | 'reopened'
```

### shift_ledgers table
```sql
- id (UUID) - Primary key
- shift_id - Links to shift
- action - 'opening' | 'closing'
- counted_cash - Actual amount counted
- expected_cash - Calculated from sales
- difference - counted - expected
- payment_breakdown - JSON with all methods
```

### shift_audit_log table
```sql
- id (UUID) - Primary key
- shift_id - Links to shift
- action - 'opened' | 'closed' | 'reopened'
- performed_by - User who performed action
- notes - Any notes entered
- created_at - When action occurred
```

---

## Monitoring & Alerts

### Daily Reconciliation Check
```
Manager should review nightly:
1. All shifts closed ✓
2. No significant over/short
3. Payment method breakdown reasonable
4. Transaction counts normal
```

### Red Flags to Investigate
- Any short over 100 KShs
- Missing shift numbers
- Multiple reopens on same shift
- Unusual payment method mix

---

## Permission Levels

| Role | Permissions |
|------|-------------|
| Cashier | Open/close own shift, view own summary |
| Manager | View all shifts, reopen closed shifts, access dashboard |
| Admin | Full access + audit logs |
| Customer | None |

---

## API Endpoints Summary

### `lib/shift-actions.ts`

#### openShift(branchId, cashierId, openingFloat)
Opens a new shift with specified opening float. Auto-generates shift number.

#### closeShift(shiftId, countedCash, closingNotes, cashierId)  
Closes shift, calculates reconciliation, records all metrics.

#### getActiveShift(branchId, cashierId)
Returns current open shift for cashier, or null if none.

#### getShiftSummary(shiftId)
Returns complete shift with ledger entries and audit log.

#### getShiftHistory(branchId, limit)
Returns last N shifts for branch with summaries.

#### reopenShift(shiftId, userId, reopenReason)
Reopens closed shift (manager/admin only). Requires reason.

---

## Next Steps

### Immediate (Today)
- [x] Run database migration
- [x] Add ShiftOperations to POS
- [x] Add ShiftDashboard to Settings
- [x] Test opening a shift

### Short Term (This Week)
- [ ] Integrate with actual sales data
- [ ] Test full reconciliation workflow
- [ ] Manager review shift analytics
- [ ] Verify audit log completeness

### Medium Term (This Month)
- [ ] Train staff on shift procedures
- [ ] Establish daily reconciliation process
- [ ] Monitor for over/short patterns
- [ ] Collect feedback for improvements

---

## Support & Debugging

### Check Database Created
```sql
-- In Supabase SQL Editor or psql:
SELECT * FROM shifts LIMIT 1;
SELECT * FROM shift_ledgers LIMIT 1;
SELECT * FROM shift_audit_log LIMIT 1;

-- Should return schema info (even if no rows)
```

### Check Frontend Components Load
```tsx
// In browser console (F12):
// If components load, no errors should appear
// Check Application tab for localStorage
```

### View Recent Shifts
```sql
SELECT 
  s.shift_number, 
  s.status, 
  sl.action,
  sl.difference
FROM shifts s
LEFT JOIN shift_ledgers sl ON s.id = sl.shift_id
ORDER BY s.opened_at DESC
LIMIT 10;
```

---

## Quick Reference Commands

### Test Opening Shift
```bash
# In browser DevTools Console:
await openShift('branch-id', 'user-id', 500000)
```

### View Active Shift
```bash
await getActiveShift('branch-id', 'user-id')
```

### Check Reconciliation Data
```sql
SELECT s.shift_number, sl.action, sl.difference, sl.payment_breakdown 
FROM shifts s 
LEFT JOIN shift_ledgers sl ON s.id = sl.shift_id 
WHERE s.status = 'closed' 
ORDER BY s.closed_at DESC 
LIMIT 5;
```

---

## Rollback if Needed

```sql
-- If something goes wrong, revert with:
DROP TABLE IF EXISTS shift_audit_log;
DROP TABLE IF EXISTS shift_ledgers;
DROP TABLE IF EXISTS shifts;
DROP VIEW IF EXISTS shift_summaries;
DROP VIEW IF EXISTS daily_reconciliation_summary;

-- Then you can re-run the migration
```

---

That's it! The shift management system is ready to deploy. Start with testing opening/closing a shift with real users today.
