# AUDIT VERIFICATION PROCEDURES

## Pre-Fix Verification (FAILS BEFORE FIXES)

Run these tests to confirm the bugs exist:

### Test 1: M-Pesa Loyalty Points NOT Awarded
```bash
Procedure:
1. In POS, select a customer
2. Add items (total = 100 KSh = 10000 cents)
3. Select M-Pesa payment method
4. Complete M-Pesa payment (simulate in sandbox)
5. Query database:
   
   SELECT loyalty_points FROM customers WHERE id = '<customer-id>';
   SELECT * FROM loyalty_transactions WHERE customer_id = '<customer-id>';

Expected BEFORE FIX:
   ❌ loyalty_points unchanged
   ❌ NO loyalty_transactions entry for this sale (BUG!)

Expected AFTER FIX:
   ✅ loyalty_points increased by (10000 / 10000) = 1 point (if default threshold)
   ✅ loyalty_transactions has entry: type='earn_sale', points_delta=1
```

### Test 2: M-Pesa Redemption LOST
```bash
Procedure:
1. Give customer 100 points via manual insert:
   UPDATE customers SET loyalty_points = 100 WHERE id = '<id>';

2. In POS, create order for same customer:
   - Items total = 1000 KSh = 100000 cents
   - Click "Use Loyalty Points" checkbox
   - Enter 50 points (= 25 KSh with default 50 cents per point)
   - Verify discount shown in checkout: 975 KSh (reduced)
   - Select M-Pesa payment
   - Complete payment

3. Query database:
   SELECT loyalty_points FROM customers WHERE id = '<customer-id>';
   SELECT * FROM loyalty_transactions WHERE customer_id = '<customer-id>' ORDER BY created_at DESC;

Expected BEFORE FIX:
   ❌ loyalty_points still = 100 (NOT reduced!)
   ❌ NO loyalty_transactions with type='redeem_sale'
   ❌ Customer keeping discount without paying points (BUG!)

Expected AFTER FIX:
   ✅ loyalty_points = 50 (100 - 50 redeemed)
   ✅ loyalty_transactions has: type='redeem_sale', points_delta=-50
```

### Test 3: Business Accounts Shows FAKE Data
```bash
Procedure:
1. Navigate to: /app/(dashboard)/business-accounts
2. Look at displayed business accounts list

Expected BEFORE FIX:
   ❌ Shows exactly 3 hardcoded businesses:
      - Sunrise Hotel (17.5 KShs)
      - Green Valley Resort (0 KShs)
      - Kilimani Club (78.5 KShs)
   ❌ These are mock-data, not from database

Expected AFTER FIX:
   ✅ Shows actual business customers from customers table
   ✅ If you create new business customer, it appears here
   ✅ Data changes match what you see in POS customer lookup
```

### Test 4: Settings Shows FAKE Branches
```bash
Procedure:
1. Navigate to: /app/(dashboard)/settings
2. Look at Branch dropdown (for branch-specific settings)

Expected BEFORE FIX:
   ❌ Shows exactly 2 hardcoded branches:
      - Main Branch - Nakuru (branch-1)
      - Eldoret Branch (branch-2)
   ❌ Branch IDs are hardcoded strings, not database IDs

Expected AFTER FIX:
   ✅ Shows real branches from branches table
   ✅ If you add new branch to DB, it appears here after page refresh
   ✅ Branch IDs are actual UUIDs from database
```

---

## Post-Fix Verification (PASSES AFTER FIXES)

### Test Suite 1: M-Pesa Loyalty Integration

#### 1.1 Loyalty Earning with M-Pesa
```bash
Setup:
  - Create test customer
  - Give customer 0 loyalty points

Steps:
  1. In POS: Select Test Customer
  2. Add Products:
     - Coca-Cola (50 KSh)
     - Milk (75 KSh)
     Total = 125 KSh = 12500 cents
  3. No discounts
  4. Pay with M-Pesa (sandbox)

Verification:
  ✅ Sale created with payment_status='pending'
  ✅ STK Push sent (phone shows prompt)
  ✅ Customer completes payment in M-Pesa
  ✅ Callback received
  ✅ Sale payment_status updated to 'completed'
  ✅ NEW: Loyalty points awarded:
     - Points = 12500 / 10000 = 1.25 → floor = 1 point
     - customer.loyalty_points increased by 1
  ✅ loyalty_transactions table shows:
     - type='earn_sale'
     - points_delta=1
     - balance_before=0, balance_after=1
  ✅ Receipt shows "1 point earned"
```

