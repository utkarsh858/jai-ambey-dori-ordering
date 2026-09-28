-- Issue 4 Fix: Update packing tasks when order status changes to completed
-- Add trigger to sync packing_tasks status with order status

-- Add 'completed' to task_status enum if not exists
ALTER TYPE public.task_status ADD VALUE IF NOT EXISTS 'completed';

-- Create function to update packing tasks when order is completed
CREATE OR REPLACE FUNCTION public.sync_packing_tasks_on_order_completion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When order status changes to 'completed', mark all packing tasks as completed
  IF NEW.status::text = 'completed' AND OLD.status::text != 'completed' THEN
    UPDATE public.packing_tasks
    SET status = 'completed'::public.task_status
    WHERE order_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS sync_packing_tasks_on_order_completion_trigger ON public.orders;

-- Create trigger
CREATE TRIGGER sync_packing_tasks_on_order_completion_trigger
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_packing_tasks_on_order_completion();

-- Grant function execution
GRANT EXECUTE ON FUNCTION public.sync_packing_tasks_on_order_completion() TO authenticated;
