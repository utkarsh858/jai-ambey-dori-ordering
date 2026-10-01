# Deployment Checklist - Final Steps

**Current Status:** All code changes complete, tested, and committed  
**Latest Commit:** `f8ba9cb` - Improvements for error display and manager task visibility  
**Tests:** ✅ All 23 pass | **Build:** ✅ Pass | **Lint:** ✅ Pass

---

## Step 1: Apply Required Database Migrations to Supabase

Go to Supabase Dashboard → SQL Editor and run these 3 migrations IN ORDER:

### Migration 1: Sync Packing Tasks on Order Completion
```sql
-- Issue 4 Fix: Update packing tasks when order status changes to completed
ALTER TYPE public.task_status ADD VALUE IF NOT EXISTS 'completed';

CREATE OR REPLACE FUNCTION public.sync_packing_tasks_on_order_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status::text = 'completed' AND OLD.status::text != 'completed' THEN
    UPDATE public.packing_tasks
    SET status = 'completed'::public.task_status
    WHERE order_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_packing_tasks_on_order_completion_trigger ON public.orders;

CREATE TRIGGER sync_packing_tasks_on_order_completion_trigger
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_packing_tasks_on_order_completion();

GRANT EXECUTE ON FUNCTION public.sync_packing_tasks_on_order_completion() TO authenticated;
```

### Migration 2: Fix Order Status Enum Casting
```sql
-- Fix: Improve order status casting in create_order function
CREATE OR REPLACE FUNCTION public.create_order(p_lines jsonb, p_payment_method public.payment_method)
RETURNS TABLE(order_id uuid, order_number text, total_paise integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles%rowtype;
  v_order_id uuid := gen_random_uuid();
  v_order_number text := 'ORD-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  v_total integer := 0;
  v_line record;
  v_item public.items%rowtype;
  v_inventory public.inventory%rowtype;
  v_initial_status public.order_status;
BEGIN
  IF auth.uid() IS NULL OR public.current_role() <> 'buyer' THEN
    RAISE EXCEPTION 'Only buyers can place orders';
  END IF;
  
  IF jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'Order must contain at least one line';
  END IF;
  
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_lines) e WHERE COALESCE((e->>'quantity')::integer, 0) <= 0) THEN
    RAISE EXCEPTION 'Quantities must be positive';
  END IF;
  
  IF (SELECT COUNT(*) FROM jsonb_array_elements(p_lines)) <> (SELECT COUNT(DISTINCT (e->>'item_id')) FROM jsonb_array_elements(p_lines) e) THEN
    RAISE EXCEPTION 'Duplicate items are not allowed';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = auth.uid();
  
  FOR v_line IN SELECT (e->>'item_id')::uuid as item_id, (e->>'quantity')::integer as quantity FROM jsonb_array_elements(p_lines) e ORDER BY (e->>'item_id') LOOP
    SELECT * INTO v_item FROM public.items WHERE id = v_line.item_id AND active FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Item is unavailable'; END IF;
    
    SELECT * INTO v_inventory FROM public.inventory WHERE item_id = v_line.item_id FOR UPDATE;
    IF NOT FOUND OR v_inventory.available_quantity < v_line.quantity THEN 
      RAISE EXCEPTION 'Insufficient stock for %', v_item.sku; 
    END IF;
    
    UPDATE public.inventory SET available_quantity = available_quantity - v_line.quantity,
      reserved_quantity = reserved_quantity + v_line.quantity, updated_at = now() 
      WHERE item_id = v_line.item_id;
    
    v_total := v_total + v_item.unit_price_paise * v_line.quantity;
  END LOOP;

  IF p_payment_method = 'pay_later' THEN
    v_initial_status := 'confirmed'::public.order_status;
  ELSE
    v_initial_status := 'payment_pending'::public.order_status;
  END IF;

  INSERT INTO public.orders (id, order_number, buyer_id, buyer_code, status, payment_method, total_paise)
  VALUES (v_order_id, v_order_number, auth.uid(), v_profile.buyer_code, v_initial_status, p_payment_method, v_total);
  
  FOR v_line IN SELECT (e->>'item_id')::uuid as item_id, (e->>'quantity')::integer as quantity FROM jsonb_array_elements(p_lines) e LOOP
    SELECT * INTO v_item FROM public.items WHERE id = v_line.item_id;
    
    INSERT INTO public.order_items (order_id, item_id, sku, item_name, quantity, unit_price_paise)
    VALUES (v_order_id, v_item.id, v_item.sku, v_item.name, v_line.quantity, v_item.unit_price_paise);
    
    IF p_payment_method = 'pay_later' THEN
      INSERT INTO public.packing_tasks (order_id, order_number, buyer_code, item_id, item_name, quantity)
      VALUES (v_order_id, v_order_number, v_profile.buyer_code, v_item.id, v_item.name, v_line.quantity);
    END IF;
  END LOOP;
  
  INSERT INTO public.payments (order_id, provider, status, amount_paise)
  VALUES (v_order_id, CASE WHEN p_payment_method = 'razorpay' THEN 'razorpay' ELSE 'pay_later' END,
    CASE WHEN p_payment_method = 'pay_later' THEN 'not_required'::public.payment_status ELSE 'pending'::public.payment_status END, v_total);
  
  INSERT INTO public.audit_events (actor_id, entity_type, entity_id, action, payload)
  VALUES (auth.uid(), 'order', v_order_id, 'created', jsonb_build_object('payment_method', p_payment_method, 'total_paise', v_total));
  
  RETURN QUERY SELECT v_order_id, v_order_number, v_total;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_order(jsonb, public.payment_method) TO authenticated;
```