#### 1.2 Loyalty Redemption with M-Pesa
```bash
Setup:
  - Test customer has 100 loyalty points
  - Default: 50 cents per point = 0.5 KSh

Steps:
  1. In POS: Select Test Customer
  2. Add Products: 200 KSh total = 20000 cents
  3. Enable "Use Loyalty" checkbox
  4. Slider shows: max redeemable = 100 points = 50 KSh
  5. Select 40 points to redeem = 20 KSh discount
  6. Checkout shows:
     - Subtotal: 200 KSh
     - Loyalty discount: -20 KSh
     - Total: 180 KSh
  7. Pay with M-Pesa (sandbox)

Verification:
  ✅ Sale created with total_amount=20000 (original, not reduced)
  ✅ M-Pesa transaction includes redemption_data field
  ✅ Customer pays M-Pesa for 180 KSh equivalent amount
  ✅ Callback received
  ✅ NEW: Redemption applied:
     - Points deducted: customer.loyalty_points = 60 (100-40)
     - loyalty_transactions has type='redeem_sale'
     - points_delta=-40
  ✅ Receipt shows:
     - Original total: 200 KSh
     - Loyalty redemption: -20 KSh
     - Final total: 180 KSh
     - "40 points redeemed"
```

#### 1.3 Sale Void with M-Pesa Loyalty
```bash
Setup:
  - Completed M-Pesa sale with 10 earned points + 5 redeemed points
  - Customer final balance: 85 points

Steps:
  1. In Sales History, find the M-Pesa transaction
  2. Click "Void Sale"
  3. Enter reason: "Customer requested"
  4. Confirm void

Verification:
  ✅ Sale payment_status set to 'failed' (void marker)
  ✅ Inventory restored (tested elsewhere)
  ✅ Audit log created with operator, timestamp, reason
  ✅ NEW: Loyalty reversed correctly:
     - Earned points reversed: -10 points
     - Redeemed points restored: +5 points
     - Net change: -5 points
     - Customer balance: 90 points (85 + 5 restored)
  ✅ loyalty_transactions has two entries:
     - type='reverse_void' (earned points)
     - type='reverse_redeem' (redeemed points)
```

### Test Suite 2: UI Mock Data Fixes

#### 2.1 Business Accounts Page
```bash
Setup:
  1. Create test business customer in POS:
     - Name: "Test Hotel Ltd"
     - Type: "business"
     - Phone: "0722999888"
     - Credit limit: 50000 cents

Steps:
  1. Navigate to Business Accounts page
  2. Wait for load (should query DB now)
  3. Search for "Test Hotel"
  4. Verify it appears in list
  5. Click on it to see details

Verification:
  ✅ Page shows real customers, not hardcoded 3
  ✅ Test Hotel shows in results
  ✅ All fields match what you entered (name, phone, credit)
  ✅ Credit totals calculated from real data
  ✅ Can search/filter by name/phone
  ✅ Add NEW business customer and refresh page
  ✅ NEW customer appears (wasn't there before)
```

#### 2.2 Settings - Branch Selection
```bash
Setup:
  1. You have multiple real branches in DB

Steps:
  1. Navigate to Settings page
  2. Look at Branch dropdown
  3. Add new branch to DB (SQL):
     INSERT INTO branches VALUES (..., 'Test Branch', 'TST-003', ...)
  4. Return to Settings page
  5. Click Branch dropdown

Verification:
  ✅ Shows all real branches (not just Nakuru + Eldoret)
  ✅ Branch IDs are real UUIDs (not "branch-1", "branch-2")
  ✅ New branch appears after adding to DB
  ✅ Can select different branches
  ✅ Settings changes save per branch
```

### Test Suite 3: Error Handling

#### 3.1 M-Pesa Callback Error Logging
```bash
Setup:
  - Enable verbose logging in Node environment

Steps:
  1. Create M-Pesa transaction
  2. Trigger payment timeout (don't complete on M-Pesa)
  3. Wait 30 minutes or manually send timeout callback
  4. Check server logs

Verification:
  ✅ Logs show detailed error info:
     - Timestamp
     - Sale ID affected
     - Specific error code
     - Attempted action
  ✅ Sale marked as 'failed'
  ✅ No stack trace dump (handled gracefully)
  ✅ System remains stable (doesn't crash)
```

#### 3.2 Redemption Failure Handling
```bash
Setup:
  - Create M-Pesa transaction with redemption
  - Simulate customer deletion before callback

Steps:
  1. Before callback arrives, delete the customer:
     DELETE FROM customers WHERE id = '<id>';
  2. Send callback payload
  3. Check logs and DB

Verification:
  ✅ Callback processed (returns 200)
  ✅ Logs show "Customer not found" warning (NOT error)
  ✅ Sale still finalized (payment confirmed)
  ✅ System handles gracefully (no crash)
  ✅ Manual reconciliation can fix loyalty later
```

