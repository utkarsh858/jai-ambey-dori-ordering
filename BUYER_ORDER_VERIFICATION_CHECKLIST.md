# Buyer Order Fix - Verification Checklist

## ⚠️ Issue Summary
Buyers getting **500 error** when trying to place orders with message:
```
column "status" is of type order_status but expression is of type text
```

## ✅ Fix Applied
The migration `20260927000000_fix_order_enum_casting.sql` has been created to fix PostgreSQL enum type casting in the `create_order()` RPC function.

---

## 📋 Step-by-Step Verification Process

### **STEP 1: Apply Migration to Supabase** ⚡
Required before anything else works.

1. Open **Supabase Dashboard** for your project
2. Go to **SQL Editor** (left sidebar)
3. Click **"New Query"**
4. Copy entire SQL from: `supabase/migrations/20260927000000_fix_order_enum_casting.sql`
5. Click **Execute**
6. ✅ Should see: `"Success. No rows returned"` or similar confirmation
7. ❌ If error: Report the error message (usually means migration already applied)

**Expected Result:**
```
Query executed successfully
```

---

### **STEP 2: Verify Vercel Deployment** 🚀
Latest code with the fix should be deployed.

1. Go to **Vercel Dashboard**
2. Find your project: `jai-ambey-dori-ordering`
3. Check **Latest Deployment**
4. Should show commit hash `09f8abd` or newer
5. Status should be **✅ Ready** (green checkmark)

**If not the latest commit:**
1. Trigger manual deployment (usually a "Redeploy" button)
2. Wait for build to complete
3. Verify production shows new code

---

### **STEP 3: Test Buyer Order - Happy Path** ✨

#### Prerequisites:
- At least 1 item created in inventory with quantity > 0
- At least 1 item assigned to a manager

#### Test Steps:

**3a. Login as Buyer**
1. Go to: `https://yourdomain.com/login`
2. Select **"Buyer"** role
3. Login with buyer credentials
4. Should see: `/buyer` page with list of items

**3b. Browse Items**
1. You should see items with:
   - Item name
   - SKU
   - Price in ₹
   - Stock quantity

**3c. Place Order**
1. Select items by entering quantities
2. Example: 2 sarees, 5 rope bundles
3. Choose payment method:
   - **Pay later** ✅ (instant order confirmation)
   - **Razorpay** ✅ (requires payment flow)
4. Click **"Reserve stock & place order"**

**Expected Success:**
```
✅ Order ORD-20260927-XXXXXX reserved successfully.
```

Then:
- Form clears
- Quantities reset to 0
- Inventory quantities update (decrease by ordered amounts)
- No error message shown

**If you see success:** ✅ PASS - Bug is fixed!

---

### **STEP 4: Verify Manager Workflow** 👥

**Manager Should Receive Task:**

1. Login as **Item Manager** for that item
2. Go to: `/manager`
3. Check **"Packing Tasks"** section
4. Should see new task with:
   - ✅ Order number: `ORD-20260927-XXXXXX`
   - ✅ Buyer code: `BXXXXXXXX` (not buyer name!)
   - ✅ Item names and quantities
   - ✅ Status: `queued`

**Privacy Check:**
- Manager does NOT see buyer name
- Manager does NOT see buyer email
- Manager ONLY sees: order number, buyer code, item details

**If task appears:** ✅ PASS - Order created successfully!

---

### **STEP 5: Verify Admin Dashboard** 📊

1. Login as **Admin**
2. Go to admin dashboard `/admin`
3. Scroll to **"Recent orders"** section
4. Should see new order with:
   - Order number
   - Buyer code
   - Total amount
   - Payment method
   - Status (should be `confirmed` or `payment_pending`)

**If order appears:** ✅ PASS - Admin can see orders!

---

### **STEP 6: Check Database Directly** 🗄️ (Optional)

Verify the order was created with correct enum values:

1. Supabase Dashboard → **SQL Editor**
2. Run query:
```sql
SELECT 
  order_number, 
  status, 
  payment_method, 
  total_paise,
  created_at
FROM public.orders 
ORDER BY created_at DESC 
LIMIT 5;
```

3. Verify:
   - ✅ `status` column shows: `'confirmed'` or `'payment_pending'` (not errors)
   - ✅ `payment_method` shows: `'pay_later'` or `'razorpay'`
   - ✅ Recent order is there with correct data

---

### **STEP 7: Test Inventory Updates** 📦

After placing order, verify stock decreased:

1. As Admin, go to dashboard
2. Scroll to **"Manage inventory levels"**
3. Find the item you ordered
4. Click **Edit**
5. Verify quantity decreased by the ordered amount

**Example:**
- Before: 100 units
- Ordered: 5 units  
- After: 95 units (should show this)

**If quantity updated:** ✅ PASS - Inventory tracking works!

---

## ✅ Full Verification Checklist

Mark each as complete:

- [ ] **Step 1**: Migration applied to Supabase
- [ ] **Step 2**: Latest code deployed to Vercel
- [ ] **Step 3a**: Can login as buyer
- [ ] **Step 3b**: Can see items in inventory
- [ ] **Step 3c**: Can place order successfully (success message appears)
- [ ] **Step 4**: Manager receives packing task (no buyer name visible)
- [ ] **Step 5**: Admin can see order in dashboard
- [ ] **Step 6**: Database shows correct order status enum (optional)
- [ ] **Step 7**: Inventory quantity decreased correctly

---

## 🐛 Troubleshooting

### **Issue: Still getting 500 error**
**Solution:**
1. Verify migration was actually executed in Supabase (not just copied)
2. Check Supabase logs: Supabase Dashboard → Logs → PostgreSQL
3. Redeploy Vercel app: Force rebuild
4. Clear browser cache: Ctrl+Shift+Delete (clear cookies/cache)
5. Try in incognito/private window

### **Issue: Migration failed in Supabase**
**Solution:**
1. Copy entire SQL again (make sure entire file)
2. Paste in fresh SQL Editor query
3. Execute
4. If error persists, screenshot and share error message

### **Issue: Manager doesn't see packing task**
**Solution:**
1. Verify item was assigned to manager: Admin → Item manager assignments
2. Verify buyer ordered the correct item
3. Refresh manager dashboard
4. Check manager is logged in correctly

### **Issue: Order shows but with wrong status**
**Solution:**
1. Check payment method selected (pay_later → confirmed, razorpay → payment_pending)
2. Database should have correct enum value
3. Report if seeing text like `"confirmed"` instead of enum value

---

## 📞 Success Criteria

**Bug is FIXED if all of these are true:**
1. ✅ Buyer places order → Gets success message (not 500 error)
2. ✅ Order appears in database with correct status enum value
3. ✅ Inventory quantities decrease
4. ✅ Manager receives packing task (with buyer code, not name)
5. ✅ Admin sees order in dashboard
6. ✅ No error in Supabase logs about enum type mismatch

---

## 📝 Notes

- Fix is **production-safe**: only updates function logic, no data schema changes
- Can rerun migration multiple times: it's idempotent (safe)
- All tests pass: `npm test` shows 23/23 passing
- Build works: `npm run build` completes without errors

---

**Status:** Ready for verification  
**Last Updated:** 2026-09-27  
**Migration File:** `supabase/migrations/20260927000000_fix_order_enum_casting.sql`  
**Test File:** `tests/buyer-order-creation.test.ts`
