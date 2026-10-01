-- Fix: Restrict managers to see only items they are assigned to
-- Issue: Managers were seeing all items and orders, not just assigned ones

-- Update inventory RLS policy to allow managers to see only their assigned items
DROP POLICY IF EXISTS "stock is admin only" ON public.inventory;

CREATE POLICY "admin can manage all inventory" ON public.inventory
FOR ALL
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE POLICY "managers can read assigned item inventory" ON public.inventory
FOR SELECT
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.item_manager_assignments
    WHERE item_id = inventory.item_id
    AND manager_id = auth.uid()
  )
);

-- Update packing_tasks RLS policy to restrict managers to their assigned items only
DROP POLICY IF EXISTS "managers read assigned safe tasks" ON public.packing_tasks;
DROP POLICY IF EXISTS "managers update their tasks" ON public.packing_tasks;

CREATE POLICY "managers read their assigned tasks" ON public.packing_tasks
FOR SELECT
USING (
  public.is_admin()
  OR (
    -- Manager sees tasks for items they are assigned to
    EXISTS (
      SELECT 1 FROM public.item_manager_assignments ima
      WHERE ima.item_id = packing_tasks.item_id
      AND ima.manager_id = auth.uid()
    )
  )
);

CREATE POLICY "managers update their assigned tasks" ON public.packing_tasks
FOR UPDATE
USING (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.item_manager_assignments ima
    WHERE ima.item_id = packing_tasks.item_id
    AND ima.manager_id = auth.uid()
  )
)
WITH CHECK (
  public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.item_manager_assignments ima
    WHERE ima.item_id = packing_tasks.item_id
    AND ima.manager_id = auth.uid()
  )
);
