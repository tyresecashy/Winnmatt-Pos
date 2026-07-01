# USER MANAGEMENT IMPLEMENTATION AUDIT & PLAN

## Current State Analysis

### Root Causes (What's Dead/Mock)

1. **No Database Integration**
   - All users come from `lib/mock-data.ts`
   - No queries to `public.users` table
   - File: `app/(dashboard)/users/page.tsx` line 23

2. **Buttons Are Unhandled**
   - "Add User" button (line 55) - no onClick handler
   - "Edit" dropdown (line 140) - no handler
   - "Reset Password" (line 143) - no handler
   - "Delete" (line 146) - no handler

3. **No Supabase Auth Integration**
   - No user creation in Auth system
   - No password management
   - No admin API calls for user provisioning

4. **Role Mismatch**
   - Database expects: ('admin', 'manager', 'cashier')
   - UI displays: 'branch_manager' instead of 'manager'
   - File: `app/(dashboard)/users/page.tsx` line 31 uses 'branch_manager'

5. **No Admin-Only Protection**
   - Page doesn't check if current user is admin
   - Anyone can potentially access this page
   - No authorization checks on operations

6. **No Add/Edit Dialogs**
   - UI has no forms for creating or editing users
   - Only dropdown actions, no modals

### Architecture Overview

```
Current Flow:
  Users Page (mock-data) → Display only

Target Flow:
  Users Page (admin check) → Dialog (Add/Edit) → Server Function
    → Create Auth User (service role) + Create Profile Row
    → Update UI with confirmation
```

## Implementation Plan

### Files to Create

1. **lib/user-management.ts** (NEW - ~150 lines)
   - `getUsers()` - fetch all users for listing
   - `getUserById(id)` - fetch single user
   - `createUser(email, fullName, role, branchId, tempPassword)` - full provisioning
   - `updateUser(id, data)` - update profile/role/branch
   - `deleteUser(id)` - soft delete or deactivate
   - `resetUserPassword(email)` - password reset flow

