# Test Buyer Order Flow - Complete Integration Test

This document provides comprehensive testing steps to verify the entire buyer order flow works correctly after applying the migrations.

---

## 🎯 Test Objectives

Verify that:
1. ✅ Buyers can create orders without 500 errors
2. ✅ Packing tasks are created with managers assigned
3. ✅ Inventory is decremented correctly
4. ✅ Order status is set correctly
5. ✅ Managers receive packing tasks
6. ✅ Error handling works for edge cases

---

## 📋 Prerequisites

Before testing, ensure:
- [ ] All 3 migrations applied to Supabase
- [ ] Vercel deployment complete
- [ ] Admin has logged in and created:
  - [ ] At least 1 active item in inventory
  - [ ] Item has quantity > 5 in stock
  - [ ] At least 1 manager assigned to the item
  - [ ] At least 1 buyer profile (non-admin user)

---

## 🧪 Test Cases

### TEST 1: Basic Order Creation (Critical)

**Objective:** Verify buyer can place a simple order

**Steps:**
1. Logout from all accounts
2. Login as **BUYER** (not admin)
3. Navigate to **Catalog** or **Orders** page
4. Select 1 item with stock
5. Enter quantity (1-5)
6. Click **"Place Order"** or **"Submit Order"**

**Expected Result:**
- ✅ No 500 error
- ✅ Success message displays
- ✅ Order appears in buyer's order list
- ✅ Order number shows (e.g., ORD-20260927-F43E5B)
- ✅ Status shows "payment_pending" or "confirmed" (depending on payment method)

**Verification Query** (Run in Supabase SQL Editor):

```sql
SELECT 
  order_number, 
  status, 
  total_paise, 
  created_at
FROM public.orders
WHERE buyer_id = (SELECT id FROM public.profiles WHERE role = 'buyer' LIMIT 1)
ORDER BY created_at DESC
LIMIT 1;
```

**Expected Output:**
```
order_number    | status          | total_paise | created_at
ORD-20260927... | payment_pending | 5000+       | [current time]
```

---

### TEST 2: Packing Task Creation (Critical)

**Objective:** Verify packing task is created with manager assigned

**Prerequisites:** Complete TEST 1 first

**Steps:**
1. Get the order_number from TEST 1
2. Go to Supabase SQL Editor
3. Run verification query below
4. **Do NOT manually create packing tasks**

**Verification Query** (Run in Supabase SQL Editor):

```sql
SELECT 
  order_number,
  buyer_code,
  item_name,
  quantity,
  assigned_manager_id,
  status,
  created_at
FROM public.packing_tasks
WHERE order_number = 'ORD-[YOUR_ORDER_NUMBER_FROM_TEST_1]';
```

**Expected Output:**
```
order_number    | buyer_code | item_name | quantity | assigned_manager_id                | status | created_at
ORD-20260927... | B1ABAFDB1  | [item]    | 3        | 550e8400-e29b-41d4-a716-446655440000 | queued | [time]
```

**CRITICAL CHECK:**
- ✅ `assigned_manager_id` is **NOT NULL** (must have a UUID)
- ✅ `status` is **"queued"**
- ❌ If `assigned_manager_id` is NULL → **Migration 2 not applied correctly**

---

### TEST 3: Inventory Decrement (Critical)

**Objective:** Verify inventory is decremented after order

**Prerequisites:** Complete TEST 1 first

**Steps:**
1. Note the item_id and quantity from TEST 1
2. Run verification query below

**Verification Query** (Run in Supabase SQL Editor):

```sql
SELECT 
  item_id,
  sku,
  available_quantity,
  reserved_quantity,
  total_quantity,
  updated_at
FROM public.inventory
WHERE sku = '[ITEM_SKU_FROM_TEST_1]'
ORDER BY updated_at DESC
LIMIT 1;
```

**Expected Output:**
```
item_id  | sku      | available_quantity | reserved_quantity | total_quantity | updated_at
[UUID]   | CLOTH-01 | 7                  | 3                 | 10             | [current]
```

**CRITICAL CHECKS:**
- ✅ `available_quantity` decreased by order quantity (10 - 3 = 7)
- ✅ `reserved_quantity` increased by order quantity (0 + 3 = 3)
- ✅ `total_quantity` stayed same (10)
- ❌ If quantities not updated → RLS policy issue or transaction failure

---

### TEST 4: Multiple Item Order

**Objective:** Verify orders with multiple items work correctly

