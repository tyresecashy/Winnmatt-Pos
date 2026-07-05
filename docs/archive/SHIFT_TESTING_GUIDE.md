# Shift Management System - Testing Guide

## Pre-Flight Checklist

Before testing, ensure:
- [ ] Database migration executed (`002_shift_management.sql`)
- [ ] Components installed (`ShiftOperations`, `ShiftDashboard`)
- [ ] UI components available (Button, Input, Dialog, Table, etc.)
- [ ] Test user accounts created with different roles
- [ ] Sales data available (or will create test sales)

---

## Test Environment Setup

### Test Users to Create (Recommended)

```sql
-- Cashier User
INSERT INTO users (id, email, full_name, role, branch_id)
VALUES (
  gen_random_uuid(),
  'cashier1@test.com',
  'John Cashier',
  'cashier',
  'your-branch-id'
);

-- Manager User  
INSERT INTO users (id, email, full_name, role, branch_id)
VALUES (
  gen_random_uuid(),
  'manager1@test.com',
  'Jane Manager',
  'manager',
  'your-branch-id'
);

-- Admin User
INSERT INTO users (id, email, full_name, role, branch_id)
VALUES (
  gen_random_uuid(),
  'admin1@test.com',
  'Admin User',
  'admin',
  'your-branch-id'
);
```

### Test Branch (if needed)
```sql
INSERT INTO branches (id, name, code, location)
VALUES (
  'test-branch-id',
  'Test Branch',
  'TEST',
  'Test Location'
);
```

---

## Test Suite 1: Basic Shift Operations

### Test 1.1: Open Shift - Valid Input
**Objective**: Verify opening a shift with valid opening float

**Steps**:
1. Login as: `cashier1@test.com`
2. Navigate to: POS Dashboard
3. Verify: "No active shift" message visible
4. Click: "Open Shift" button
5. Enter: Opening float = `5000`
6. Click: "Open Shift" confirm button

**Expected Results**:
- ✓ Success toast message appears
- ✓ Shift number displays (format: `TEST-2024-01-15-01`)
- ✓ Opening float shows: `KShs 5,000.00`
- ✓ Shift status changes to "ACTIVE" (green)
- ✓ Shift component shows duration timer

**Database Check**:
```sql
SELECT id, shift_number, status, opening_float 
FROM shifts 
WHERE cashier_id = 'cashier1-id' 
ORDER BY opened_at DESC LIMIT 1;

-- Should show: TEST-2024-01-15-01, open, 500000
```

---

### Test 1.2: Open Shift - Invalid Input
**Objective**: Verify validation rejects invalid amounts

**Steps**:
1. Click: "Open Shift" button
2. Enter: Opening float = `invalid`
3. Click: "Open Shift" confirm button

**Expected Results**:
- ✓ Error toast: "Invalid Input - Please enter a valid opening float amount"
- ✓ Dialog remains open
- ✓ No database entry created

---

### Test 1.3: Open Shift - Duplicate Check
**Objective**: Verify can't open second shift same day

**Precondition**: Already have open shift (from Test 1.1)

**Steps**:
1. Try to open another shift
2. Enter: Opening float = `5000`
3. Click: "Open Shift" confirm

**Expected Results**:
- ✓ Error message: "Cashier already has an open shift: TEST-2024-01-15-01"
- ✓ Dialog closes
- ✓ Original shift remains active

---

### Test 1.4: Close Shift - Perfect Reconciliation
**Objective**: Verify correct reconciliation with matching amounts

**Precondition**: Active shift with opening float 5,000 KShs

**Steps**:
1. Create test sales (via API or manual):
   - Sale 1: 2,000 KShs (cash) 
   - Sale 2: 1,500 KShs (card)
   - Sale 3: 1,000 KShs (M-Pesa)
2. Click: "Close Shift" button
3. Enter: Counted cash = `7500` (5k opening + 2.5k cash sales)
4. Enter: Notes = `Perfect count`
5. Click: "Close Shift" confirm

**Expected Results**:
- ✓ Success message: "Shift closed successfully. Perfect reconciliation!"
- ✓ Component shows: "No active shift" message
- ✓ Toast message indicates perfect count

