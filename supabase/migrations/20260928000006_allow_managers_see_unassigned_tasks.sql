-- Fix: Allow managers to see unassigned packing tasks
-- Issue: New orders create packing tasks with assigned_manager_id = NULL
-- Managers couldn't see them because RLS policy filtered by assigned_manager_id = auth.uid()

DROP POLICY IF EXISTS "managers read assigned safe tasks" ON public.packing_tasks;

CREATE POLICY "managers read assigned safe tasks" ON public.packing_tasks 
FOR SELECT USING (
  assigned_manager_id = auth.uid() 
  OR assigned_manager_id IS NULL 
  OR public.is_admin()
);