2. **components/users/** (NEW DIRECTORY)
   - `add-user-dialog.tsx` - form for adding users
   - `edit-user-dialog.tsx` - form for editing users

### Files to Update

1. **app/(dashboard)/users/page.tsx** (MAJOR REWRITE)
   - Replace mock-data with real queries
   - Add useEffect to load users
   - Wire up all button handlers
   - Add admin-only checks
   - Add success/error states

2. **lib/mock-data.ts** (MINOR FIX)
   - Change 'branch_manager' to 'manager' for consistency

### Database & Auth Flow

```
Creating a User (Admin Action):
─────────────────────────────────

1. Admin fills form (email, fullName, role, branch)
   ↓
2. Server function validateCreateUser()
   - Check session user is admin
   - Check email not already in Auth
   - Check branch_id is valid
   ↓
3. createUserInAuth(email)
   - Use Supabase Admin API
   - Create auth user with temp password
   - Generate magic link OR return temp password
   ↓
4. createUserProfile(id, email, fullName, role, branch_id)
   - Insert into public.users
   - Set role and branch_id
   ↓
5. Return user + password/link to admin
   ↓
6. Admin shares password or link with new user
   ↓
7. New user logs in → auth-context loads profile
   ↓
8. User can now access dashboard with their role

Updating a User (Admin Action):
──────────────────────────────

1. Admin selects Edit on user table row
   ↓
2. EditUserDialog loads current user data
   ↓
3. Admin modifies: fullName, role, branch_id
   ↓
4. updateUser(id, changes)
   - Check current user is admin
   - Update users table (role, branch_id, full_name)
   - Note: Email cannot change (linked to Supabase Auth)
   ↓
5. Return updated user, refresh list

Deleting a User (Admin Action):
──────────────────────────────

1. Admin clicks Delete
   ↓
2. Confirm dialog
   ↓
3. deleteUser(id)
   - Check current user is admin
   - Option A: Soft delete (db-only, keep auth)
   - Option B: Hard delete from auth too
   - For safety: Soft delete in profile
   ↓
4. Refresh list

Resetting Password:
──────────────────

1. Admin clicks "Reset Password"
   ↓
2. Server generates reset link or temp password
   ↓
3. Return link/password to admin
   ↓
4. Admin sends to user via email/message
```

### Key Technical Details

**Supabase Auth Creation:**
- Supabase doesn't expose a direct "create user" endpoint over REST
- Solution: Use Admin API via `supabaseAdmin.auth.admin.createUser()`
- Alternative: Use magic links or temporary passwords

**Password Strategy:**
- Option 1: Admin sets temporary password, user must change on first login
- Option 2: Send magic link for password setup
- Recommended: Option 1 (simpler, shows password on screen for copy)

**Profile Creation:**
- After auth user created, insert row into public.users table
- Both must succeed or transaction rolls back
- Use try-catch with detailed error handling

### UI/UX Flow

```
1. Admin opens Users page
   → If not admin: Show "Access Denied" / redirect
   → If admin: Load users list from DB

2. Admin clicks "Add User"
   → AddUserDialog opens
   → Form: Email, Full Name, Role dropdown, Branch dropdown
   → "Create User" button
   → On success: Show password/link, close dialog, refresh list
   → On error: Show error message in dialog

3. Admin clicks "Edit" on user row
   → EditUserDialog opens with pre-filled data
   → Form: Full Name, Role dropdown, Branch dropdown
   → Email is read-only
   → "Update User" button
   → On success: Close dialog, refresh list with new data
   → On error: Show error message

4. Admin clicks "Reset Password"
   → Confirm: "Send password reset to {email}?"
   → Generate link/password
   → Show to admin for sharing
   → Close dialog, show success toast

5. Admin clicks "Delete"
   → Confirm: "Remove {name} from system?"
   → Soft delete from profile
   → Refresh list
```

---

## Roles & Permissions Check

### Database Constraint
```sql
CHECK (role IN ('admin', 'manager', 'cashier'))
```

### Auth Context Expectation
```typescript
role: 'admin' | 'manager' | 'cashier'
```

### Current UI (WRONG)
```javascript
'branch_manager' // ← Should be 'manager'
```

### Fix: Change all UI references from 'branch_manager' to 'manager'

---

## Error Handling Strategy

### Create User Errors
- Email already exists in Auth → "User with this email already exists"
- Branch invalid → "Invalid branch selection"
- Empty fields → "All fields required"
- Auth API error → "Failed to create auth user: {error}"

### Update User Errors
- User not found → "User not found"
- Auth failure → "Failed to update user"

### Delete User Errors
- User not found → "User not found"
- Cannot delete only admin → "At least one admin required"

### General Errors
- Not admin → "Only admins can manage users"
- Network error → "Network error, please retry"

---

## Implementation Steps (Order)

1. ✅ Create `lib/user-management.ts` with all server functions
2. ✅ Update Users page to check admin role
3. ✅ Replace mock-data with real queries + loading state
4. ✅ Create AddUserDialog component
5. ✅ Create EditUserDialog component
6. ✅ Wire up all buttons (Edit, Delete, Reset Password)
7. ✅ Test end-to-end in browser
8. ✅ Fix role mismatch ('branch_manager' → 'manager')

---

## Testing Checklist

### Browser Test: Create User
- [ ] Navigate to Users page (as admin)
- [ ] Click "Add User"
- [ ] Fill form (email, fullName, role, branch)
- [ ] Click "Create User"
- [ ] See success + generated password
- [ ] Refresh page → User appears in list
- [ ] Try login with new email/password → Works

### Browser Test: Edit User
- [ ] Click "Edit" on user row
- [ ] Change role or branch
- [ ] Click "Update User"
- [ ] See success message
- [ ] Refresh page → Changes persisted
- [ ] Verify edited user has new role/branch

### Browser Test: Delete User (Soft)
- [ ] Click "Delete" on user row
- [ ] Confirm dialog
- [ ] User disappears from list
- [ ] Can still log in (inactive)
- [ ] OR disappears from login if truly deleted

### Browser Test: Admin-Only
- [ ] Login as cashier
- [ ] Navigate to /dashboard/users
- [ ] See "Access Denied" OR Users page but no buttons
- [ ] Cannot click Add/Edit/Delete

### Browser Test: Password Reset
- [ ] Click "Reset Password" on user
- [ ] See temporary password / reset link
- [ ] Admin can copy & share

---

## Limitations & Trade-offs

### Limitation 1: Supabase Auth API
- No direct "create user with specific password" via REST
- Solution: Create user, then return temp password to admin
- Note: Admin must manually share password with new user

### Limitation 2: Email Immutability
- Supabase Auth email is primary key, cannot change
- Solution: Edit form shows email as read-only
- If user needs new email: Delete old account, create new

### Limitation 3: No Automatic Notifications
- System doesn't send emails to new users
- Solution: Admin manually sends password
- Alternative: Can integrate SendGrid, Twilio later

### Limitation 4: RLS Policies
- public.users table needs RLS for edit/delete protection
- Current: Only service role can write (via server functions)
- Safe but inflexible

### Limitation 5: Branch Assignment Required
- Current UI requires branch on every user
- Admins might not have a "central" branch
- Solution: Allow "All Branches" or nullable branch_id

---

## Expected Result

After implementation:
- ✅ Real user CRUD tied to database
- ✅ Supabase Auth integration for account creation
- ✅ Admin-only protected operations
- ✅ Add/Edit/Delete/Reset Password all functional
- ✅ Error handling with user feedback
- ✅ Role consistency (manager not branch_manager)
- ✅ Success/error toasts on each operation

Setup time: ~2-3 hours coding
Testing time: ~30 minutes browser verification