**Database Check**:
```sql
SELECT 
  s.status, 
  sl.action, 
  sl.counted_cash, 
  sl.expected_cash, 
  sl.difference
FROM shifts s
LEFT JOIN shift_ledgers sl ON s.id = sl.shift_id
WHERE s.shift_number = 'TEST-2024-01-15-01'
ORDER BY sl.created_at;

-- Should show:
-- 1. action='opening', counted=500000, expected=500000, diff=0
-- 2. action='closing', counted=750000, expected=750000, diff=0
```

---

### Test 1.5: Close Shift - Cash Over
**Objective**: Detect money over in drawer

**Precondition**: New open shift with float 5,000 KShs

**Setup**:
1. Create sales: 2,000 KShs (cash), 1,500 KShs (card)
2. Close shift: Count 7,600 KShs (100 over)

**Expected Results**:
- ✓ Success message: "Shift closed successfully. Over by KShs 100.00"
- ✓ Ledger shows: `difference: 10000` (100 KShs in cents)
- ✓ Audit log notes over amount

---

### Test 1.6: Close Shift - Cash Short
**Objective**: Detect missing cash in drawer

**Precondition**: New open shift with float 5,000 KShs

**Setup**:
1. Create sales: 2,000 KShs (cash), 1,500 KShs (card)
2. Close shift: Count 7,400 KShs (100 short)

**Expected Results**:
- ✓ Success message: "Shift closed successfully. Short by KShs 100.00"
- ✓ Ledger shows: `difference: -10000` (negative)
- ✓ Alert displayed in dashboard
- ✓ Audit log investigation note

---

## Test Suite 2: Shift Summary & History

### Test 2.1: View Shift Summary
**Objective**: Verify shift summary shows all details

**Steps**:
1. From closed shift card, click: "View Summary"
2. Review modal content

**Expected Results**:
- ✓ Shift number displays
- ✓ Opening float shown: `KShs 5,000.00`
- ✓ Cash sales: `KShs 2,000.00`
- ✓ Card sales: `KShs 1,500.00`
- ✓ M-Pesa sales: `KShs 1,000.00`
- ✓ Over/short status displays correctly
- ✓ Transaction count shows (e.g., "3 transactions")

---

### Test 2.2: Get Shift History
**Objective**: Verify history returns all shifts

**Setup**: Create 3 closed shifts

**Steps**:
1. Login as manager
2. Go to Settings → Shift Management
3. Observe shifts table

**Expected Results**:
- ✓ All 3 shifts appear in table
- ✓ Most recent shown first
- ✓ Correct shift numbers (TEST-2024-01-15-01, 02, 03)
- ✓ All statuses show as "closed"
- ✓ All sales totals accurate

---

## Test Suite 3: Manager Dashboard

### Test 3.1: Dashboard Summary Cards
**Objective**: Verify summary metrics calculate correctly

**Setup**: 3 closed shifts, 1 open shift

**Expected Results**:
- ✓ Total Shifts: 4
- ✓ Active: 1
- ✓ Closed: 3
- ✓ Total Sales: Sum of all shifts
- ✓ Cards show green/blue indicators

---

### Test 3.2: Daily Sales Trend Chart
**Objective**: Verify bar chart displays correctly

**Setup**: Multiple shifts over 3 days with mixed payment methods

**Expected Results**:
- ✓ Chart displays with 3 date bars
- ✓ Each bar shows cash (green), card (blue), M-Pesa (purple)
- ✓ Correct heights proportional to sales
- ✓ Tooltip shows values on hover
- ✓ Legend visible with all payment methods

---

### Test 3.3: Payment Methods Pie Chart
**Objective**: Verify pie chart breakdown

**Expected Results**:
- ✓ Three slices for Cash, Card, M-Pesa
- ✓ Proportions accurate
- ✓ Labels show payment method and amount
- ✓ Colors match legend (green, blue, purple)
- ✓ Tooltip shows KShs amounts

---

### Test 3.4: Shifts Table with Filters
**Objective**: Filter shifts by status and date

**Setup**: Create shifts with different statuses

**Steps**:
1. Click Status filter dropdown
2. Select: "open"
3. Verify: Only open shifts show
4. Select: "closed"
5. Verify: Only closed shifts show
6. Select: "all"
7. Verify: All shifts show

**Expected Results**:
- ✓ Filter updates instantly
- ✓ Correct shifts displayed
- ✓ Row count updates
- ✓ No shifts match if none exist for filter

---

### Test 3.5: Over/Short Alert
**Objective**: Verify alert displays when there are discrepancies

