-- Fix: Improve order status casting in create_order function
-- Issue: Type mismatch when inserting order status enum

CREATE OR REPLACE FUNCTION public.create_order(p_lines jsonb, p_payment_method public.payment_method)
RETURNS TABLE(order_id uuid, order_number text, total_paise integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile public.profiles%rowtype;
  v_order_id uuid := gen_random_uuid();
  v_order_number text := 'ORD-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  v_total integer := 0;
  v_line record;
  v_item public.items%rowtype;
  v_inventory public.inventory%rowtype;
  v_initial_status public.order_status;
BEGIN
  IF auth.uid() IS NULL OR public.current_role() <> 'buyer' THEN
    RAISE EXCEPTION 'Only buyers can place orders';
  END IF;
  
  IF jsonb_typeof(p_lines) <> 'array' OR jsonb_array_length(p_lines) = 0 THEN
    RAISE EXCEPTION 'Order must contain at least one line';
  END IF;
  
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(p_lines) e WHERE COALESCE((e->>'quantity')::integer, 0) <= 0) THEN
    RAISE EXCEPTION 'Quantities must be positive';
  END IF;
  
  IF (SELECT COUNT(*) FROM jsonb_array_elements(p_lines)) <> (SELECT COUNT(DISTINCT (e->>'item_id')) FROM jsonb_array_elements(p_lines) e) THEN
    RAISE EXCEPTION 'Duplicate items are not allowed';
  END IF;

  SELECT * INTO v_profile FROM public.profiles WHERE id = auth.uid();
  
  FOR v_line IN SELECT (e->>'item_id')::uuid as item_id, (e->>'quantity')::integer as quantity FROM jsonb_array_elements(p_lines) e ORDER BY (e->>'item_id') LOOP
    SELECT * INTO v_item FROM public.items WHERE id = v_line.item_id AND active FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Item is unavailable'; END IF;
    
    SELECT * INTO v_inventory FROM public.inventory WHERE item_id = v_line.item_id FOR UPDATE;
    IF NOT FOUND OR v_inventory.available_quantity < v_line.quantity THEN 
      RAISE EXCEPTION 'Insufficient stock for %', v_item.sku; 
    END IF;
    
    UPDATE public.inventory SET available_quantity = available_quantity - v_line.quantity,
      reserved_quantity = reserved_quantity + v_line.quantity, updated_at = now() 
      WHERE item_id = v_line.item_id;
    
    v_total := v_total + v_item.unit_price_paise * v_line.quantity;
  END LOOP;

  -- Determine initial status based on payment method
  IF p_payment_method = 'pay_later' THEN
    v_initial_status := 'confirmed'::public.order_status;
  ELSE
    v_initial_status := 'payment_pending'::public.order_status;
  END IF;

  INSERT INTO public.orders (id, order_number, buyer_id, buyer_code, status, payment_method, total_paise)
  VALUES (v_order_id, v_order_number, auth.uid(), v_profile.buyer_code, v_initial_status, p_payment_method, v_total);
  
  FOR v_line IN SELECT (e->>'item_id')::uuid as item_id, (e->>'quantity')::integer as quantity FROM jsonb_array_elements(p_lines) e LOOP
    SELECT * INTO v_item FROM public.items WHERE id = v_line.item_id;
    
    INSERT INTO public.order_items (order_id, item_id, sku, item_name, quantity, unit_price_paise)
    VALUES (v_order_id, v_item.id, v_item.sku, v_item.name, v_line.quantity, v_item.unit_price_paise);
    
    IF p_payment_method = 'pay_later' THEN
      INSERT INTO public.packing_tasks (order_id, order_number, buyer_code, item_id, item_name, quantity)
      VALUES (v_order_id, v_order_number, v_profile.buyer_code, v_item.id, v_item.name, v_line.quantity);
    END IF;
  END LOOP;
  
  INSERT INTO public.payments (order_id, provider, status, amount_paise)
  VALUES (v_order_id, CASE WHEN p_payment_method = 'razorpay' THEN 'razorpay' ELSE 'pay_later' END,
    CASE WHEN p_payment_method = 'pay_later' THEN 'not_required'::public.payment_status ELSE 'pending'::public.payment_status END, v_total);
  
  INSERT INTO public.audit_events (actor_id, entity_type, entity_id, action, payload)
  VALUES (auth.uid(), 'order', v_order_id, 'created', jsonb_build_object('payment_method', p_payment_method, 'total_paise', v_total));
  
  RETURN QUERY SELECT v_order_id, v_order_number, v_total;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_order(jsonb, public.payment_method) TO authenticated;
