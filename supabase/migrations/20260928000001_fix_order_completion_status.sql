-- Add 'completed' status to order_status enum
-- Since PostgreSQL doesn't allow direct deletion of enum values, we need to:
-- 1. Add the new value (if not exists)
-- 2. Update the function to use the correct status

-- Add 'completed' to order_status enum
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

-- Create RLS policy if not exists for viewing order completion ability
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Policy for admins to see all orders
CREATE POLICY "Admins can view all orders" ON orders
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );
