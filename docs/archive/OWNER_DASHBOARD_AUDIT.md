# Owner Dashboard / Enterprise Controls Audit

**Date:** April 9, 2026  
**Status:** Gaps Identified - Ready for Implementation  
**Scope:** Owner-level control experience polish

---

## OWNER EXPERIENCE GAPS FOUND

### Gap 1: No Owner-Only Navigation Section
**Current State:**
- Sidebar shows: Main → Inventory → Sales & Customers → **Administration** (all roles)
- Owner sees same sidebar as Admin
- No visual distinction for owner-specific controls
- No enterprise-wide hub

**Gap:** Owner should have dedicated "Enterprise" section in sidebar

---

### Gap 2: Settings Page Not Owner-Branded
**Current State:**
- Settings page loads for all roles (limited by permission)
- Loyalty settings show "Only Owner can modify" alert
- No owner-specific dashboard context
- No centralized owner control panel

**Gap:**
- Settings page should show owner context differently
- Should hide non-owner tabs for owner view
- Missing "Enterprise Overview" in settings

---

### Gap 3: No Branch Performance Dashboard
**Current State:**
- Dashboard shows stats but doesn't clarify whose data (owner vs branch)
- Reports have `getBranchPerformanceStats()` (cross-branch) but:
  - Not prominently featured
  - No owner-only report view
  - Reports page doesn't differentiate owner visibility
  - Missing branch comparison table/metrics

**Gap:**
- Need owner-specific enterprise dashboard widget
- Branch performance comparison should be owner-only
- Owner should see all branches on one page

---

### Gap 4: No Audit Log / Activity Visibility
**Current State:**
- `audit_logs` table exists (created by owner-loyalty-migration.sql)
- Zero audit log visibility in UI
- Owner has no way to see:
  - Who did what when
  - Settings changes by admins
  - User role modifications
  - Loyalty settings updates

**Gap:**
- Authority should have audit trail viewer
- Critical for owner oversight
- Currently audit table populated but not surfaced

---

### Gap 5: Users Page Doesn't Show Owner Level
**Current State:**
- Users page checks `profile?.role === 'admin'` only
- Owner can't manage users (restricted to admins)
- No owner-admin separation
- Owner account has no management interface

**Gap:**
- Owner should be able to:
  - Create/edit admin accounts
  - View all users across branches
  - See admin actions
  - Delegate admin roles

---

### Gap 6: Loyalty Settings Not Owner-Branded
**Current State:**
- Loyalty settings in Settings tab (looks like regular admin control)
- Alert says "Only owner can modify"
- No owner-specific context
- Settings page feels admin-centric not enterprise-centric

**Gap:**
- Owner should have:
  - Enterprise-wide loyalty dashboard (earnings, redemptions, customer tier)
  - Clear owner-only badge
  - Enterprise-wide analytics

---

### Gap 7: No Enterprise Visibility Context
**Current State:**
- Header shows "Main Branch" for everyone
- No indicator that owner sees:
  - All branches
  - Enterprise data
  - Global settings
- Users might not understand scope of their authority

**Gap:**
- Owner header should clearly show "Enterprise Owner"
- Owner dashboard should emphasize global visibility
- Clear separation of roles materially

---

### Gap 8: Reports Page Doesn't Show Owner View
**Current State:**
- Reports page loads for all authenticated users
- Uses branch-scoped functions
- No owner-enterprise-wide view
- `getBranchPerformanceStats()` exists but not used

**Gap:**
- Owner should see:
  - Cross-branch comparison
  - Enterprise KPIs
  - Sales by cashier across branches
  - Loyalty program metrics (enterprise-wide)

---

## ROOT CAUSES

1. **Role enforcement exists** (database + user-management) but **UI doesn't leverage it**
2. **Owner navigation underutilized** - sidebar treats all roles equally
3. **Reports/dashboard are branch-centric** - no owner-specific views
4. **Audit logs exist but invisible** - no retrieval or display
5. **Settings page is admin-centric** - owner context lost
6. **No enterprise-wide widgets** - owner sees same POS/inventory/sales as admin

---

## IMPLEMENTATION PLAN

### Phase 1: Owner Navigation & Context (Priority: CRITICAL)
**Files to modify:**
1. `components/app-sidebar.tsx` - Add "Enterprise" section for owner
2. `app/(dashboard)/layout.tsx` - Show owner context in header
3. `contexts/auth-context.tsx` - Expose isOwner helper (optional)

