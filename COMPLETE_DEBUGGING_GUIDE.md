# Complete Debugging Guide - Buyer Order 500 Error

## Executive Summary

**Your Issue:** Buyers get 500 error when placing orders  
**Root Cause:** `create_order()` function missing manager assignment logic  
**Fix:** Apply 2 more migrations (you've only applied 1)  
**Time to Fix:** 5 minutes  
**Risk Level:** Very Low (database function update only)

---

## What Happened

### Error Message You Got
```
null value in column 'assigned_manager_id' violates not-null constraint
```

### Why
1. When a buyer places an order with "pay later" payment, a packing task is created
2. This packing task needs an assigned manager ID to route to the right manager
3. Your `create_order()` function doesn't look up which manager to assign
4. Result: NULL gets inserted into required column → 500 error

### Where It Failed
In PostgreSQL, during order creation RPC call:
```sql
insert into public.packing_tasks (
  order_id, order_number, buyer_code, 
  item_id, item_name, quantity, 
  assigned_manager_id  <-- This is NULL!
) values (...)
```

---

## The 3 Migrations

You have 3 fixes ready to apply:

### Migration 1: Enum Type Casting (APPLIED ✅)
**File:** `supabase/migrations/20260927000000_fix_order_enum_casting.sql`  
**What it fixes:** PostgreSQL CASE expressions return text, not enum types  
**Status:** ✅ Applied  
**What it does:**
```sql
(case when p_payment_method = 'pay_later' 
  then 'confirmed' 
  else 'payment_pending' 
end)::public.order_status  <-- Explicit enum cast
```

### Migration 2: Manager Assignment (NOT APPLIED ❌)
**File:** `supabase/migrations/20260927000001_fix_packing_tasks_assignment.sql`  
**What it fixes:** Looks up manager before creating packing task  
**Status:** ❌ NOT Applied (this is why you got NULL error)  
**What it does:**
```sql
-- Look up which manager handles this item
select profile_id into v_assigned_manager 
from public.item_manager_assignments 
where item_id = v_item.id 
limit 1;

-- Use that manager when creating packing task
insert into public.packing_tasks (
  ..., assigned_manager_id, ...
) values (
  ..., v_assigned_manager, ...
);
```

### Migration 3: Better Error Diagnostics (NOT APPLIED ❌)
**File:** `supabase/migrations/20260927000002_improve_order_error_handling.sql`  
**What it fixes:** Adds diagnostic function + better error messages  
**Status:** ❌ NOT Applied  
**What it adds:**
```sql
SELECT * FROM diagnose_buyer_order_issue();

-- Returns checks for:
-- ✅ User authenticated?
-- ✅ Buyer profile exists?
-- ✅ Profile has buyer role?
-- ✅ Items exist in catalog?
-- ✅ Items have stock?
-- ✅ Managers assigned to items?
```

---

## Step-by-Step Fix

### Prerequisites
- You have Supabase access
- You have Vercel access
- You can access both as admin/owner

### Steps

#### Step 1: Verify Current State (2 min)

Open Supabase SQL Editor and run:
```sql
SELECT pg_get_functiondef(p.oid)::text 
FROM pg_proc p 
WHERE p.proname = 'create_order' 
AND p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
```

Search the output for: `item_manager_assignments`
- ✅ Found → Skip to Step 3
- ❌ Not found → Do Step 2

#### Step 2A: Apply Migration 2 (1 min)

1. Open file: `/supabase/migrations/20260927000001_fix_packing_tasks_assignment.sql`
2. Select all content (Ctrl+A)
3. Copy (Ctrl+C)
4. Go to Supabase → SQL Editor → New Query
5. Paste (Ctrl+V)
6. Click Execute
7. Wait for "Query successful"

#### Step 2B: Apply Migration 3 (1 min)

1. Open file: `/supabase/migrations/20260927000002_improve_order_error_handling.sql`
2. Select all content (Ctrl+A)
3. Copy (Ctrl+C)
4. Go to Supabase → SQL Editor → New Query
5. Paste (Ctrl+V)
6. Click Execute
7. Wait for "Query successful"

#### Step 3: Redeploy Vercel (2 min)

1. Go to Vercel Dashboard
2. Select your project
3. Find latest deployment
4. Click "Redeploy"
5. Wait for status → "Ready"
6. Check "Deployments" shows new build

#### Step 4: Verify Migrations Applied (1 min)

In Supabase SQL Editor, run:
```sql
SELECT 
  p.proname as function_name,
  pg_get_functiondef(p.oid)::text as definition
FROM pg_proc p
WHERE p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
AND p.proname IN ('create_order', 'diagnose_buyer_order_issue')
ORDER BY p.proname;
```

**Check for:**
- `item_manager_assignments` text in create_order → ✅ Migration 2 applied
- `diagnose_buyer_order_issue` function visible → ✅ Migration 3 applied

#### Step 5: Run Buyer Diagnostic (2 min)

1. In your app, **logout completely**
2. **Login as a buyer** (not admin)
3. Go to Supabase SQL Editor
4. Run:
```sql
SELECT * FROM public.diagnose_buyer_order_issue();
```

5. **Save the output**
6. Look at each row:
   - All `status` = ✅ → Good! Proceed to Step 6
   - Any `status` = ❌ → Data issue (see Troubleshooting below)

#### Step 6: Test Order Creation (1 min)

1. Still logged in as buyer
2. Go to your app's catalog
3. Select an item
4. Enter quantity
5. Click "Place Order"
6. **Should succeed immediately**

**If fails:**
- Check Supabase PostgreSQL logs
- Run diagnostic again
- Proceed to Troubleshooting

---

## Troubleshooting

### Diagnostic Shows ❌ Checks

**Check: User authenticated = ❌**
- **Cause:** Not logged in or session expired
- **Fix:** Logout and login again

**Check: Buyer profile exists = ❌**
- **Cause:** User profile wasn't created when user registered
- **Fix:** Contact admin to recreate profile:
```sql
INSERT INTO profiles (id, email, role) 
VALUES (auth.uid(), 'buyer_email@example.com', 'buyer');
```

**Check: Profile has buyer role = ❌**
- **Cause:** Profile has wrong role (admin/manager)
- **Fix:** Admin updates:
```sql
UPDATE profiles SET role = 'buyer' WHERE id = auth.uid();
```

**Check: Items exist = ❌**
- **Cause:** No items in catalog
- **Fix:** Admin must add items through inventory UI

**Check: Stock available = ❌**
- **Cause:** Items have 0 quantity
- **Fix:** Admin updates inventory quantities through UI

**Check: Managers assigned = ❌**
- **Cause:** No manager assigned to items
- **Fix:** Admin assigns manager to item through UI

### Still Getting 500 Error After Diagnostics Pass

1. Go to Supabase → Logs → PostgreSQL
2. Look for errors from last 5 minutes
3. Copy the full error message
4. Share it along with diagnostic output

---

## Common Mistakes

❌ **Mistake 1:** Only applying Migration 1  
✅ **Correct:** Apply Migrations 1, 2, AND 3 in order

❌ **Mistake 2:** Not redeploying Vercel after applying migrations  
✅ **Correct:** Redeploy after each migration set

❌ **Mistake 3:** Running diagnostic as admin  
✅ **Correct:** Logout and login as actual buyer user

❌ **Mistake 4:** Testing with items that have no stock  
✅ **Correct:** Admin must set inventory quantity > 0

❌ **Mistake 5:** Testing with items not assigned to managers  
✅ **Correct:** Admin must assign manager to item first

---

## What Each Migration Changes

### Migration 2 Details

**Before (broken):**
```sql
insert into public.packing_tasks (
  order_id, order_number, buyer_code, 
  item_id, item_name, quantity
) values (v_order_id, v_order_number, v_profile.buyer_code, v_item.id, v_item.name, v_line.quantity);
-- assigned_manager_id is missing!
```

**After (fixed):**
```sql
select profile_id into v_assigned_manager 
from public.item_manager_assignments 
where item_id = v_item.id limit 1;

insert into public.packing_tasks (
  order_id, order_number, buyer_code, 
  item_id, item_name, quantity, 
  assigned_manager_id  <-- Now has value!
) values (v_order_id, v_order_number, v_profile.buyer_code, v_item.id, v_item.name, v_line.quantity, v_assigned_manager);
```

### Migration 3 Details

**Adds diagnostic function:**
```sql
CREATE FUNCTION diagnose_buyer_order_issue()
RETURNS TABLE(check_name text, status text, details text)
```

This checks all prerequisites and reports each one.

---

## Database Schema Reference

### Tables Involved

**packing_tasks:**
```
id (uuid) - PK
order_id (uuid) - FK to orders
assigned_manager_id (uuid) - FK to profiles (the manager)
item_id (uuid) - FK to items
status (packing_status enum) - queued, packed, shipped
...
```

**item_manager_assignments:**
```
item_id (uuid) - FK to items
profile_id (uuid) - FK to profiles (manager)
...
```

**When order created with "pay_later":**
1. Lookup manager from `item_manager_assignments` for each item
2. Create packing task with that `assigned_manager_id`
3. Manager sees packing task in their queue
4. Manager packs and ships

---

## Quick Reference

| Component | Status | Fix |
|-----------|--------|-----|
| Migration 1 (Enum Casting) | ✅ Applied | Done |
| Migration 2 (Manager Assignment) | ❌ NOT Applied | **Apply now** |
| Migration 3 (Diagnostics) | ❌ NOT Applied | **Apply now** |
| Vercel Deployment | ❌ Not redeployed | **Redeploy** |

---

## Next Actions

**RIGHT NOW:**
1. Run Step 1 verification query
2. Check if `item_manager_assignments` text is found
3. If not found: Apply Migrations 2 and 3
4. Redeploy Vercel
5. Run diagnostic as buyer
6. Test order

**Expected Result:**  
✅ Buyer order succeeds, packing task created, manager sees it in queue

**Support:**  
If any step fails or diagnostic shows ❌, share:
- Step number where it failed
- Exact error message
- Diagnostic output

---

**Read Time:** 5 minutes  
**Fix Time:** 10 minutes  
**Verification Time:** 5 minutes  
**Total Time:** 20 minutes  

**Status:** All code ready. Awaiting your execution of steps above.
