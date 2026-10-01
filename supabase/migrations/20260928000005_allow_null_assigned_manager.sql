-- Fix: Allow assigned_manager_id to be NULL in packing_tasks
-- Issue: Packing tasks are created without a manager assignment
-- Managers are assigned later, so assigned_manager_id should be nullable

ALTER TABLE public.packing_tasks
ALTER COLUMN assigned_manager_id DROP NOT NULL;