**Changes:**
- Conditionally show "Enterprise" nav section if role === 'owner'
- Items: Enterprise Dashboard, Branch Oversight, Audit Logs, User Management, Loyalty Oversight
- Header badge: "Enterprise Owner" for owner role

---

### Phase 2: Owner-Specific Dashboard (Priority: HIGH)
**Files to create/modify:**
1. `app/(dashboard)/enterprise/(new route)` - NEW: Enterprise dashboard
   - Branch performance comparison widget
   - Enterprise loyalty metrics
   - User activity summary
2. `components/dashboard/enterprise-stats.tsx` - NEW: Owner-wide stats
3. `components/dashboard/branch-performance-table.tsx` - NEW: Cross-branch table

**Features:**
- Show all branches side-by-side
- Compare sales, cash flow, loyalty by branch
- Latest activities from all branches

---

### Phase 3: Audit Logs Viewer (Priority: HIGH)
**Files to create/modify:**
1. `app/(dashboard)/audit-logs/page.tsx` - NEW: Audit log viewer
2. `lib/audit-actions.ts` - NEW: Get audit logs (owner-only)
3. `components/audit/audit-log-table.tsx` - NEW: Audit table UI

**Features:**
- Search/filter by action, actor, date
- Show who changed what when
- Details drawer for each action

---

### Phase 4: Owner-Focused Settings (Priority: MEDIUM)
**Files to modify:**
1. `app/(dashboard)/settings/page.tsx` - Restructure for owner view
   - Hide branch, payment tabs (admin only)
   - Show loyalty, enterprise, audit settings
   - Owner-only badge on loyalty settings

**Changes:**
- Tab selection based on role
- Owner sees: General, Loyalty Oversight, Enterprise, Audit
- Admin sees: General, Branches, Loyalty, Payments, Receipts

---

### Phase 5: User Management for Owner (Priority: MEDIUM)
**Files to modify:**
1. `app/(dashboard)/users/page.tsx` - Add owner capabilities
2. `lib/user-management.ts` - NEW: `getAdmins()` function (owner-only)

**Features:**
- Owner can create/manage admin accounts
- View all users across all branches
- See admin actions/activity

---

### Phase 6: Enterprise Loyalty Dashboard (Priority: LOW)
**Files to create/modify:**
1. `app/(dashboard)/loyalty/(new route)` - NEW: Loyalty oversight
2. `lib/loyalty-actions.ts` - Add enterprise queries
   - `getEnterpriseEarnings()`
   - `getEnterpriseRedemptions()`
   - `getTopCustomersByPoints()`

---

## EXACT FILES TO CHANGE

| File | Change Type | Reason |
|------|-------------|--------|
| `components/app-sidebar.tsx` | MODIFY | Add Enterprise nav section for owner |
| `app/(dashboard)/layout.tsx` | MODIFY | Show "Enterprise Owner" context in header |
| `app/(dashboard)/enterprise/page.tsx` | CREATE | NEW owner dashboard |
| `app/(dashboard)/audit-logs/page.tsx` | CREATE | NEW audit log viewer |
| `app/(dashboard)/settings/page.tsx` | MODIFY | Owner-specific tab organization |
| `app/(dashboard)/users/page.tsx` | MODIFY | Add owner admin management |
| `lib/audit-actions.ts` | CREATE | NEW: Query audit logs |
| `lib/reports-actions.ts` | MODIFY | Add enterprise query functions |
| `components/dashboard/enterprise-stats.tsx` | CREATE | NEW: Owner-wide metrics |
| `components/dashboard/branch-performance-table.tsx` | CREATE | NEW: Cross-branch table |
| `components/audit/audit-log-table.tsx` | CREATE | NEW: Audit table UI |

---

## BROWSER TEST STEPS

### Test 1: Owner Navigation Visibility
1. Login as **Owner** (owner@winnmatt.co.ke)
2. Check sidebar
3. **VERIFY:**
   - ✅ "Main" section visible (Dashboard, POS)
   - ✅ "Inventory" section visible
   - ✅ "Sales & Customers" section visible
   - ✅ "Administration" section visible
   - ✅ **NEW: "Enterprise" section visible** (owner only)
   - ✅ Enterprise items: Enterprise Dashboard, Branch Oversight, Audit Logs, User Management

4. Logout and login as **Admin** (admin@winnmatt.co.ke)
5. Check sidebar
6. **VERIFY:**
   - ✅ NO "Enterprise" section (admin only can see Administration)
   - ✅ "Administration" has Users & Roles, Settings

