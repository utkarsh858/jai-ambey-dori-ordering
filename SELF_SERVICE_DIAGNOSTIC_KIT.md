# Buyer Order 500 Error - Self-Service Diagnostic & Fix Kit

**Purpose:** Complete autonomous debugging without waiting for responses.
**Time:** 10 minutes to diagnose and fix
**Outcome:** Buyer orders will work

---

## Part 1: Diagnostic (3 minutes)

### Run This Query First
Go to Supabase → SQL Editor → New Query:

```sql
-- Show the exact current state of create_order function
SELECT 
  p.proname,
  pg_get_functiondef(p.oid)::text as current_definition
FROM pg_proc p 
WHERE p.proname = 'create_order' 
AND p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
```

**Save the output.** Then search for these specific texts:

| Search For | What It Means |
|-----------|---------------|
| `item_manager_assignments` | Migration 2 is applied ✅ |
| `v_assigned_manager` | Migration 2 is applied ✅ |
| `diagnose_buyer_order_issue` | Migration 3 is applied ✅ |
| None of above found | Migrations NOT applied ❌ |

### Check Results Table

| Found | Status | Next Step |
|-------|--------|-----------|
| All three (item_manager_assignments, v_assigned_manager, diagnose_buyer_order_issue) | ✅ All applied | Skip to Part 3 (Test) |
| Only first two (item_manager_assignments, v_assigned_manager) | ✅ Partial | Go to Part 2B (Apply Migration 3) |
| None of above | ❌ Not applied | Go to Part 2 (Apply All) |

---

## Part 2A: If Migrations NOT Applied - Apply Them

### Step 1: Apply Migration 2

**File Location:** `/supabase/migrations/20260927000001_fix_packing_tasks_assignment.sql`

**In Supabase SQL Editor:**
1. New Query
2. Copy entire file content
3. Paste
4. Execute
5. Wait for "Query successful"

### Step 2: Apply Migration 3

**File Location:** `/supabase/migrations/20260927000002_improve_order_error_handling.sql`

**In Supabase SQL Editor:**
1. New Query
2. Copy entire file content
3. Paste
4. Execute
5. Wait for "Query successful"

### Step 3: Redeploy Vercel

1. Vercel Dashboard
2. Find your project
3. Click "Redeploy"
4. Wait for "Ready"

---

## Part 2B: If Only Migration 3 Missing - Apply Just Migration 3

**File Location:** `/supabase/migrations/20260927000002_improve_order_error_handling.sql`

**In Supabase SQL Editor:**
1. New Query
2. Copy entire file content
3. Paste
4. Execute
5. Wait for "Query successful"

**Then Redeploy Vercel:**
1. Vercel Dashboard → Redeploy
2. Wait for "Ready"

---

## Part 3: Run Diagnostic (2 minutes)

**After applying migrations and redeploying:**

### Step 1: Test as Buyer

1. In your app, logout completely
2. Login as a buyer user (NOT admin)
3. Verify you're logged in as buyer

### Step 2: Run Buyer Diagnostic

In Supabase SQL Editor:

```sql
SELECT * FROM public.diagnose_buyer_order_issue();
```

**Expected result:**
```
check_name                           | status | details
─────────────────────────────────────┼────────┼──────────
User is authenticated                | ✅     | User ID: xxx
Buyer profile exists                 | ✅     | Profile ID: xxx
Profile has buyer role               | ✅     | Role: buyer
Items exist in catalog               | ✅     | Count: X
Items have available stock           | ✅     | Min stock: X
Managers assigned to items           | ✅     | Assignments: X
```

### Diagnostic Results Interpretation

| Result | Meaning | Fix |
|--------|---------|-----|
| All ✅ | Everything OK | Go to Step 3 |
| User authenticated ❌ | Session expired | Logout/login again, re-run diagnostic |
| Buyer profile ❌ | Profile missing | Admin creates with: INSERT INTO profiles (id, email, role) VALUES (auth.uid(), 'email', 'buyer'); |
| Profile role ❌ | Wrong role | Admin updates: UPDATE profiles SET role = 'buyer' WHERE id = auth.uid(); |
| Items exist ❌ | No items | Admin adds items via inventory UI |
| Stock ❌ | Inventory is 0 | Admin sets quantity > 0 via inventory UI |
| Managers ❌ | No assignments | Admin assigns manager to items via UI |

