# Buyer Order Fix - PostgreSQL Enum Type Casting

## Problem
When buyers try to place orders, the `/buyer` endpoint returns a **500 error**:
```
column "status" is of type order_status but expression is of type text
```

## Root Cause
The `create_order()` RPC function was using a SQL `CASE` expression that returned text strings (`'confirmed'`, `'payment_pending'`), but the database column expects a PostgreSQL enum type (`order_status`), not raw text.

PostgreSQL requires explicit type casting when inserting enum values via expressions.

## Solution
Apply the new migration which fixes the enum casting:

```sql
-- In the create_order() function, change this:
insert into public.orders (..., status, ...)
values (..., 
  case when ... then 'confirmed' else 'payment_pending' end, 
  ...);

-- To this:
insert into public.orders (..., status, ...)
values (...,
  (case when ... then 'confirmed' else 'payment_pending' end)::public.order_status,
  ...);
```

## Steps to Fix

### Step 1: Apply Migration to Supabase
1. Go to **Supabase Dashboard** → Your Project → **SQL Editor**
2. Create a new query
3. Copy and paste the SQL from: `supabase/migrations/20260927000000_fix_order_enum_casting.sql`
4. Click **Execute**
5. You should see no errors and a message like "Query executed successfully"

### Step 2: Verify Fix
After applying the migration:
1. Deploy the latest code from `main` branch to Vercel
2. Log in as a buyer
3. Select some items and quantities
4. Click "Reserve stock & place order"
5. Should see: `Order ORD-20260927-XXXXXX reserved successfully.` ✅

### Step 3: Test Complete Workflow
1. **Buyer orders:**
   - Login as buyer
   - Select items (e.g., 2 sarees, 5 ropes)
   - Choose payment method (Pay later or Razorpay)
   - Click order button
   - ✅ Order should succeed

2. **Manager sees packing tasks:**
   - Login as item manager
   - Go to `/manager`
   - Check "Packing tasks" section
   - Should see new tasks with order number and buyer code (no buyer name)
   - ✅ Privacy maintained

3. **Admin sees order:**
   - Login as admin
   - Go to admin dashboard
   - Check "Recent orders" section
   - Should show new order with buyer code and total

## What Changed
- File: `supabase/migrations/20260927000000_fix_order_enum_casting.sql`
- Changes:
  - Fixed `create_order()` function: added `::public.order_status` cast
  - Fixed payment status insert: added `::public.payment_status` cast

## Important Notes
⚠️ **This is a production fix** - must be applied before buyers can place orders

✅ **Safe to apply** - only updates function definitions, no data changes

✅ **Idempotent** - can run multiple times without harm

## After Fix Deployed
Monitor Supabase logs to ensure:
- No more "column 'status' is of type order_status but expression is of type text" errors
- Orders are successfully inserted
- Order status shows as 'confirmed' or 'payment_pending' correctly

---

**Status:** Ready to deploy  
**Files Changed:** 1 new migration file  
**Risk Level:** Low (function definition only)  
**Rollback:** If needed, revert to previous migration and redeploy
