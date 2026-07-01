# VERIFIER SCRIPT AUDIT - ROOT CAUSE IDENTIFIED

## Root Cause: RLS Policy Blocking Anon Key

### ❌ The Problem

**Verifier Query:**
```
GET /rest/v1/business_settings?id=eq.f47ac10b-58cc-4372-a567-0e02b2c3d479
Header: Authorization: Bearer eyJh...bmFub24... (ANON KEY)
```

**Result:** Returns `[]` (empty)

**Why:** RLS policy blocks it

---

## Line-by-Line Audit

### Verifier Script (`verify-receipt-settings.js`)

**Line 11:** URL ✅
```javascript
const SUPABASE_URL = 'https://hohxhazfysfiuqizyvay.supabase.co';
```
**Status:** Correct (matches .env.local)

**Line 12:** KEY ❌
```javascript
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhvaHhoYXpmeXNmaXVxaXp5dmF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyODgyNjAsImV4cCI6MjA5MDg2NDI2MH0._E8ubfl2Fg-36MQ8sU9vke7044Mt1EIDnmpcXATCLSA';
```
**Decoded JWT payload:**
```json
{
  "role": "anon",  // ← PROBLEM: Not "authenticated"
  "iss": "supabase",
  "ref": "hohxhazfysfiuqizyvay"
}
```
**Status:** WRONG KEY - Using ANON KEY instead of SERVICE ROLE KEY

**Line 20-26:** Query construction ✅
```javascript
const queryStr = query ? `?${query}` : '';
const url = `${SUPABASE_URL}/rest/v1/${table}${queryStr}`;
https.get(url, {
  headers: {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
```
**Status:** Correct format (matches Supabase REST API requirements)

**Line 43:** Query execution
```javascript
const businessSettings = await querySupabase('business_settings', `id=eq.${BUSINESS_SETTINGS_ID}`);
```
**Expands to:**
```
GET /rest/v1/business_settings?id=eq.f47ac10b-58cc-4372-a567-0e02b2c3d479
Authorization: Bearer [ANON_KEY]
```

---

## Runtime vs Verifier Comparison

### 1. Authentication Method

**Runtime (`lib/receipt-settings.ts` line 20-22):**
```typescript
const { data, error } = await supabaseAdmin
  .from('business_settings')
  .select('*')
  .eq('id', BUSINESS_SETTINGS_ID)
```
**Uses:** `supabaseAdmin` client with `SUPABASE_SERVICE_ROLE_KEY`

**Verifier (`verify-receipt-settings.js` line 12):**
```javascript
const SUPABASE_KEY = '...role":"anon"...';
```
**Uses:** Anon key directly via REST API

---

### 2. RLS Policy Analysis

**Schema (`db-migrations.sql` line 360):**
```sql
CREATE POLICY "Enable read access for authenticated users" ON business_settings
  FOR SELECT USING (auth.role() = 'authenticated');
```

**What this means:**
- `auth.role() = 'authenticated'` → Allows authenticated users (like cashiers logging in)
- Does NOT allow `'anon'` role (unauthenticated requests)
- Service role BYPASSES this check entirely

**Verifier has auth.role():**
```
'anon'  (from JWT token in ANON_KEY)
```

**Does RLS policy allow?**
```
'anon' === 'authenticated' → FALSE → Query blocked → Returns []
```

---

### 3. Query Comparison

| Aspect | Runtime | Verifier |
|--------|---------|----------|
| **URL** | API client (abstracts endpoint) | `/rest/v1/business_settings` |
| **Key** | Service role (bypasses RLS) | Anon key (subject to RLS) |
| **Auth Role** | `service_role` (bypasses policy) | `anon` (blocked by policy) |
| **Result** | ✅ Returns data | ❌ Returns [] |

---

## Environment Configuration

### `.env.local` - What's Available

```
NEXT_PUBLIC_SUPABASE_URL=https://hohxhazfysfiuqizyvay.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=[anon]         ← role: "anon"
SUPABASE_SERVICE_ROLE_KEY=[service_role]    ← role: "service_role"
```

### What Verifier Should Use

**Current (WRONG):**
```javascript
const SUPABASE_KEY = 'eyJ...role":"anon"...';  // Blocked by RLS
```

**Correct (FIX):**
```javascript
const SUPABASE_KEY = 'eyJ...role":"service_role"...';  // Bypasses RLS
```

---

## Problem Sequence

```
1. Migration creates tables with RLS policy
   ↓
2. RLS policy: SELECT USING (auth.role() = 'authenticated')
   ↓
3. Verifier uses ANON KEY
   ↓
4. ANON KEY has auth.role() = 'anon'
   ↓
5. RLS policy evaluates: 'anon' = 'authenticated' → FALSE
   ↓
6. Query returns [] ← EMPTY RESULT
   ↓
7. Error: "business_settings table has no seed row"
```

---

## The Fix

### Option A: Use SERVICE ROLE KEY (Recommended)

Change verifier line 12 from:
```javascript
const SUPABASE_KEY = 'eyJ...role":"anon"...';
```

To:
```javascript
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJ...role":"service_role"...';
```

**Why:** Service role bypasses RLS, so the query works

**Impact:** Minimal - just changes which key the REST API uses

### Option B: Modify RLS Policy

Change policy from:
```sql
CREATE POLICY "..." ON business_settings
  FOR SELECT USING (auth.role() = 'authenticated');
```

To:
```sql
CREATE POLICY "..." ON business_settings
  FOR SELECT USING (auth.role() IN ('authenticated', 'anon'));
```

**Why:** Allows both authenticated users AND anon key

**Impact:** Slightly reduces security (anon can read business settings publicly)

---

## Exact Minimal Fix

**File:** `verify-receipt-settings.js`

**Line 12 - Replace:**
```javascript
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhvaHhoYXpmeXNmaXVxaXp5dmF5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyODgyNjAsImV4cCI6MjA5MDg2NDI2MH0._E8ubfl2Fg-36MQ8sU9vke7044Mt1EIDnmpcXATCLSA';
```

**With:**
```javascript
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhvaHhoYXpmeXNmaXVxaXp5dmF5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTI4ODI2MCwiZXhwIjoyMDkwODY0MjYwfQ.glN546bRoFCyHjJ2VbeeLhXOt6Us5rr05OkU8eFJS-U';
```

**Result:** ✅ Query bypasses RLS, returns [] → "❌ FAILED" is fixed to "✅ SUCCESS"

---

## Verification After Fix

```bash
node verify-receipt-settings.js

# Expected new output:
# ✅ business_settings table exists with seed row
# ✅ ID: f47ac10b-58cc-4372-a567-0e02b2c3d479
# ✅ Business Name: WINNMATT POS
# ✅ Receipt Footer: Thank you for your purchase!
# ✅ Thank You: Your business matters to us!
# ✅ ALL DATABASE VERIFICATION TESTS PASSED
```

---

## Summary

| Item | Answer |
|------|--------|
| **Project URL** | `https://hohxhazfysfiuqizyvay.supabase.co` ✅ |
| **Key Used** | Anon key (`role: "anon"`) ❌ |
| **Should Use** | Service role key (`role: "service_role"`) |
| **Query Run** | `GET /rest/v1/business_settings?id=eq.f47ac10b-58cc-4372-a567-0e02b2c3d479` ✅ |
| **RLS Blocks It?** | YES - `'anon' ≠ 'authenticated'` ❌ |
| **Minimal Fix** | Change to `process.env.SUPABASE_SERVICE_ROLE_KEY` |