**Steps:**
1. Login as buyer
2. Select **2-3 different items** with stock
3. Add quantities to each
4. Click **"Place Order"**

**Expected Result:**
- ✅ No 500 error
- ✅ Single order created with order_number
- ✅ Multiple packing_tasks created (one per item)
- ✅ Each packing_task has assigned_manager_id

**Verification Query**:

```sql
SELECT 
  order_number,
  COUNT(*) as packing_task_count,
  array_agg(item_name) as items,
  array_agg(assigned_manager_id) FILTER (WHERE assigned_manager_id IS NOT NULL) as managers_assigned
FROM public.packing_tasks
WHERE order_number = (SELECT order_number FROM public.orders ORDER BY created_at DESC LIMIT 1)
GROUP BY order_number;
```

**Expected Output:**
```
order_number    | packing_task_count | items                    | managers_assigned
ORD-20260927... | 3                  | {Item1, Item2, Item3}    | {uuid1, uuid2, uuid3}
```

**CRITICAL CHECKS:**
- ✅ `packing_task_count` = number of items ordered
- ✅ All items in `managers_assigned` array (no NULLs)

---

### TEST 5: Order with Pay Later

**Objective:** Verify pay_later orders create with "confirmed" status

**Steps:**
1. Login as buyer
2. Select item with stock
3. Enter quantity
4. **Select "Pay Later"** payment method
5. Click **"Place Order"**

**Verification Query**:

```sql
SELECT 
  order_number,
  payment_method,
  status,
  total_paise
FROM public.orders
WHERE payment_method = 'pay_later'
ORDER BY created_at DESC
LIMIT 1;
```

**Expected Output:**
```
order_number    | payment_method | status    | total_paise
ORD-20260927... | pay_later      | confirmed | 5000+
```

**CRITICAL CHECKS:**
- ✅ `status` is **"confirmed"** (not "payment_pending")
- ✅ No payment required shown to buyer

---

### TEST 6: Order with Razorpay

**Objective:** Verify razorpay orders create with "payment_pending" status

**Steps:**
1. Login as buyer
2. Select item with stock
3. Enter quantity
4. **Select "Razorpay"** payment method
5. Click **"Place Order"**

**Verification Query**:

```sql
SELECT 
  order_number,
  payment_method,
  status,
  total_paise
FROM public.orders
WHERE payment_method = 'razorpay'
ORDER BY created_at DESC
LIMIT 1;
```

**Expected Output:**
```
order_number    | payment_method | status          | total_paise
ORD-20260927... | razorpay       | payment_pending | 5000+
```

**CRITICAL CHECKS:**
- ✅ `status` is **"payment_pending"** (not "confirmed")
- ✅ Order awaits payment completion

---

### TEST 7: Insufficient Stock Error (Edge Case)

**Objective:** Verify error handling when stock is insufficient

**Steps:**
1. Login as buyer
2. Select item with only 2 units in stock
3. Enter quantity **"10"** (more than available)
4. Click **"Place Order"**

**Expected Result:**
- ✅ Clear error message: "Insufficient stock for [SKU]"
- ✅ No order created
- ✅ No 500 error
- ✅ Inventory unchanged

**Verification Query**:

```sql
-- Check no order was created for this buyer in last 2 minutes
SELECT COUNT(*) as recent_order_count
FROM public.orders
WHERE buyer_id = (SELECT id FROM public.profiles WHERE role = 'buyer' LIMIT 1)
  AND created_at > now() - interval '2 minutes';
```

**Expected Output:**
```
recent_order_count
0
```

---

### TEST 8: Invalid Item Error (Edge Case)

**Objective:** Verify error handling when item doesn't exist

**Steps:**
1. Open browser dev tools (F12)
2. Go to **Network** tab
3. Manually create request to `/buyer` with invalid item_id (fake UUID)
4. Observe error response

**Expected Result:**
- ✅ Error message: "Item is unavailable"
- ✅ No order created
- ✅ HTTP 400 or 500 with clear error
- ✅ No inventory update

---

### TEST 9: Duplicate Items Error (Edge Case)

**Objective:** Verify error handling when order contains same item twice

**Steps:**
1. Login as buyer
2. Somehow craft order with duplicate item_ids (use dev tools)
3. Submit

**Expected Result:**
- ✅ Error message: "Duplicate items are not allowed"
- ✅ No order created

---

### TEST 10: Manager Receives Packing Task

**Objective:** Verify manager can see newly created packing tasks

