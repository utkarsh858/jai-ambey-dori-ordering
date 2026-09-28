# 5 Critical Issues - Fix Verification Guide

**Commit:** `af4811b` - All code changes pushed to main  
**Status:** ✅ Build, Tests, Lint Pass  
**Deploy Status:** Ready for Vercel redeployment

---

## Prerequisites (Must Do First)

### 1. Apply Database Migration to Supabase

**Location:** `supabase/migrations/20260928000002_sync_packing_tasks_on_completion.sql`

Run this SQL in your Supabase SQL Editor:

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

**Verification:** Should complete without errors.

### 2. Create Supabase Storage Bucket

In your Supabase dashboard:
1. Go to **Storage**
2. Click **Create bucket**
3. Name: `item-images`
4. Set to **Public**
5. Create

**Verification:** Bucket appears in storage list.

### 3. Redeploy App to Vercel

Since all code is committed, Vercel should auto-deploy. Or manually trigger deployment:
- Go to Vercel Dashboard → JaiAmbeyDori project → Deployments
- Click "Redeploy" on latest commit `af4811b`

**Wait for deployment to complete and show "Ready"**

---

## Testing Checklist

### Issue #1: File Upload from Local Device

**Test Steps:**
1. Go to Admin Portal (login as admin)
2. Navigate to "Manage items" section
3. Click on "Manage item images"
4. Select an item from dropdown
5. **Click toggle to switch from "From URL" to "From device"**
6. Click "Choose file" button
7. Select an image from your computer (JPG/PNG, max 5MB)
8. Click "Upload image"
9. Wait for success message

**Expected:** Image uploads successfully, no 500 error, success message appears

**Verify:**
- Go to Buyer Portal
- View any item in dashboard
- Image should be visible with item details

---

### Issue #2: Item Details Editable in UI

**Test Steps:**
1. Go to Admin Portal
2. Scroll to bottom → "Edit existing items" section
3. Click **Edit** button next to any item
4. In the edit form, modify:
   - Name (change to "Test Item Updated")
   - Price (change to 500.50)
   - Description (change to a new description)
   - Full Description (add multi-line text with line breaks)
   - UOM (change to "Kg" or other unit)
5. Click **Save Changes**
6. Wait for success message

**Expected:** Item updates successfully, no 500 error, success message shows

**Verify:**
- Refresh page
- Item should show updated details in both Admin and Buyer portals
- Buyer portal should show full description, UOM, and new price

---

### Issue #3: Price Input Accepts Any Decimal Value

**Test Steps:**
1. Go to Admin Portal → Add New Item
2. Fill in all fields
3. In **Price** field, enter: `500.50`
4. Try to submit

**Expected:** Form accepts 500.50 without forcing it to round/change

**Alternative Test:**
- Edit an existing item
- Change price to `1299.99`
- Save

**Expected:** Price accepted and saved correctly in database

---

### Issue #4: Completed Orders Sync in Manager Portal

**Test Steps:**
1. **As Admin:**
   - Go to Admin Portal
   - Find a pending order in "Active Orders" section
   - Click **"Mark as Complete"** button
   - Confirm action

2. **As Manager:**
   - Go to Manager Portal (refresh page to see latest)
   - Find the same order number
   - Look at status badge

**Expected:** 
- Order status shows as **"completed"** (green badge)
- NOT "queued" (should NOT show orange badge anymore)
- Task successfully synced from orders table to packing_tasks table

**Verify in Database:**
- Go to Supabase → packing_tasks table
- Filter by order_number of completed order
- All rows should have status = "completed"

---

### Issue #5: Manager Can Decrease Stock

**Test Steps:**
1. Go to Manager Portal
2. Find an item in "Item Stock Management"
3. Click **"Adjust stock"** button
4. New form appears with fields:
   - Delta quantity
   - Reason
5. **Enter negative number:** `-5`
6. **Enter reason:** "Stock correction"
7. Click **"Adjust stock"**

**Expected:**
- No 500 error
- Success message appears
- Stock decreases by 5 units
- Reason is saved in database

**Also test increase:**
- Click **"Adjust stock"** again
- Enter: `+10`
- Enter reason: "New stock received"
- Click **"Adjust stock"**

**Expected:** Stock increases by 10 units

---

## Rollback Plan (If Issues Occur)

If you encounter errors after applying migrations:

1. **Check Supabase logs:** Dashboard → Database → Logs
2. **Verify trigger created:** Go to Functions in Supabase, look for `sync_packing_tasks_on_order_completion`
3. **Verify bucket created:** Storage section shows `item-images`
4. **Check Vercel logs:** Dashboard → Deployments → View build logs

If rollback needed:
```sql
-- Revert trigger (from Supabase SQL Editor)
DROP TRIGGER IF EXISTS sync_packing_tasks_on_order_completion_trigger ON public.orders;
DROP FUNCTION IF EXISTS public.sync_packing_tasks_on_order_completion();
```

---

## Success Criteria

✅ All 5 issues must pass testing above  
✅ No 500 errors in console  
✅ No errors in Supabase logs  
✅ Build and deployment successful  
✅ All features work as described  

Once all tests pass, system is fully functional and ready for production use.
