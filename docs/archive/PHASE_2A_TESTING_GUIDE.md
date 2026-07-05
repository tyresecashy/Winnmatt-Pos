# Phase 2A Testing Guide - Strict Authorization Verification

## Pre-Test Setup

### 1. Start the Development Server
```bash
npm run dev
```
- Server runs on `http://localhost:3000`
- Watch for any console errors during startup

### 2. Clear Browser State
- Open DevTools (F12)
- Clear localStorage, sessionStorage, and cookies
- Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)

### 3. Prepare Test Accounts

**Account A (Valid - Has Profile):** Will use existing seed data
- Email: `demo.cashier@winnmatt.com`
- Password: `DemoPassword123!` (needs to be created in Supabase first)

**Account B (Invalid - No Profile):** Auth exists, no app profile
- Email: `test.unprovision@winnmatt.com`
- Password: `TestPassword123!` (needs to be created in Supabase, but NO profile in custom users table)

**Setup Instructions:**
1. In Supabase Auth → Users, create both accounts with passwords
2. Verify seed data: Custom `users` table has demo.cashier@winnmatt.com but NOT test.unprovision@winnmatt.com
3. Main branch exists in `branches` table with `is_main = true`

---

## Test Scenario 1: Valid User with Provisioned Profile

### Objective
Verify that a user with Supabase auth AND custom app profile gains full access.

### Test Steps

**Step 1: Navigate to Root**
1. Go to `http://localhost:3000`
2. **Expected:** Red loading spinner, page should redirect within 2 seconds

**Step 2: Auto-Redirect Sequence**
1. Watch URL change from `/` → `/login` (because unauthenticated)
2. **Expected:** Login page loads with WINNMATT branding

**Step 3: Sign In with Valid Account**
1. Enter email: `demo.cashier@winnmatt.com`
2. Enter password: `DemoPassword123!`
3. Click "Sign In"
4. **Expected:** Button shows "Signing In..." state
5. **Expected:** 2-3 second delay while auth context loads profile
6. **Expected:** Auto-redirect to `/dashboard`

**Step 4: Dashboard Access Verification**
1. Verify you're on `/dashboard`
2. **Expected:** Dashboard loads with sidebar visible
3. **Expected:** Sidebar footer shows:
   - User's full name (from profile.full_name)
   - Branch name (from profile.branch.name)
   - Logout button (LogOut icon)

**Step 5: Verify Profile in Context**
1. Open DevTools → Console
2. Enter:
   ```javascript
   // Check auth context state (you can't directly access context, but verify DOM shows data)
   document.querySelector('[class*="truncate"]') // checks if profile name is rendered
   ```
3. **Expected:** User name is displayed in sidebar (not "Admin User" or "User")
4. **Expected:** Branch name is displayed (not "Loading...")

**Step 6: Navigate Pages**
1. Click "Products" in sidebar
2. Click "POS / Cashier"
3. Click "Inventory"
4. **Expected:** All pages load without "not provisioned" redirect

**Step 7: Test Page Refresh Persistence**
1. On `/pos` page, press F5 (refresh)
2. **Expected:** Brief loading spinner
3. **Expected:** POS page reloads (persists login)
4. **Expected:** Sidebar still shows profile info

### Expected Results Summary
- ✅ Root → Login (unauthenticated)
- ✅ Login → Dashboard (authenticated)
- ✅ Sidebar shows profile data
- ✅ Page refresh maintains session
- ✅ All routes accessible

---

## Test Scenario 2: Authenticated User WITHOUT Provisioned Profile

### Objective
Verify that auth succeeds but unprovided users are blocked with clear error message.

### Test Steps

**Step 1: Navigate to Root**
1. Go to `http://localhost:3000`
2. **Expected:** Login page loads

**Step 2: Sign In with Unprovision Account**
1. Enter email: `test.unprovision@winnmatt.com`
2. Enter password: `TestPassword123!`
3. Click "Sign In"
4. **Expected:** "Signing In..." state shows
5. **Expected:** 2-3 second delay (checking profile)
6. **Expected:** Auto-redirect to `/not-provisioned`

**Step 3: Not Provisioned Page Verification**
1. Verify URL is `/not-provisioned`
2. **Expected:** Page shows red error alert
3. **Expected:** AlertCircle icon (red)
4. **Expected:** Heading: "Account Not Provisioned"
5. **Expected:** Subheading: "Access Restricted"