### Migration 3: Allow Null Manager Assignment
```sql
ALTER TABLE public.packing_tasks
ALTER COLUMN assigned_manager_id DROP NOT NULL;
```

### Migration 4: Allow Managers to See Unassigned Tasks
```sql
DROP POLICY IF EXISTS "managers read assigned safe tasks" ON public.packing_tasks;

CREATE POLICY "managers read assigned safe tasks" ON public.packing_tasks 
FOR SELECT USING (
  assigned_manager_id = auth.uid() 
  OR assigned_manager_id IS NULL 
  OR public.is_admin()
);
```

### Migration 5: Create Storage Bucket for Images
**NO SQL NEEDED** - Do this manually in Supabase Storage:
1. Go to Storage section
2. Create new bucket named: `item-images`
3. Set to Public (toggle the "Public" checkbox)
4. Create bucket

---

## Step 2: Redeploy to Vercel

1. Go to Vercel Dashboard
2. Select JaiAmbeyDori project
3. Click "Deployments"
4. Click "Redeploy" on commit `f8ba9cb`
5. Wait for deployment to complete (should show "Ready")

---

## Step 3: Verify All Features Work

### ✅ Test 1: Buyer Error Display
1. Log in as Buyer
2. Add item to cart
3. Leave quantity as 0 (or enter invalid quantity)
4. Click "Reserve stock & place order"
5. **Expected:** Red error box appears with ❌ icon and error message

### ✅ Test 2: Buyer Places Order Successfully
1. Log in as Buyer
2. Add quantity for item (e.g., 2)
3. Select "Pay later" option
4. Click "Reserve stock & place order"
5. **Expected:** Green success box with ✅ icon and Order Number

### ✅ Test 3: Manager Sees New Orders
1. Log in as Manager
2. Refresh page
3. Look at "Assigned packing tasks" section
4. **Expected:** New order appears in list with status "queued" (orange badge)

### ✅ Test 4: Admin Can Edit Items
1. Log in as Admin
2. Scroll to "Edit existing items" section
3. Click "Edit" button next to any item
4. Change price to 500.50
5. Click "Save Changes"
6. **Expected:** Success message, item updated in database

### ✅ Test 5: Admin Can Upload Item Images
1. Log in as Admin
2. Find "Manage item images" section
3. Select an item
4. Toggle to "From device"
5. Click "Choose file" and select image from computer
6. Click "Upload image"
7. **Expected:** Success message, image appears in item preview

### ✅ Test 6: Admin Marks Order Complete
1. Log in as Admin
2. Find order in "Active Orders"
3. Click "Mark as Complete"
4. Confirm action
5. Log in as Manager
6. Refresh dashboard
7. **Expected:** Same order shows "completed" (green badge) instead of "queued"

### ✅ Test 7: Manager Can Decrease Stock
1. Log in as Manager
2. Find item in "Item Stock Management"
3. Click "Adjust stock"
4. Enter: `-5`
5. Enter reason: "Damage/Defect"
6. Click "Adjust stock"
7. **Expected:** Stock decreases by 5 units

---

## Troubleshooting

**If migrations fail:**
- Copy/paste exact SQL from each section
- Run one migration at a time
- Check Supabase logs for error messages
- Verify table names match (case-sensitive: `public.orders`, `public.packing_tasks`, etc.)

**If image upload fails:**
- Verify `item-images` bucket was created in Storage
- Verify bucket is set to Public
- Refresh browser cache

**If manager doesn't see orders:**
- Verify Migration 4 (RLS policy) was applied
- Check manager is logged in with correct user
- Refresh page after new order is placed

---

## Final Checklist

- [ ] All 4 migrations applied to Supabase
- [ ] `item-images` storage bucket created
- [ ] App redeployed to Vercel
- [ ] Test 1 (Buyer error display) passes ✅
- [ ] Test 2 (Buyer orders successfully) passes ✅
- [ ] Test 3 (Manager sees orders) passes ✅
- [ ] Test 4 (Admin edits items) passes ✅
- [ ] Test 5 (Admin uploads images) passes ✅
- [ ] Test 6 (Admin marks complete) passes ✅
- [ ] Test 7 (Manager decreases stock) passes ✅

**Once all tests pass, system is production-ready! 🎉**