**Setup**: Create one over shift (+100) and one short shift (-100)

**Expected Results**:
- ✓ Alert displays at top: "Total differences: Over KShs 100 | Short KShs 100"
- ✓ Alert has amber background (warning style)
- ✓ Alert disappears when all shifts reconcile

---

## Test Suite 4: Advanced Features

### Test 4.1: Reopen Shift (Manager Only)
**Objective**: Verify manager can reopen closed shift

**Precondition**: Closed shift, logged in as manager

**Steps**:
1. In Shifts table, find closed shift
2. Click: "Reopen" button
3. Enter reason: `Customer refund needed - receipt issue`
4. Click: "Reopen Shift" button

**Expected Results**:
- ✓ Success message appears
- ✓ Shift status in table changes to "reopened"
- ✓ Audit log entry created with reason
- ✓ Timestamp recorded

**Database Check**:
```sql
SELECT status, reopened_by, reopened_at 
FROM shifts 
WHERE shift_number = 'TEST-2024-01-15-01';

-- Shows: reopened, manager-id, timestamp
```

---

### Test 4.2: Reopen - Cashier Cannot Access
**Objective**: Verify cashiers can't reopen shifts

**Precondition**: Logged in as cashier, looking at manager dashboard

**Expected Results**:
- ✓ Reopen button not visible
- ✓ Only "View" button available
- ✓ Access denied if attempting via API

---

### Test 4.3: Shift Audit Log
**Objective**: Verify all actions logged

**Action History**:
1. Open shift (logs: "opened")
2. Close shift (logs: "closed")  
3. Reopen shift (logs: "reopened")

**Verification**:
```sql
SELECT action, performed_by, notes, created_at
FROM shift_audit_log
WHERE shift_id = 'shift-id'
ORDER BY created_at;

-- Shows 3 entries in correct order with timestamps
```

**Expected Results**:
- ✓ All 3 actions logged
- ✓ User IDs correct
- ✓ Timestamps sequential
- ✓ Notes capture all details

---

### Test 4.4: Shift Number Uniqueness
**Objective**: Verify shift numbers never duplicate

**Steps**:
1. Create 5 shifts in same branch on same day
2. Check all shift numbers

**Expected Results**:
- ✓ All unique: TEST-2024-01-15-01, 02, 03, 04, 05
- ✓ Sequence increments correctly

---

## Test Suite 5: Error Handling

### Test 5.1: Database Connection Error
**Objective**: Verify graceful handling of DB errors

**Simulate**:
1. Disable database connection temporarily
2. Try to open shift

**Expected Results**:
- ✓ Error toast message appears
- ✓ Component remains usable
- ✓ No console errors
- ✓ Can retry after connection restored

---

### Test 5.2: Missing Required Fields
**Objective**: Validate all required fields

**Tests**:
1. Try close without counted cash
2. Try reopen without reason

**Expected Results**:
- ✓ Error message for each
- ✓ Form won't submit
- ✓ Focus on required field

---

### Test 5.3: Timezone Handling
**Objective**: Verify timestamps consistent across timezones

**Setup**: User in different timezone

**Verification**:
- ✓ Shift open time matches browser time
- ✓ Database stores UTC
- ✓ Display shows local time
- ✓ Duration calculated correctly

---

## Test Suite 6: Integration with Sales

### Test 6.1: Sales Linked to Shift
**Objective**: Verify sales properly associated (if implementing)

**Steps**:
1. Open shift
2. Create sale via POS
3. Check sale record

**Expected Results**:
- ✓ Sale has `shift_id` field populated
- ✓ Shift reconciliation includes this sale
- ✓ All payment methods tracked

---

### Test 6.2: Voided Sales Excluded
**Objective**: Ensure voided sales don't affect reconciliation

**Setup**:
1. Open shift (5,000 KShs)
2. Sale 1: 3,000 KShs (not voided)
3. Sale 2: 2,000 KShs (voided)
4. Close: Count 8,000 KShs

**Expected Results**:
- ✓ Reconciliation ignores voided sale
- ✓ Expected: 5,000 + 3,000 = 8,000
- ✓ Difference: 0 (perfect)
- ✓ Not: 5,000 + 3,000 + 2,000 = 10,000

---

## Test Suite 7: Performance

### Test 7.1: Large Shift History
**Objective**: Dashboard handles many shifts

