-- FINAL VALIDATION SCRIPT
-- Run this in Supabase SQL Editor AFTER applying all 3 migrations
-- This script verifies the fix is complete and working

-- =============================================================================
-- PART 1: Verify all migrations are applied
-- =============================================================================

-- 1A: Check if Migration 1 (Enum Casting) is applied
SELECT 
  'Migration 1: Enum Casting' as check,
  CASE 
    WHEN pg_get_functiondef(p.oid)::text LIKE '%::public.order_status%' THEN 'PASS ✅'
    ELSE 'FAIL ❌'
  END as status,
  'Should contain ::public.order_status cast' as detail
FROM pg_proc p 
WHERE p.proname = 'create_order' 
AND p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- 1B: Check if Migration 2 (Manager Assignment) is applied  
SELECT 
  'Migration 2: Manager Assignment' as check,
  CASE 
    WHEN pg_get_functiondef(p.oid)::text LIKE '%item_manager_assignments%' THEN 'PASS ✅'
    ELSE 'FAIL ❌'
  END as status,
  'Should contain item_manager_assignments lookup' as detail
FROM pg_proc p 
WHERE p.proname = 'create_order' 
AND p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- 1C: Check if Migration 3 (Diagnostics) is applied
SELECT 
  'Migration 3: Diagnostics' as check,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_proc p 
      WHERE p.proname = 'diagnose_buyer_order_issue'
      AND p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    ) THEN 'PASS ✅'
    ELSE 'FAIL ❌'
  END as status,
  'Should have diagnose_buyer_order_issue() function' as detail;

-- =============================================================================
-- PART 2: Test the diagnostic function (requires buyer to be logged in)
-- =============================================================================

-- This will show if all prerequisites for order creation are met
-- If any FAIL ❌, fix that issue before testing orders
SELECT * FROM public.diagnose_buyer_order_issue();

-- =============================================================================
-- PART 3: Check database prerequisites
-- =============================================================================

-- 3A: Verify packing_tasks table allows NULL assigned_manager_id
SELECT 
  'Table: packing_tasks' as object,
  col_description((SELECT oid FROM pg_class WHERE relname='packing_tasks'), 
    (SELECT attnum FROM pg_attribute WHERE attrelname='packing_tasks' AND attname='assigned_manager_id')) as column_info,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'packing_tasks' 
      AND column_name = 'assigned_manager_id'
      AND is_nullable = 'YES'
    ) THEN 'Column allows NULL ✅'
    ELSE 'Column is NOT NULL ❌'
  END as status;

-- 3B: Verify item_manager_assignments table exists and has data
SELECT 
  COUNT(*) as assignment_count,
  CASE 
    WHEN COUNT(*) > 0 THEN 'Has assignments ✅'
    ELSE 'No assignments ❌ - Admin must assign managers to items'
  END as status
FROM public.item_manager_assignments;

-- =============================================================================
-- PART 4: Verify function definitions contain critical code
-- =============================================================================

-- Show the exact lines we're looking for in create_order
SELECT 
  'Critical Code Check' as check_type,
  CASE 
    WHEN pg_get_functiondef(p.oid)::text LIKE '%v_assigned_manager%' 
     AND pg_get_functiondef(p.oid)::text LIKE '%assigned_manager_id%' THEN 'PASS ✅'
    ELSE 'FAIL ❌'
  END as status,
  'Should have v_assigned_manager variable assignment' as detail
FROM pg_proc p 
WHERE p.proname = 'create_order' 
AND p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');

-- =============================================================================
-- PART 5: Show current create_order function definition
-- =============================================================================

-- This shows the complete function so you can verify it contains all fixes
SELECT pg_get_functiondef(p.oid)::text as create_order_function_code
FROM pg_proc p 
WHERE p.proname = 'create_order' 
AND p.pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
LIMIT 1;

-- =============================================================================
-- EXPECTED RESULTS
-- =============================================================================
-- 
-- If all checks PASS ✅:
-- 1. All 3 migrations applied successfully
-- 2. Diagnostic function exists and works
-- 3. Database structure supports manager assignment
-- 4. Manager assignments exist in the system
-- 5. Critical code is present
--
-- Then you can test buyer order creation
--
-- If any FAIL ❌:
-- 1. Check which migration failed
-- 2. Re-apply that migration in Supabase SQL Editor
-- 3. Run this validation script again
-- 4. For diagnostic failures: Check prerequisites (items, stock, managers)
--
-- =============================================================================
