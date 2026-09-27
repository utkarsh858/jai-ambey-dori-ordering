# Apply Migrations & Fix 500 Error - 5 Minutes

**Status:** Migrations 2 & 3 exist in repo but NOT YET applied to Supabase.  
**Action:** Apply both migrations now to fix buyer order 500 error.  
**Time:** 5 minutes total

---

## Step 1: Before You Start (30 seconds)

Open your Supabase project dashboard and have ready:
- SQL Editor
- Recent PostgreSQL logs viewer

---

## Step 2A: Apply Migration 2 (The Fix)

**File:** `supabase/migrations/20260927000001_fix_packing_tasks_assignment.sql`

**What it does:** Adds manager assignment logic to `create_order()` function

**Execute:**

1. Open Supabase → SQL Editor → **New Query**
2. Copy the ENTIRE content of `20260927000001_fix_packing_tasks_assignment.sql`
3. Paste into SQL Editor
4. Click **Execute**
5. **Wait** for "Query successful" message

**If error:** Note the error, don't proceed to Step 2B yet

---

## Step 2B: Apply Migration 3 (Diagnostics)

**File:** `supabase/migrations/20260927000002_improve_order_error_handling.sql`

**What it does:** Adds diagnostic function + better error messages

**Execute:**

1. Open Supabase → SQL Editor → **New Query**
2. Copy the ENTIRE content of `20260927000002_improve_order_error_handling.sql`
3. Paste into SQL Editor
4. Click **Execute**
5. **Wait** for "Query successful" message

**If error:** Check Supabase logs

---

## Step 3: Verify Migrations Applied (1 minute)

Run this in Supabase SQL Editor:

```sql
SELECT 
  'Migration 2 (Manager Assignment)' as check_name,
  CASE 
    WHEN pg_get_functiondef(p.oid)::text LIKE '%item_manager_assignments%' THEN '✅ APPLIED'
    ELSE '❌ NOT APPLIED'
  END as status
FROM pg_proc p 
WHERE p.proname = 'create_order' 
AND p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
UNION ALL
SELECT 
  'Migration 3 (Diagnostic)' as check_name,
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_proc p WHERE p.proname = 'diagnose_buyer_order_issue' AND p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')) THEN '✅ APPLIED'
    ELSE '❌ NOT APPLIED'
  END as status;
```

**Expected Output:**
```
check_name                      | status
Migration 2 (Manager Assignment)| ✅ APPLIED
Migration 3 (Diagnostic)        | ✅ APPLIED
```

**If NOT APPLIED:** Re-apply that migration

---

## Step 4: Redeploy Vercel (1 minute)

1. Go to **Vercel Dashboard**
2. Click your project
3. Find latest deployment
4. Click **Redeploy**
5. Wait for **"Ready"** status

---

## Step 5: Test Order Placement (2 minutes)

**In your app:**

1. **Logout** completely
2. **Login as buyer** (not admin)
3. Go to catalog/order page
4. Select an item with stock
5. Click "Place Order"

**Expected Result:**
- ✅ No 500 error
- ✅ Order number appears (e.g., ORD-20260927-ABC123)
- ✅ Order appears in your list

**If 500 error:** Go to Step 6

---

## Step 6: Verify in Database (1 minute)

After attempting order, run in Supabase SQL Editor:

```sql
SELECT order_number, status, payment_method 
FROM public.orders 
ORDER BY created_at DESC LIMIT 1;
```

Then:

```sql
SELECT order_number, assigned_manager_id, status 
FROM public.packing_tasks
ORDER BY created_at DESC LIMIT 1;
```

**Critical Check:**
- ✅ Packing task shows `assigned_manager_id` = UUID (not NULL) → **FIX WORKING** ✅
- ❌ Packing task shows `assigned_manager_id` = NULL → Migration 2 not applied correctly

---

## ✅ You're Done When

- [ ] Step 3: Both migrations show `✅ APPLIED`
- [ ] Step 4: Vercel deployment shows `Ready`
- [ ] Step 5: Order placed without 500 error
- [ ] Step 6: Packing task has assigned_manager_id (NOT NULL)

---

## 🆘 Troubleshooting

### Migration fails to apply
- Copy entire file content again
- Paste in new SQL query
- Check for red error text in editor
- See Supabase logs for specific error

### Step 3 shows NOT APPLIED
- Migration likely failed silently
- Go back to Step 2, re-apply that migration
- Check Supabase PostgreSQL logs for errors

### Step 5 still shows 500 error
- Check Supabase PostgreSQL logs
- Look for error from last order attempt
- Common errors:
  - `null value in column 'assigned_manager_id'` → Migration 2 not applied
  - Other error → Share exact error with details

### Step 6 shows assigned_manager_id = NULL
- Migration 2 applied but not correctly
- Verify using Step 3 query that text includes `item_manager_assignments`
- Re-apply Migration 2

---

**Ready? Start at Step 1.**