---

## Production Pre-Deployment Checklist

### Database
- [ ] All migrations run in correct order (verify no errors)
- [ ] `mpesa_transactions.redemption_data` column exists
- [ ] `loyalty_transactions` table has all required columns
- [ ] Indexes created: loyalty_points, mpesa_status, etc.
- [ ] Row-level security policies enabled
- [ ] Backups enabled and automated

### Environment Variables
- [ ] `.env.local` has all required M-Pesa credentials
- [ ] `MPESA_ENVIRONMENT=sandbox` (for staging)
- [ ] `MPESA_ENVIRONMENT=production` (for prod)
- [ ] `MPESA_CALLBACK_URL` correct for environment
- [ ] No sensitive data in Git or logs

### API Endpoints
- [ ] `/api/mpesa/stk-push` accepts redemption data
- [ ] `/api/mpesa/callback` stores and applies redemption
- [ ] `/api/mpesa/status` returns correct transaction states
- [ ] All endpoints return 200 OK within 30 seconds

### Frontend
- [ ] Payment panel shows loyalty redemption option
- [ ] M-Pesa redemption data passed to API
- [ ] Receipt shows "points earned" + "points redeemed"
- [ ] No errors in browser console during M-Pesa flow

### Monitoring
- [ ] Error logging enabled (Sentry/LogRocket)
- [ ] Alerts configured for M-Pesa failures
- [ ] Database monitoring enabled
- [ ] Daily reports of:
  - M-Pesa transaction completion rate
  - Loyalty point calculations
  - Failed payments / stuck transactions

### Testing
- [ ] Unit tests pass for loyalty functions
- [ ] Integration tests pass for M-Pesa flow
- [ ] E2E tests pass for complete POS flow
- [ ] Load test with 100+ concurrent transactions
- [ ] Manual smoke test (real payment, sandbox M-Pesa)

### Documentation
- [ ] Staff trained on loyalty features
- [ ] Customer-facing docs on loyalty program
- [ ] Troubleshooting guide for common issues
- [ ] Rollback procedures documented

---

## Post-Deployment Monitoring (First Week)

### Daily Checks
```bash
# Check M-Pesa transaction health
SELECT 
  COUNT(*) as total,
  COUNT(CASE WHEN status='confirmed' THEN 1 END) as confirmed,
  COUNT(CASE WHEN status='pending' THEN 1 END) as pending,
  COUNT(CASE WHEN status='failed' THEN 1 END) as failed
FROM mpesa_transactions
WHERE created_at >= NOW() - INTERVAL '24 hours';

# Expected: >98% confirmed, <1% pending, <1% failed

# Check loyalty point calculations
SELECT SUM(points_delta) as total_points_awarded
FROM loyalty_transactions
WHERE type='earn_sale'
AND created_at >= NOW() - INTERVAL '24 hours';

# Expected: Should be positive, correlate with sales volume

# Check for stuck transactions
SELECT COUNT(*) as stuck_count
FROM mpesa_transactions
WHERE status='pending'
AND created_at < NOW() - INTERVAL '1 hour'
AND callback_received_at IS NULL;

# Expected: Should be 0 (most callbacks within 2 minutes)
```

### Weekly Reconciliation
```bash
# Verify loyalty math
1. Sum all earn_sale points
2. Subtract all redeem_sale points
3. Subtract all reverse_* points
4. Compare result with customer.loyalty_points balance

Expected: Exactly matches total loyalty_points in DB

# Verify M-Pesa amounts
1. Sum all confirmed mpesa_transactions.amount
2. Compare with sales.total_amount for those sales

Expected: Exactly matches within 1 cent (rounding)
```

### Monthly Review
- [ ] Loyalty program adoption rate
- [ ] M-Pesa redemption usage
- [ ] Average points earned per transaction
- [ ] Average points redeemed per transaction
- [ ] Identify and fix any bugs found

---

## Failed Test Recovery

If any test fails:

```bash
# Find the root cause
1. Check server logs for errors
2. Check database state (query affected records)
3. Check API responses (test endpoint directly)
4. Review fix code for typos/logic errors

# Rollback if needed
1. git revert <commit>
2. Restart server
3. Test again with simpler scenario
4. Fix in code, retest

# Don't deploy if
- Any critical test fails
- Performance degraded >10%
- Error rate >1%
- Any crashes occur
```

---

**All tests must pass before production deployment**

**Test execution time**: ~2-3 hours for full suite

**Monthly test re-run**: Essential to catch regressions