---

### Test 2: Owner Header Context
1. Login as Owner
2. Check top header
3. **VERIFY:**
   - ✅ Shows "Enterprise Owner" badge/text (not just "Main Branch")
   - ✅ Indicates role/scope clearly

4. Go to Dashboard
5. Click branch dropdown (if exists)
6. **VERIFY:**
   - ✅ Shows "All Branches" option OR "Enterprise-Wide View"

---

### Test 3: Owner Dashboard Access
1. Login as Owner
2. Click "Enterprise Dashboard" (new sidebar item)
3. **VERIFY:**
   - ✅ Page loads showing enterprise view
   - ✅ Displays branch comparison (all 3 branches)
   - ✅ Shows enterprise KPIs (total sales, loyalty metrics)
   - ✅ Recent activity from all branches

---

### Test 4: Audit Logs Viewer
1. Login as Owner
2. Click "Audit Logs" (new sidebar item)
3. **VERIFY:**
   - ✅ Page loads with audit entries
   - ✅ Shows: who, what action, when, details
   - ✅ Search/filter works (by action, actor, date)

4. Look for recent events like:
   - Settings update by admin
   - User password reset
   - Loyalty settings change

---

### Test 5: Settings Tabs for Owner
1. Login as Owner
2. Go to Settings
3. **VERIFY:**
   - ✅ Tab list shows: General, Loyalty Oversight, Enterprise (not Branches, Payments)
   - ✅ Loyalty tab has owner-only badge
   - ✅ Enterprise tab has global settings

4. Click "Loyalty Oversight"
5. **VERIFY:**
   - ✅ Shows enterprise loyalty metrics
   - ✅ NO admin-only alert (owner is authoritized)

---

### Test 6: User Management for Owner
1. Login as Owner
2. Go to Users & Roles
3. **VERIFY:**
   - ✅ Can see all users across all branches
   - ✅ "Create Admin" button visible (owner-only)
   - ✅ Can edit admin accounts

4. Try to create new Admin
5. **VERIFY:**
   - ✅ Form allows creating admin (role = owner only)

---

### Test 7: Admin View (Verify No Owner Features)
1. Login as **Admin**
2. Check sidebar
3. **VERIFY:**
   - ✅ NO "Enterprise" section
   - ✅ NO "Audit Logs" link
   - ✅ Normal admin view only

4. Try to access `/dashboard/enterprise` directly
5. **VERIFY:**
   - ✅ Access denied OR redirects (owner-only protection)

---

### Test 8: Reports with Owner View
1. Login as Owner
2. Go to Reports
3. **VERIFY:**
   - ✅ Shows all branches by default (not scoped to one)
   - ✅ Branch comparison visible
   - ✅ Cross-branch metrics shown

---

## SQL VERIFICATION QUERIES

Run these in Supabase to verify owner-level controls work:

### Query 1: Verify Owner Account Exists & Role Correct
```sql
SELECT 
  id,
  email,
  role,
  branch_id,
  full_name,
  status
FROM users 
WHERE role = 'owner'
AND status = 'active'
LIMIT 5;

-- Expected:
-- - Exactly 1 row (or few rows - should be very rare)
-- - role = 'owner'
-- - branch_id = NULL (owners have no branch)
-- - email matches configured owner account
```

### Query 2: Verify Audit Logs Exist
```sql
SELECT 
  COUNT(*) as total_audit_entries,
  COUNT(DISTINCT actor_id) as unique_actors,
  COUNT(DISTINCT action) as unique_actions
FROM audit_logs;

-- Expected:
-- - total_audit_entries > 0 (depends on activity)
-- - If system worked, should have entries like:
--   * 'update_loyalty_settings'
--   * 'create_user'
--   * 'update_user'
--   * 'reset_password'
```

### Query 3: Verify Loyalty Settings Ownership
```sql
SELECT 
  id,
  earn_enabled,
  redeem_enabled,
  earn_threshold_cents,
  redeem_value_cents,
  redeem_minimum_points,
  updated_by,
  updated_at
FROM loyalty_settings
WHERE id = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'::UUID;

-- Expected:
-- - Single row (singleton)
-- - updated_by should be owner's user_id
-- - All columns set (no NULLs except where intentional)
```

### Query 4: Verify Admin Users List (Owner Perspective)
```sql
SELECT 
  id,
  email,
  full_name,
  role,
  branch_id,
  status,
  created_at
FROM users 
WHERE role IN ('admin', 'owner')
ORDER BY role DESC, created_at DESC;

-- Expected:
-- - 1-2 owner rows
-- - Multiple admin rows
-- - Each admin linked to a branch (branch_id NOT NULL)
```