**Steps:**
1. Complete TEST 1 (create order)
2. Logout buyer
3. **Login as MANAGER** (not admin, not buyer)
4. Navigate to **"Packing Tasks"** or **"Orders to Pack"** page
5. Look for task with order_number from TEST 1

**Expected Result:**
- ✅ Manager sees packing task
- ✅ Packing task shows:
  - Order number (e.g., ORD-20260927-F43E5B)
  - Item name and quantity
  - Buyer code (e.g., B1ABAFDB1) - NOT buyer name or email
  - Status: "queued"
  - Manager CANNOT see buyer name, email, or contact info
- ✅ Manager can mark as "packed", "shipped", etc.

**Database Verification** (manager runs as themselves):

```sql
SELECT 
  order_number,
  buyer_code,
  item_name,
  quantity,
  status
FROM public.packing_tasks
WHERE assigned_manager_id = auth.uid()
ORDER BY created_at DESC
LIMIT 5;
```

**Expected Output:**
```
order_number    | buyer_code | item_name    | quantity | status
ORD-20260927... | B1ABAFDB1  | Arabic Cloth | 3        | queued
```

**CRITICAL CHECKS:**
- ✅ Manager can ONLY see `order_number`, `buyer_code`, item details, quantity, status
- ✅ Manager CANNOT see buyer email, name, phone, or contact info
- ❌ If manager sees buyer details → RLS policy failure

---

## 📊 Test Summary Table

| # | Test Name | Type | Status | Notes |
|---|-----------|------|--------|-------|
| 1 | Basic Order | Critical | Pending | Must pass before others |
| 2 | Packing Task | Critical | Pending | Verifies migration 2 |
| 3 | Inventory | Critical | Pending | Verifies transactions |
| 4 | Multiple Items | Normal | Pending | Complex orders |
| 5 | Pay Later | Normal | Pending | Status = confirmed |
| 6 | Razorpay | Normal | Pending | Status = payment_pending |
| 7 | Low Stock | Edge Case | Pending | Error handling |
| 8 | Invalid Item | Edge Case | Pending | Data validation |
| 9 | Duplicates | Edge Case | Pending | Constraint check |
| 10 | Manager Task | Normal | Pending | Privacy verification |

---

## ✅ Success Criteria

All tests pass when:
- [ ] TEST 1: No 500 error, order created
- [ ] TEST 2: assigned_manager_id NOT NULL
- [ ] TEST 3: Inventory decremented correctly
- [ ] TEST 4: Multiple items create multiple tasks
- [ ] TEST 5: pay_later = confirmed status
- [ ] TEST 6: razorpay = payment_pending status
- [ ] TEST 7: Error on low stock
- [ ] TEST 8: Error on invalid item
- [ ] TEST 9: Error on duplicates
- [ ] TEST 10: Manager sees only order_number + buyer_code

---

## 🔍 Debugging Tips

### If TEST 1 fails with 500 error:

```sql
-- Check Supabase logs for exact error
SELECT event_message, context, detail 
FROM postgres_logs 
WHERE timestamp > now() - interval '5 minutes'
ORDER BY timestamp DESC 
LIMIT 5;
```

### If TEST 2 fails (NULL assigned_manager_id):

```sql
-- Check if item_manager_assignments table has data
SELECT COUNT(*) as assignment_count FROM public.item_manager_assignments;

-- Check if your test item has a manager
SELECT * FROM public.item_manager_assignments 
WHERE item_id = '[YOUR_TEST_ITEM_ID]';

-- If no results: Admin must assign manager to item
```

### If TEST 3 fails (inventory not updated):

```sql
-- Check if RLS policies allow buyer to update inventory
SELECT * FROM pg_policies WHERE tablename = 'inventory';

-- Check inventory update trigger
SELECT * FROM pg_trigger WHERE tgrelname = 'inventory';
```

### If TEST 10 fails (manager sees buyer details):

```sql
-- Check packing_tasks RLS policies
SELECT policyname, qual, with_check 
FROM pg_policies 
WHERE tablename = 'packing_tasks';

-- Should NOT include buyer_email, buyer_name, buyer_phone in SELECT
```

---

## 📞 Support

**If all tests pass:**
- ✅ Fix is complete and working
- ✅ Ready for production
- ✅ Proceed to payment flow testing

**If any test fails:**
1. Note the test number and failure
2. Check troubleshooting above
3. Verify migrations were applied (re-apply if needed)
4. Check admin has set up test data (items, managers, buyers)
5. Review Supabase PostgreSQL logs for database errors

---

**Start with TEST 1. Do not skip to later tests.**

