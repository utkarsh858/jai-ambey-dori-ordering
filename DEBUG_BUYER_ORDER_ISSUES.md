# Buyer Order 500 Error - Debugging Checklist

## STEP 1: Verify Migrations Were Actually Applied
This is THE most critical step. Many times migrations appear to work but didn't actually execute.

### Check 1a: Verify Migration 1 Was Applied
In Supabase SQL Editor, run this EXACT query:

```sql
SELECT pg_get_functiondef('public.create_order(jsonb, public.payment_method)'::regprocedure) as function_body;
```

Look at the output. Copy the FULL result and search for:
- `::public.order_status` (should appear once)
- `::public.payment_status` (should appear once)
- `item_manager_assignments` (should appear once, from migration 2)

If you DON'T see these keywords, the migrations were NOT applied.

### Check 1b: Verify Migration 2 Was Applied
Same query as above should also contain:
- `v_assigned_manager` (variable declaration)
- `select profile_id into v_assigned_manager from public.item_manager_assignments`

If missing, migration 2 didn't apply.

### Check 1c: Compare Exact Function Text
Run this:
```sql
SELECT pg_get_functiondef('public.create_order(jsonb, public.payment_method)'::regprocedure);
```

Copy the entire output and look for ALL of these in order:
1. Line ~45: `(case when p_payment_method = 'pay_later' then 'confirmed' else 'payment_pending' end)::public.order_status`
2. Line ~55: `(case when p_payment_method = 'pay_later' then 'not_required' else 'pending' end)::public.payment_status`
3. Line ~52: `select profile_id into v_assigned_manager from public.item_manager_assignments`

---

## STEP 2: Verify Prerequisites Are Met
Before even trying to order, these MUST exist:

### Check 2a: Item Exists
```sql
SELECT id, sku, name, unit_price_paise, active FROM public.items LIMIT 1;
```
Should return at least 1 row. If empty, ADD AN ITEM first via admin UI.

### Check 2b: Inventory Exists and Has Stock
```sql
SELECT item_id, available_quantity, reserved_quantity 
FROM public.inventory WHERE available_quantity > 0 LIMIT 1;
```
Should return rows with available_quantity > 0. If all 0, INCREASE STOCK first via admin UI.

### Check 2c: Item is Assigned to a Manager
```sql
SELECT ima.item_id, ima.profile_id, p.email, p.role
FROM public.item_manager_assignments ima
JOIN public.profiles p ON ima.profile_id = p.id
LIMIT 5;
```
Should return at least 1 row. If empty, ASSIGN MANAGER first via admin UI.

### Check 2d: Manager Account Exists and is Confirmed
```sql
SELECT id, email, role, confirmed_at 
FROM auth.users 
WHERE raw_app_meta_data->>'role' = 'item_manager' 
LIMIT 5;
```
Should show managers with confirmed_at NOT NULL. If NULL, manager not confirmed.

### Check 2e: Buyer Account Exists and is Confirmed
```sql
SELECT id, email, confirmed_at 
FROM auth.users 
WHERE raw_app_meta_data->>'role' = 'buyer' 
LIMIT 1;
```
Should show confirmed_at NOT NULL.

---

## STEP 3: Test Order Creation Directly in SQL
This tests the RPC function in isolation, without the app.

### Test 3a: Get Item ID
```sql
SELECT id FROM public.items WHERE active LIMIT 1;
```
Copy the id (UUID format).

