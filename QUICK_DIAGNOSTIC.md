# Quick Diagnostic - Buyer Order Issue

## Likely Root Cause: Missing or Incorrect Buyer Profile

The `create_order()` function calls:
```sql
if auth.uid() is null or public.current_role() <> 'buyer' then
  raise exception 'Only buyers can place orders';
end if;
```

The `current_role()` function does:
```sql
select role from public.profiles where id = auth.uid()
```

**If the buyer's profile doesn't exist or role is not 'buyer', the order fails.**

---

## Quick Test - Run These 3 SQL Queries in Supabase

### Query 1: Check if your buyer profile exists
```sql
SELECT id, email, role 
FROM public.profiles 
WHERE id = auth.uid();
```

**Expected:** Should return 1 row with role = 'buyer'
**If empty:** Buyer profile doesn't exist → This is the bug!
**If role != 'buyer':** Wrong role assigned → This is the bug!

### Query 2: Check if your login is working
```sql
SELECT auth.uid();
```

**Expected:** Should return a UUID (your user ID)
**If NULL:** Not logged in properly

### Query 3: List all buyer profiles
```sql
SELECT id, email, role 
FROM public.profiles 
WHERE role = 'buyer';
```

**Expected:** Should show your buyer account
**If empty:** No buyers exist in system

---

## If Query 1 Shows No Row or Wrong Role

**THIS IS LIKELY YOUR BUG:**

When buyers first log in, they might not get a profile created with the correct role. The `handle_new_user()` trigger creates a profile but defaults role to 'buyer' only if the system is set up correctly.

**Solution:** Manually ensure your buyer has correct profile

Run this SQL to fix it:
```sql
-- First check what you have
SELECT id, email, role FROM auth.users WHERE email = 'your-buyer-email@example.com';

-- Get the user ID from above query, then:
INSERT INTO public.profiles (id, role, email)
VALUES ('USER_ID_FROM_ABOVE', 'buyer', 'your-buyer-email@example.com')
ON CONFLICT (id) DO UPDATE SET role = 'buyer';
```

Then logout and login again, then try to order.

---

## If Migrations Didn't Apply Correctly

If migrations didn't apply, the `create_order()` function won't have the fixes. Test it:

```sql
SELECT pg_get_functiondef('public.create_order(jsonb, public.payment_method)'::regprocedure);
```

Search the output for `::public.order_status`. If not there, run migration 1 again.

---

## MOST LIKELY SCENARIO

Based on the error you got before (assigned_manager_id NOT NULL), and you saying you applied migrations but still getting 500 error, my best guess is:

**The migrations applied, but there's a data issue:**
1. Buyer profile missing or has wrong role
2. Item not assigned to any manager
3. Item has 0 stock

Run the 3 queries above and tell me which one fails or shows wrong data.

