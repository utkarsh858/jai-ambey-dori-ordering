# Issue Resolution - Step-by-Step Instructions

## Issue #1: Order Completion 500 Error ✅ FIXED

### Root Cause
The `order_status` enum didn't have "completed" as a valid value. It only had: `'payment_pending', 'confirmed', 'cancelled', 'fulfilled'`.

### Solution Applied
Created migration: `supabase/migrations/20260928000001_fix_order_completion_status.sql`
- Adds 'completed' value to order_status enum
- Updates mark_order_complete function
- Adds RLS policies for order visibility

### What You Need To Do

**Step 1: Apply the order completion fix migration**

1. Go to **Supabase Dashboard** → **SQL Editor** → **New Query**
2. Copy this SQL and execute:

```sql
-- Add 'completed' status to order_status enum
ALTER TYPE public.order_status ADD VALUE IF NOT EXISTS 'completed';

-- Update the mark_order_complete function to use the correct approach
DROP FUNCTION IF EXISTS public.mark_order_complete(uuid, text);

CREATE FUNCTION public.mark_order_complete(
  p_order_id uuid,
  p_completion_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
BEGIN
  -- Check if user is admin
  IF (SELECT role FROM profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Only admins can mark orders as complete';
  END IF;

  -- Update order status to completed
  UPDATE orders
  SET status = 'completed'::public.order_status
  WHERE id = p_order_id;

  -- Verify the update was successful
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
END;
$$;

-- Grant permission to authenticated users
GRANT EXECUTE ON FUNCTION public.mark_order_complete(uuid, text) TO authenticated;
```

3. Click **Execute**
4. Wait for success message

---

## Issue #2: Admin Unable to Add Images ✅ FIXED

### Root Cause
Missing UI for uploading images. The database migration had the `add_item_image()` function, but no admin interface to call it.

### Solution Applied
1. Created `ImageUploader` component (`src/app/admin/image-uploader.tsx`)
   - Form to input image URL and alt text
   - Submits to server action

2. Updated admin dashboard (`src/app/admin/page.tsx`)
   - New "Manage item images" section
   - Shows all inventory items
   - Each item has an image uploader form

3. Uses existing `addItemImage()` server action
   - Calls `add_item_image()` RPC function

### What You Need To Do

**Step 2: Apply the product enhancements migration** (if not done yet)

If you haven't already applied the migration `20260928000000_add_product_enhancements.sql`, do it now:

1. Go to **Supabase Dashboard** → **SQL Editor** → **New Query**
2. Copy content from your repo: `supabase/migrations/20260928000000_add_product_enhancements.sql`
3. Paste into SQL Editor
4. Click **Execute**
5. Wait for success message

**Step 3: Redeploy to Vercel**

1. Go to **Vercel Dashboard** → Your Project
2. Go to **Deployments** tab
3. Find the latest deployment OR click **Redeploy** to trigger new build
4. Wait for build to complete (~2-3 minutes)
5. Vercel will show "✅ Production" when ready

---

## Testing the Fixes

### Test Order Completion
1. Login as admin
2. Scroll to "Recent orders" section
3. For any non-completed order, click **"Mark complete"** button
4. Order status should change to "completed" (shown in green)
5. Button should disappear

**Expected Result:** ✅ No 500 error, order status changes to "completed"

### Test Image Upload
1. Login as admin
2. Scroll to bottom - see "Manage item images" section
3. For each item, you'll see an "Add image to [item name]" form
4. Enter image URL (e.g., https://example.com/image.jpg)
5. Optionally add alt text
6. Click **"Add Image"** button
7. Should see success message

**Expected Result:** ✅ No 500 error, image added successfully

### Test Image Display in Buyer View
1. Login as buyer
2. Go to "New order" section
3. Scroll to any item you added images to
4. Images should display in the buyer catalog (once we add that UI - for now they're stored in database)

---

## Summary of Changes Made

### Database Migrations
- `20260928000001_fix_order_completion_status.sql` - Adds completed status and updates function

### Frontend Components
- `src/app/admin/image-uploader.tsx` - New image upload form component
- `src/app/admin/page.tsx` - Updated with "Manage item images" section

### Code Status
- ✅ `npm run build` - Passes
- ✅ `npm test` - All 23 tests pass
- ✅ `npm run lint` - Passes

---

## Troubleshooting

If you still get 500 errors:

1. **For order completion:**
   - Check Supabase logs for error details
   - Verify you ran the SQL migration completely
   - Make sure `mark_order_complete` function exists

2. **For image upload:**
   - Check browser console for error messages
   - Check Supabase logs (similar location as before)
   - Verify the image URL is valid and accessible
   - Make sure database migration was applied

3. **General:**
   - Clear browser cache (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)
   - Try incognito/private browsing mode
   - Check Vercel deployment logs if frontend isn't loading