### Test 3b: Get Buyer User ID
You need to be logged in as a buyer in the app, then:
1. Open browser DevTools (F12)
2. Go to Application tab
3. Find cookie: `sb-qrvzdlijbzcenemfhkln-auth-token` (or similar)
4. Decode the JWT (use https://jwt.io)
5. Find the "sub" field - that's your buyer user ID (UUID)

Or use SQL:
```sql
SELECT id, email FROM auth.users WHERE email = 'your-buyer-email@example.com';
```

### Test 3c: Create Test Order via SQL
In Supabase SQL Editor, run as the SAME BUYER USER (important!):

```sql
-- First, set the user context
SELECT auth.uid(); -- Should show buyer's UUID

-- Now try to create an order
SELECT * FROM public.create_order(
  '[{"item_id": "PASTE_ITEM_ID_HERE", "quantity": 1}]'::jsonb,
  'pay_later'::public.payment_method
);
```

**What to expect:**
- SUCCESS: Returns (order_id, order_number, total_paise)
- FAILURE: Returns an error message

**If it fails:** Copy the exact error and check against list below.

---

## STEP 4: Check Supabase Logs for Exact Error
This is where the REAL error message lives.

1. Go to **Supabase Dashboard**
2. Click **Logs** (left sidebar)
3. Click **PostgreSQL** tab
4. Look for most recent error entries
5. Copy the entire error JSON

Look for these specific fields:
- `event_message` - human readable error
- `parsed.detail` - detailed error info
- `sql_state_code` - PostgreSQL error code
  - `42804` = type mismatch (enum issue)
  - `23502` = NOT NULL violation
  - `23503` = foreign key violation
  - `42P01` = table doesn't exist

---

## STEP 5: Check Vercel Logs
The app logs might have different info than database.

1. Go to **Vercel Dashboard**
2. Find your project
3. Go to **Deployments** tab
4. Click latest deployment
5. Go to **Logs** tab
6. Look for errors around the time you tried to order
7. Search for "500" or "error"

---

## STEP 6: Check Browser Console
1. Open app in browser
2. Open DevTools (F12)
3. Go to **Console** tab
4. Try to place order
5. Look for JavaScript errors
6. Also check **Network** tab for the failed API request

---

## STEP 7: Verify Buyer Profile Exists
```sql
SELECT id, buyer_code, role, email 
FROM public.profiles 
WHERE role = 'buyer' LIMIT 1;
```

Should return at least 1 buyer profile. If empty, there's a deeper issue.

---

## Common Issues & Solutions

### Issue: Migrations show in git but not in database
**Solution:**
- Supabase migrations are per-PROJECT, not per-file
- Check that you pasted ENTIRE SQL file (including the last line)
- Try pasting in fresh query tab
- Look at error returned in Supabase

### Issue: Item exists but no inventory row
**Solution:**
- When you added item via admin, inventory should auto-create
- Check:
```sql
SELECT * FROM public.inventory WHERE item_id = 'ITEM_ID';
```
- If empty, the RPC has a bug OR item was added directly via SQL

### Issue: Item exists and inventory exists, but order fails
**Solution:**
- Check manager is assigned:
```sql
SELECT * FROM public.item_manager_assignments 
WHERE item_id = 'ITEM_ID';
```
- If empty, ASSIGN MANAGER via admin UI

### Issue: Manager assigned but still fails
**Solution:**
- Test RPC directly (STEP 3c above)
- Check exact error in Supabase logs
- Share error with me

---

## How to Share Debug Info

When you run these checks, share:

1. **Function definition output** (from Check 1a/1b)
2. **Items/Inventory/Assignments queries** (from Check 2)
3. **Error message** from Supabase logs (from Step 4)
4. **Error from browser console** (from Step 6)
5. **Commit hash** of current deployed code

This will help me pinpoint the exact issue.

---

## Quick Summary

Before going further, answer these:

1. ✓ or ✗ - Did you paste ENTIRE migration 1 SQL and execute it in fresh query?
2. ✓ or ✗ - Did you paste ENTIRE migration 2 SQL and execute it in fresh query?
3. ✓ or ✗ - Did Vercel redeploy successfully (show ✅ Ready)?
4. ✓ or ✗ - Did you log out and log back in after redeploy?
5. ✓ or ✗ - Does item have inventory > 0?
6. ✓ or ✗ - Is item assigned to at least 1 manager?

---

**DO NOT make any more code changes yet.**
**Follow these debug steps first to find the actual root cause.**
