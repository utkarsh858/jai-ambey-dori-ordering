# Item and Inventory Management Guide

## Overview
The admin dashboard now has a complete UI for managing items and inventory levels. No SQL knowledge required!

## Features

### 1. Add Items
Create new products (cloth, rope, etc.) with prices and descriptions.

**Location:** Admin Dashboard → "Add new item to catalog"

**What you enter:**
- **SKU** - Unique identifier (e.g., `CLOTH-001`, `ROPE-50M`)
  - Cannot have duplicates
  - Max 100 characters
- **Item Name** - Display name in buyer portal (e.g., "Cotton Cloth 5m")
  - Max 200 characters
- **Description** - Optional details
  - Max 500 characters
- **Price** - In Rupees (e.g., enter 500 for ₹500)
  - Stored internally as paise (500 = 50,000 paise)
  - Min: ₹0

**Workflow:**
1. Click **"Add Item"** button
2. Fill in the form
3. Click **"Add Item"** to save
4. Item is created and automatically added to inventory with 0 stock
5. Form clears for next item

**Example:**
```
SKU:              KHADI-SAREE-01
Item Name:        Khadi Saree Traditional
Description:      Hand-woven traditional khadi saree
Price:            1500 (₹1500)
```

### 2. Manage Inventory Levels
Set and update stock quantities for each item.

**Location:** Admin Dashboard → "Manage inventory levels"

**What you do:**
1. Find the item in the list
2. Click **"Edit"** button
3. Enter new quantity
4. Click **"Save"** to update
5. Or **"Cancel"** to discard changes

**Display shows:**
- Item Name
- SKU
- Current stock quantity (in bold)
- Edit button

**Example:**
```
Item: Cotton Cloth 5m
SKU:  CLOTH-001
Current: 100 units

[Edit button]

(After clicking Edit:)
Input: [     150    ]
[Save] [Cancel]
```

### 3. Assign Items to Managers
Link items to item managers so they receive packing tasks.

**Location:** Admin Dashboard → "Item manager assignments"

**What you do:**
1. For each item, select a manager from dropdown
2. Click **"Assign"** to confirm
3. Manager now appears in the list
4. Click **"Remove"** to unassign

**Display shows:**
- Item name and SKU
- Current assigned managers (with Remove buttons)
- Dropdown to assign new managers
- Assign button

## Complete Workflow Example

### Step 1: Add 3 Items
Click "Add Item" three times:

**Item 1:**
- SKU: SAREE-SILK
- Name: Silk Saree
- Description: Premium silk saree
- Price: 2000

**Item 2:**
- SKU: ROPE-COTTON-50
- Name: Cotton Rope 50m
- Price: 300

**Item 3:**
- SKU: CLOTH-LINEN
- Name: Linen Cloth 5m
- Price: 800

### Step 2: Set Stock Levels
Edit inventory for each:
- SAREE-SILK: 25 units
- ROPE-COTTON-50: 100 units
- CLOTH-LINEN: 50 units

### Step 3: Assign to Managers
For each item, assign one or more managers:
- SAREE-SILK → Manager "Priya"
- ROPE-COTTON-50 → Manager "Rajesh"
- CLOTH-LINEN → Manager "Priya" (can assign to multiple managers)

### Result:
✅ Priya can see SAREE-SILK and CLOTH-LINEN on her manager dashboard
✅ Rajesh can see ROPE-COTTON-50 on his manager dashboard
✅ Buyers see all 3 items available to order
✅ When orders come in, packing tasks go to assigned managers

## Managing Stock Over Time

### Initial Setup
1. Add all items once
2. Set initial stock quantities

### After Items Sell
1. Buyer places order
2. Stock automatically decreases (reserved_quantity increases)
3. Admin can see current inventory on dashboard
4. When packing completes, reserved → fulfilled

### When Adding New Stock
Manager view:
- Go to `/manager`
- In "Assigned inventory" table
- Click "Adjust" for the item
- Enter quantity change (e.g., +50)
- Enter reason (e.g., "New stock received")

Admin view:
- Dashboard → "Manage inventory levels"
- Click "Edit" for item
- Enter total quantity (e.g., 150)
- Click "Save"

## System Behavior

### When Item is Created
- ✅ New item added to `items` table
- ✅ Automatically creates inventory record with 0 stock
- ✅ Shows on admin dashboard
- ✅ Initially NOT visible to buyers (inventory must be > 0 after assignment)

### When Stock is Updated
- ✅ Updates `available_quantity` in inventory table
- ✅ Updates timestamp automatically
- ✅ Buyers see new quantity (if they have access)
- ✅ No older orders affected

### When Manager is Assigned
- ✅ Entry created in `item_manager_assignments` table
- ✅ Manager immediately sees item on their dashboard
- ✅ Manager can adjust stock (if assigned)
- ✅ Packing tasks for this item → this manager

## Limitations & Notes

### Can NOT (currently)
- Edit item name or price after creation (use SQL if needed)
- Bulk import items from CSV
- Set different prices per buyer
- See sales analytics or history
- Export inventory reports

### Will Always Show
- All active items on buyer portal
- Only assigned items on manager dashboard
- Buyers have different codes/privacy from managers

### Concurrent Operations
- Multiple admins can edit inventory at same time
- Last update wins (later edit overwrites earlier)
- Stock numbers show real-time in dashboard

## Troubleshooting

**Q: Added an item but don't see it on buyer portal?**
A: Items are visible to buyers once they have inventory assigned to a manager. Make sure:
1. Item has stock (edit inventory to set quantity > 0)
2. Item is marked active (it is by default)
3. Buyer is logged in

**Q: Can't assign a manager to item?**
A: Check if managers exist. Go to Auth section and create item_manager accounts first.

**Q: Stock shows 0 but I set it to 100?**
A: Clear browser cache and refresh. Stock updates automatically.

**Q: Want to delete an item?**
A: Via SQL: `UPDATE public.items SET active = false WHERE sku = 'ITEM-SKU';`

**Q: Want to change a price?**
A: Via SQL: `UPDATE public.items SET unit_price_paise = 100000 WHERE sku = 'ITEM-SKU';`

## Database Tables

Items created here are stored in:
- `public.items` - Product catalog
- `public.inventory` - Stock levels
- `public.item_manager_assignments` - Manager links

Buyers can only see items where inventory is managed and managers are assigned.

---

**Status:** ✅ Feature complete  
**Admin UI:** ✅ Ready to use  
**No SQL required** for typical operations