**Setup**: 500 shifts in database

**Steps**:
1. Load dashboard
2. Observe render time
3. Scroll through table

**Expected Results**:
- ✓ Loads in < 2 seconds
- ✓ Charts render smoothly
- ✓ Table pagination works (if implemented)
- ✓ No console errors

---

### Test 7.2: Complex Reconciliation
**Objective**: Verify calculate speed for complex scenarios

**Setup**: Shift with 100+ transactions, mixed payment methods

**Results**:
- ✓ Close completes in < 1 second
- ✓ All calculations accurate
- ✓ No timeouts

---

## Test Results Template

```markdown
# Shift Management Testing Report

Date: ___________
Tester: _________
Environment: _________

## Test Suite 1: Basic Operations
- Test 1.1 Open Shift (Valid): [ ] PASS [ ] FAIL - Notes: ___
- Test 1.2 Open Shift (Invalid): [ ] PASS [ ] FAIL - Notes: ___
- Test 1.3 Duplicate Check: [ ] PASS [ ] FAIL - Notes: ___
- Test 1.4 Perfect Reconciliation: [ ] PASS [ ] FAIL - Notes: ___
- Test 1.5 Cash Over: [ ] PASS [ ] FAIL - Notes: ___
- Test 1.6 Cash Short: [ ] PASS [ ] FAIL - Notes: ___

## Test Suite 2: Summary & History
- Test 2.1 View Summary: [ ] PASS [ ] FAIL - Notes: ___
- Test 2.2 Shift History: [ ] PASS [ ] FAIL - Notes: ___

## Test Suite 3: Dashboard
- Test 3.1 Summary Cards: [ ] PASS [ ] FAIL - Notes: ___
- Test 3.2 Trend Chart: [ ] PASS [ ] FAIL - Notes: ___
- Test 3.3 Pie Chart: [ ] PASS [ ] FAIL - Notes: ___
- Test 3.4 Table Filters: [ ] PASS [ ] FAIL - Notes: ___
- Test 3.5 Over/Short Alert: [ ] PASS [ ] FAIL - Notes: ___

## Test Suite 4: Advanced
- Test 4.1 Reopen Shift: [ ] PASS [ ] FAIL - Notes: ___
- Test 4.2 Cashier Access: [ ] PASS [ ] FAIL - Notes: ___
- Test 4.3 Audit Log: [ ] PASS [ ] FAIL - Notes: ___
- Test 4.4 Uniqueness: [ ] PASS [ ] FAIL - Notes: ___

## Test Suite 5: Error Handling
- Test 5.1 DB Error: [ ] PASS [ ] FAIL - Notes: ___
- Test 5.2 Missing Fields: [ ] PASS [ ] FAIL - Notes: ___
- Test 5.3 Timezone: [ ] PASS [ ] FAIL - Notes: ___

## Test Suite 6: Integration
- Test 6.1 Sales Linked: [ ] PASS [ ] FAIL - Notes: ___
- Test 6.2 Voided Sales: [ ] PASS [ ] FAIL - Notes: ___

## Test Suite 7: Performance
- Test 7.1 History: [ ] PASS [ ] FAIL - Notes: ___
- Test 7.2 Complex: [ ] PASS [ ] FAIL - Notes: ___

## Summary
Total Tests: 20
Passed: ___
Failed: ___
Pass Rate: ___%

Signed: _____________ Date: _______
```

---

## Debugging Tips

### Check Shift Created
```javascript
// Browser console:
fetch('/api/shifts').then(r => r.json()).then(console.log)
```

### View Actual Calculations
```sql
-- In Supabase SQL Editor:
SELECT s.shift_number, sl.action, 
       sl.counted_cash, sl.expected_cash, sl.difference
FROM shifts s
JOIN shift_ledgers sl ON s.id = sl.shift_id
ORDER BY s.opened_at DESC;
```

### Check Permissions
```sql
-- Verify user role:
SELECT role FROM users WHERE id = 'user-id';
```

---

## Quick Test Checklist

- [ ] Database migration successful
- [ ] Components loading without errors
- [ ] Can open shift
- [ ] Can close shift with reconciliation
- [ ] Manager can view dashboard
- [ ] Over/short detected correctly
- [ ] Audit trail created
- [ ] Charts display
- [ ] No console errors
- [ ] All tests passing

Once all tests pass, system is ready for production!
