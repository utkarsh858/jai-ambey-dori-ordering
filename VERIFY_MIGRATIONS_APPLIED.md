# Verify Migrations Were Actually Applied

Your 500 error about `assigned_manager_id` suggests Migration 2 may NOT have been applied successfully.
Let me give you SQL tests to verify.

---

## TEST 1: Check if Migration 1 was applied
**In Supabase SQL Editor, run:**
```sql
-- This checks if create_order function has the enum casts
SELECT
  p.proname as function_name,
  pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
WHERE p.proname = 'create_order'
AND p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
```

**Look for:** Text containing `::public.order_status` and `::public.payment_status`
- ✅ If present: Migration 1 applied
- ❌ If absent: Migration 1 NOT applied

---

## TEST 2: Check if Migration 2 was applied
**In Supabase SQL Editor, run:**
```sql
-- This checks if create_order looks up managers
SELECT
  p.proname as function_name,
  pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
WHERE p.proname = 'create_order'
AND p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
```

**Look for:** Text containing `item_manager_assignments` and `v_assigned_manager`
- ✅ If present: Migration 2 applied
- ❌ If absent: Migration 2 NOT applied

---

## TEST 3: Check if Migration 3 was applied (NEW)
**In Supabase SQL Editor, run:**
```sql
-- This checks if diagnostic function exists
SELECT
  p.proname as function_name,
  p.pronamespace::regnamespace as schema_name
FROM pg_proc p
WHERE p.proname = 'diagnose_buyer_order_issue'
AND p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
```

**Expected result:**
```
function_name               | schema_name
diagnose_buyer_order_issue  | public
```

- ✅ If you see it: Migration 3 applied
- ❌ If empty result: Migration 3 NOT applied

---

## ACTION ITEMS

**If ALL 3 show ✅:**
1. Redeploy Vercel
2. Logout/login as buyer
3. Run diagnostic: `SELECT * FROM public.diagnose_buyer_order_issue();`
4. Share the results

**If ANY show ❌:**
1. Open the missing migration file from `/supabase/migrations/`
2. Copy entire contents
3. Go to Supabase → SQL Editor → New Query
4. Paste and Execute
5. Verify again with corresponding TEST above

---

## QUICK TEST COMMAND

Want to see all 3 at once? Run this:

```sql
-- Show all order-related functions
SELECT
  p.proname as function_name,
  pg_get_functiondef(p.oid)::text as definition
FROM pg_proc p
WHERE p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
AND p.proname IN ('create_order', 'diagnose_buyer_order_issue')
ORDER BY p.proname;
```

This shows you the actual code of both functions. Check:
- Does `create_order` have `::public.order_status` casts?
- Does `create_order` have `item_manager_assignments` lookup?
- Does `diagnose_buyer_order_issue` exist?

---

**PRIORITY:**
1. Run TEST 1, TEST 2, TEST 3 above
2. Share the results
3. Apply any missing migrations
4. Then run diagnostic

This will confirm migrations actually took effect.