### Query 5: Verify Branch Assignments
```sql
SELECT 
  b.id,
  b.name,
  b.code,
  COUNT(u.id) as admin_count,
  COUNT(CASE WHEN u.role = 'manager' THEN 1 END) as manager_count,
  COUNT(CASE WHEN u.role = 'cashier' THEN 1 END) as cashier_count
FROM branches b
LEFT JOIN users u ON b.id = u.branch_id
GROUP BY b.id, b.name, b.code
ORDER BY b.is_main DESC;

-- Expected:
-- - One row per branch
-- - admin_count typically 1-2 per branch
-- - Each branch has staff assigned
```

### Query 6: Track Settings Changes (Audit Trail)
```sql
SELECT 
  actor_id,
  u.email as changed_by,
  action,
  resource_type,
  resource_id,
  old_value,
  new_value,
  details,
  created_at
FROM audit_logs al
LEFT JOIN users u ON al.actor_id = u.id
WHERE action LIKE '%loyalty%' OR resource_type = 'loyalty_settings'
ORDER BY created_at DESC
LIMIT 10;

-- Expected:
-- - Shows who changed loyalty settings
-- - Shows old vs new values
-- - Shows timestamp of change
-- - EXAMPLE: Admin changed redeem_enabled: false → true on 2026-04-09
```

### Query 7: Verify User Activity (Owner Oversight)
```sql
SELECT 
  action,
  COUNT(*) as count,
  COUNT(DISTINCT actor_id) as unique_actors,
  MAX(created_at) as last_change
FROM audit_logs
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY action
ORDER BY count DESC;

-- Expected:
-- - Shows activity breakdown for past week
-- - Helps owner understand admin activity levels
```

### Query 8: Verify Role Constraints (Database Level)
```sql
-- Check role constraint exists
SELECT 
  constraint_name,
  constraint_type,
  table_name
FROM information_schema.table_constraints
WHERE table_name = 'users' 
AND constraint_name LIKE '%role%';

-- Expected:
-- - users_role_check constraint (CHECK role IN (...))
-- - role_branch_check constraint (owner→NULL, others→branch_id)

-- Test constraint by attempting invalid insert (will fail):
-- INSERT INTO users (email, role, branch_id, full_name, status)
-- VALUES ('test@test.com', 'owner', 'some-branch-id', 'Test', 'active');
-- Expected: ERROR - violates role_branch_check
```

---

## ROLE SEPARATION MATRIX

| Feature | Owner | Admin | Manager | Cashier |
|---------|-------|-------|---------|---------|
| Dashboard | Enterprise | Branch | Branch | Own |
| Reports | All Branches | Own Branch | Own Branch | - |
| Users | Create/Edit Admin | Manage Staff | - | - |
| Loyalty Settings | Configure | View Only | View Only | View Only |
| Audit Logs | View All | View Own | View Own | - |
| Branch Management | All | Assigned Only | Own Only | - |
| Settings | Enterprise | Business | - | - |
| POS | N/A | N/A | View Only | Full Access |

---

## SECURITY CONSIDERATIONS

1. **Owner-Only Endpoints:**
   - `/api/audit-logs` - require role='owner'
   - `/api/enterprise-reports` - require role='owner'  
   - `/api/admin-management` - require role='owner'

2. **Settings Protection:**
   - Loyalty settings changes logged to audit_logs
   - Only owner can modify redeem rules
   - Any change recorded with actor_id

3. **Data Visibility:**
   - Owner sees all branches
   - Admin sees only assigned branch
   - Manager sees only own branch
   - Enforced at API level

---

## DEPLOYMENT CHECKLIST

- [ ] Sidebar shows Enterprise section for owner only
- [ ] Header shows "Enterprise Owner" for owner role
- [ ] Enterprise dashboard loads successfully
- [ ] Branch performance table shows all branches
- [ ] Audit logs viewer functional
- [ ] Audit logs table populated with activity
- [ ] Settings tabs reorganized for owner
- [ ] Loyalty settings owner-only badge clear
- [ ] User management allows owner to create admins
- [ ] Reports show enterprise view for owner
- [ ] Admin view unaffected (no Enterprise section)
- [ ] SQL queries verify data integrity
- [ ] No breaking changes to branch workflows

---

**Status: Ready for Phase 1 Implementation** ✅