**Step 4: Verify Error Message Content**
1. Look for user email displayed
2. **Expected:** Shows: `test.unprovision@winnmatt.com`
3. **Expected:** Error message explains provisioning requirement
4. **Expected:** Action items:
   - "Contact your system administrator"
   - "Request access provisioning"
   - "Retry login after provisioning"

**Step 5: Verify Sign Out Button**
1. Look for "Sign Out" button with LogOut icon
2. Click it
3. **Expected:** Button click causes redirect to `/login`
4. **Expected:** All cached data cleared
5. **Expected:** Fresh login form

**Step 6: Attempt Direct Dashboard Access**
1. With unprovision account still "logged in" (if possible), manually navigate to `http://localhost:3000/dashboard`
2. **Expected:** ProtectedRoute wrapper redirects to `/not-provisioned`
3. **Expected:** Cannot force access to protected pages

### Expected Results Summary
- ✅ Supabase auth succeeds for unprovision user
- ✅ Profile fetch returns 404
- ✅ Redirect to /not-provisioned (not auto-provision)
- ✅ Error page shows email and explanation
- ✅ Sign Out button works and clears state
- ✅ Cannot access dashboard or protected pages

---

## Test Scenario 3: Logout Flow

### Objective
Verify that logout is a complete app flow, not cookie deletion workaround.

### Prerequisites
- Must be logged in as valid user (Script 1)
- Must be on dashboard with sidebar visible

### Test Steps

**Step 1: Verify Initial State**
1. On `/dashboard` with profile loaded
2. **Expected:** Sidebar shows user name and branch
3. **Expected:** Page is fully loaded

**Step 2: Click Logout Button**
1. In sidebar footer, click LogOut icon
2. **Expected:** Button may briefly show loading state
3. **Expected:** Redirect to `/login`

**Step 3: Verify Login Page**
1. Check URL is `/login`
2. **Expected:** Fresh login form (no user data prefilled)
3. **Expected:** No error messages

**Step 4: Check DevTools State**
1. Open DevTools → Application → Storage
2. **Expected:** localStorage is cleared (no session data)
3. **Expected:** Supabase session cleared

**Step 5: Verify Cannot Go Back**
1. Press browser back button
2. **Expected:** Cannot navigate back to dashboard
3. **Expected:** Would require re-login

**Step 6: Attempt Direct Dashboard Access**
1. Manually type `http://localhost:3000/dashboard`
2. **Expected:** Redirect to `/login`
3. **Expected:** Must log in again

### Expected Results Summary
- ✅ Logout button works in sidebar
- ✅ Redirect to login page
- ✅ State is cleared
- ✅ Cannot access protected pages without re-login
- ✅ Clean logout (not session hack)

---

## Test Scenario 4: Page Refresh Persistence

### Objective
Verify that session persists across page refresh and auth state is restored.

### Prerequisites
- Must be logged in as valid user

### Test Steps

**Step 1: Navigate to POS Page**
1. On dashboard, click "POS / Cashier"
2. Verify page loads to `/pos`
3. Verify sidebar shows profile data

**Step 2: Hard Refresh**
1. Press F5 or Ctrl+Shift+R (hard refresh)
2. **Expected:** Brief loading spinner (white screen)
3. **Expected:** Page loads and redirect doesn't happen
4. **Expected:** Still on `/pos`

**Step 3: Verify Profile Persists**
1. Check sidebar footer
2. **Expected:** User name still visible (not "User" or blank)
3. **Expected:** Branch name still visible (not "Loading...")

**Step 4: Verify Data Loads**
1. If products are loaded on page, verify they still display
2. **Expected:** No "account not provisioned" redirect
3. **Expected:** Page content fully functional

**Step 5: Multiple Refresh Cycles**
1. Refresh multiple times in 10 seconds
2. **Expected:** Each refresh maintains session
3. **Expected:** Sidebar data consistent

### Expected Results Summary
- ✅ Session persists after page refresh
- ✅ Profile data restored immediately
- ✅ No flash of "not provisioned" state
- ✅ Protected pages stay accessible
- ✅ Smooth user experience

---

## Test Scenario 5: Unauthorized Role Access (Future)

### Objective
Placeholder for role-based access control testing.