---

## Part 4: Test Order Creation (2 minutes)

**After diagnostic shows all ✅:**

1. As buyer user, go to catalog
2. Select an item with stock
3. Enter quantity (e.g., 2)
4. Click "Place Order"
5. Should see success message ✅

**If 500 error still occurs:**

1. Go to Supabase → Logs → PostgreSQL
2. Look for errors from last 5 minutes
3. Note the exact error message
4. Go to Part 5 below

---

## Part 5: If Still Getting 500 Error After Diagnostics Pass

### Step 1: Check PostgreSQL Logs

In Supabase, go to: Logs → PostgreSQL

Look for the most recent error (should be from your failed order attempt).

Copy the full error message.

### Step 2: Analyze Common Errors

| Error | Cause | Fix |
|-------|-------|-----|
| `column "assigned_manager_id" does not exist` | Migration 2 NOT applied | Re-apply Migration 2 |
| `function diagnose_buyer_order_issue does not exist` | Migration 3 NOT applied | Re-apply Migration 3 |
| `null value in column "assigned_manager_id"` | No manager assigned to item | Admin assigns manager to item |
| `Insufficient stock` | Item quantity too low | Admin increases inventory |
| `Item is unavailable` | Item doesn't exist or inactive | Admin creates/activates item |
| Type mismatch on order_status | Migration 1 NOT applied | Check if enum casts present in create_order |

### Step 3: Verify Migrations Again

If you see migration-related errors, re-run this:

```sql
SELECT pg_get_functiondef(p.oid)::text 
FROM pg_proc p 
WHERE p.proname = 'create_order' 
AND p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
```

Check that it contains:
- ✅ `::public.order_status` (enum casting)
- ✅ `item_manager_assignments` (manager lookup)
- ✅ `v_assigned_manager` (manager variable)

If ANY missing: Re-apply that migration

---

## Part 6: Complete Checklist

Before declaring "done", verify:

- [ ] All 3 migrations applied to Supabase
- [ ] Vercel redeployed after migrations
- [ ] Diagnostic shows all ✅ checks
- [ ] Can place order as buyer without 500 error
- [ ] Packing task appears in manager queue
- [ ] Order status is correct (pending/confirmed)
- [ ] Inventory quantity decreased

---

## Quick Reference: File Locations

| What | Location | Size |
|------|----------|------|
| Migration 1 (Enum) | supabase/migrations/20260927000000_fix_order_enum_casting.sql | ~2KB |
| Migration 2 (Manager) | supabase/migrations/20260927000001_fix_packing_tasks_assignment.sql | ~3KB |
| Migration 3 (Diagnostics) | supabase/migrations/20260927000002_improve_order_error_handling.sql | ~8KB |

---

## Expected Timeline

| Task | Time |
|------|------|
| Run first diagnostic query | 1 min |
| Apply migrations (if needed) | 2 min |
| Redeploy Vercel | 2 min |
| Run buyer diagnostic | 1 min |
| Test order | 2 min |
| Verify in database | 1 min |
| **Total** | **~9 min** |

---

## If Everything Works

✅ **Success Indicators:**
- Buyer can place orders
- Packing task created immediately
- Manager sees task in queue
- Order status correct in database
- Inventory updated
- No more 500 errors

**Next steps:**
- Test Razorpay payment flow
- Test manager packing workflow
- Test order cancellation
- Test inventory rollback

---

## Support

If you get stuck:
1. Check Part 5 - Common Errors
2. Verify migrations with the query in Part 1
3. Run the diagnostic function
4. Note the exact error message
5. Cross-reference in the error table

---

**Status:** Self-contained kit. No external dependencies.
**Risk:** Very low - only database functions, no data modifications.
**Reversibility:** All changes can be reverted if needed.

**Ready? Start with Part 1 diagnostic query.**
