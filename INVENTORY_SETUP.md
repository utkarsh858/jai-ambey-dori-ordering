# How to Add Items to Inventory and Assign to Item Managers

## Overview
There are two separate workflows:
1. **Add Items** - Create catalog items (SKU, name, price)
2. **Add Inventory** - Set stock quantities for items
3. **Assign Managers** - Assign items to item managers

Currently, items and inventory are managed via **Supabase SQL Editor**. UI for this is not yet implemented.

## Step 1: Add Items to Catalog (SQL)

In Supabase SQL Editor, run:

```sql
INSERT INTO public.items (id, sku, name, description, unit_price_paise, active)
VALUES
  (gen_random_uuid(), 'CLOTH-001', 'Cotton Cloth 5m', 'Premium quality cotton cloth', 50000, true),
  (gen_random_uuid(), 'CLOTH-002', 'Silk Cloth 3m', 'High-quality silk cloth', 100000, true),
  (gen_random_uuid(), 'ROPE-001', 'Nylon Rope 50m', 'Strong nylon rope', 30000, true),
  (gen_random_uuid(), 'ROPE-002', 'Cotton Rope 100m', 'Natural cotton rope', 25000, true);
```

**Parameters explained:**
- `id` - Auto-generated UUID (do not manually set)
- `sku` - Unique identifier for the item (e.g., 'CLOTH-001')
- `name` - Display name in the buyer portal
- `description` - Optional description
- `unit_price_paise` - Price in paise (1 Rupee = 100 paise), e.g., 50000 = ₹500
- `active` - Set to `true` to make available to buyers

## Step 2: Add Inventory Stock Levels (SQL)

First, get the item IDs you just created:

```sql
SELECT id, sku, name FROM public.items WHERE active = true ORDER BY created_at DESC LIMIT 10;
```

Then, for each item, create an inventory entry:

```sql
INSERT INTO public.inventory (item_id, available_quantity)
SELECT id, 100 FROM public.items WHERE sku = 'CLOTH-001'
ON CONFLICT (item_id) DO UPDATE SET available_quantity = 100;

INSERT INTO public.inventory (item_id, available_quantity)
SELECT id, 50 FROM public.items WHERE sku = 'CLOTH-002'
ON CONFLICT (item_id) DO UPDATE SET available_quantity = 50;

INSERT INTO public.inventory (item_id, available_quantity)
SELECT id, 200 FROM public.items WHERE sku = 'ROPE-001'
ON CONFLICT (item_id) DO UPDATE SET available_quantity = 200;

INSERT INTO public.inventory (item_id, available_quantity)
SELECT id, 150 FROM public.items WHERE sku = 'ROPE-002'
ON CONFLICT (item_id) DO UPDATE SET available_quantity = 150;
```

**Parameters:**
- `item_id` - The UUID of the item (from step 1)
- `available_quantity` - Number of units in stock
- `ON CONFLICT` - Updates if item already exists in inventory

## Step 3: Assign Items to Item Managers (UI)

1. Go to Admin Dashboard → `/admin`
2. Scroll to **"Item manager assignments"** section
3. For each item, select a manager from the dropdown
4. Click **"Assign"** button

**Visual flow:**
```
Item manager assignments
┌─────────────────────────────────┐
│ Cotton Cloth 5m                 │
│ CLOTH-001                       │
│                                 │
│ Assigned managers:              │
│ • John Manager [Remove]         │
│                                 │
│ [Select manager ▼] [Assign]     │
└─────────────────────────────────┘
```

## Step 4: Verify Everything Works

### As Admin
1. Go to `/admin`
2. Check **Inventory** card shows all items with stock levels
3. Check **Item manager assignments** shows items with assigned managers

### As Item Manager
1. Sign in with manager account
2. Go to `/manager`
3. Should see **"Assigned inventory"** table with only their assigned items
4. Should see **"Assigned packing tasks"** when buyers place orders

### As Buyer
1. Sign in with buyer account
2. Go to `/buyer`
3. Should see all active items with prices
4. Should be able to create orders

## Complete Setup Example

### SQL: Add 3 Items
```sql
INSERT INTO public.items (sku, name, description, unit_price_paise, active)
VALUES
  ('KHADI-SAREE', 'Khadi Saree', 'Traditional handwoven saree', 150000, true),
  ('COTTON-ROPE', 'Cotton Rope 50m', 'Durable cotton rope', 20000, true),
  ('LINEN-CLOTH', 'Linen Cloth 5m', 'Premium linen', 80000, true);
```

### SQL: Add Stock
```sql
INSERT INTO public.inventory (item_id, available_quantity)
SELECT id, 25 FROM public.items WHERE sku = 'KHADI-SAREE'
ON CONFLICT (item_id) DO UPDATE SET available_quantity = 25;

INSERT INTO public.inventory (item_id, available_quantity)
SELECT id, 100 FROM public.items WHERE sku = 'COTTON-ROPE'
ON CONFLICT (item_id) DO UPDATE SET available_quantity = 100;

INSERT INTO public.inventory (item_id, available_quantity)
SELECT id, 50 FROM public.items WHERE sku = 'LINEN-CLOTH'
ON CONFLICT (item_id) DO UPDATE SET available_quantity = 50;
```

### UI: Assign to Managers
1. Login as Admin
2. Go to `/admin`
3. For "Khadi Saree" → Assign to Manager 1
4. For "Cotton Rope" → Assign to Manager 2
5. For "Linen Cloth" → Assign to Manager 1

## Updating Stock Levels

As an Admin (via SQL):
```sql
UPDATE public.inventory SET available_quantity = 200 
WHERE item_id = (SELECT id FROM public.items WHERE sku = 'COTTON-ROPE');
```

As an Item Manager (via UI):
1. Go to `/manager`
2. In "Assigned inventory" table, find the item
3. Enter quantity change in the input field
4. Enter reason (e.g., "Added new stock", "Damaged units")
5. Click "Adjust"

## FAQ

**Q: How do I delete an item?**
A: Set `active = false` in Supabase:
```sql
UPDATE public.items SET active = false WHERE sku = 'ROPE-001';
```

**Q: How do I change an item's price?**
A: Update in Supabase:
```sql
UPDATE public.items SET unit_price_paise = 45000 WHERE sku = 'CLOTH-001';
```

**Q: Can I have multiple managers on one item?**
A: Yes! Assign as many managers as needed. Each will see the item in their dashboard and can receive packing tasks.

**Q: What if a manager doesn't exist?**
A: Create a user account with role `item_manager` in the Auth/Profiles first.

**Q: Can buyers see the manager info?**
A: No. Buyers only see item name, price, and quantity. Manager details are hidden.

---

## Quick Reference: Database Tables

**items** - Catalog of products
- id, sku, name, description, unit_price_paise, active, created_at

**inventory** - Stock levels per item
- item_id, available_quantity, reserved_quantity, updated_at

**item_manager_assignments** - Which manager handles which item
- item_id, manager_id

**packing_tasks** - Auto-created when order is placed
- id, order_id, order_number, buyer_code, item_name, quantity, status

---

**Status:** ✅ System ready for inventory setup  
**Admin Login:** ✅ Working  
**Next:** Add items via SQL, then assign to managers via UI