### Note
Current implementation loads profiles but doesn't yet enforce role restrictions on pages. This will be implemented in Phase 2C.

### Future Test Plan
1. Create accounts with different roles: admin, manager, cashier
2. Verify cashier cannot access `/users` (admin-only)
3. Verify manager cannot access certain admin pages
4. Verify role-based menu hiding in sidebar

---

## Test Scenario 6: Session Timeout Edge Cases

### Objective
Verify behavior when Supabase session expires while app is open.

### Test Steps (Manual)

**Step 1: Log In**
1. Sign in as valid user
2. Go to dashboard

**Step 2: Wait for Session Expiry**
1. In Supabase, wait for auth token to expire (default 1 hour)
2. OR manually sign out from Supabase (simulate expired session)

**Step 3: Interact with App**
1. Try to click a protected route button
2. Try to make an API call (refresh product data, etc.)
3. **Expected:** Error or automatic redirect to login

### Expected Results Summary
- ✅ Expired sessions redirect to login
- ✅ No crashes or error states
- ✅ Clear re-login prompt

---

## Console Logging Verification

### What Should Appear in DevTools Console

**On Valid Login:**
```
✅ User profile loaded: cashier at Main Store
```

**On Invalid Login:**
```
⚠️  User profile not found for test.unprovision@winnmatt.com
📋 This user has Supabase auth but no app profile in custom users table
🔒 Access denied - account not provisioned
```

**On Logout:**
```
(No auth-related errors)
Redirect to login initiated
```

---

## Browser Testing Checklist

### Chromium-based (Chrome, Edge, Brave)
- [ ] Login with valid account
- [ ] Login with unprovision account
- [ ] Dashboard access
- [ ] Logout flow
- [ ] Page refresh w/ profile data
- [ ] Clear cookies and retry

### Firefox
- [ ] Repeat all Chromium tests
- [ ] Verify sidebar renders correctly
- [ ] Check responsive design

### Safari (if available)
- [ ] Login flow
- [ ] Logout flow
- [ ] Storage/cache behavior

---

## Troubleshooting Guide

### Problem: Stuck on Loading Screen
**Solutions:**
1. Check Supabase connection in console
2. Verify .env.local has correct credentials
3. Check DevTools Network tab for failed requests
4. Clear browser cache and retry

### Problem: Redirect Loop (/ → /login → /)
**Solutions:**
1. Check auth context authState value
2. Verify root page redirect logic
3. Clear localStorage and hard refresh

### Problem: Profile Shows "Loading..."
**Solutions:**
1. Check /api/auth/profile endpoint works (in Network tab)
2. Verify custom users table has data
3. Check header X-User-ID is being sent
4. Check Supabase RLS policies allow reading users table

### Problem: Logout Button Doesn't Work
**Solutions:**
1. Check console for errors
2. Verify signOut() is being called
3. Check Supabase signOut error
4. Try manual browser back button

### Problem: Cannot Access Not-Provisioned Page
**Solutions:**
1. Verify test account exists in Supabase Auth
2. Verify this account is NOT in custom users table
3. Check ProtectedRoute component logic
4. Check redirect logic in useEffect

---

## Summary Table

| Scenario | Input | Expected Output | Pass |
|----------|-------|-----------------|------|
| Valid Login | demo.cashier@... | Dashboard + Profile | ⏳ |
| Invalid Login | test.unprovision@... | Not-Provisioned Page | ⏳ |
| Logout | Click LogOut icon | Login Page | ⏳ |
| Refresh | F5 on /pos | Stay on /pos, data persists | ⏳ |
| Direct Access | Visit /dashboard | Redirect to /login (if logged out) | ⏳ |
| Protected Route | ProtectedRoute wrapper | authState checked correctly | ⏳ |
| Session Restore | Page refresh | Profile data restored | ⏳ |

---

## Success Criteria

✅ **Phase 2A is complete when:**

1. Valid user with profile can sign in and access dashboard
2. Auth user without profile sees "not provisioned" page
3. Logout clears all state and returns to login
4. Page refresh maintains authentication
5. Protected routes properly check authState
6. Error messages are clear and actionable
7. No auto-provisioning occurs
8. Authorization is explicit (not inferred)
9. Build succeeds with zero errors
10. Console shows expected auth flow messages

**Once verified, Phase 2B can proceed.**
