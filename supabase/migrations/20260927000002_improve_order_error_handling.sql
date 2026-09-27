-- Improve error handling and diagnostics for order creation
-- This migration adds better error messages and handles edge cases

-- Create a diagnostic function to check buyer can place orders
create or replace function public.diagnose_buyer_order_issue()
returns table(check_name text, status text, details text)
language plpgsql stable security definer set search_path = public
as $$
declare
  v_user_id uuid;
  v_role app_role;
  v_profile_exists boolean;
begin
  v_user_id := auth.uid();
  
  -- Check 1: Is user logged in?
  return query select 
    'User Authentication'::text,
    case when v_user_id is null then 'FAIL' else 'PASS' end,
    case when v_user_id is null then 'Not logged in' else 'Logged in as ' || v_user_id end;
  
  -- Check 2: Does buyer profile exist?
  select exists(select 1 from public.profiles where id = v_user_id) into v_profile_exists;
  return query select 
    'Buyer Profile Exists'::text,
    case when v_profile_exists then 'PASS' else 'FAIL' end,
    case when v_profile_exists then 'Profile found' else 'Profile missing in profiles table' end;
  
  -- Check 3: Does buyer have correct role?
  if v_profile_exists then
    select role into v_role from public.profiles where id = v_user_id;
    return query select 
      'Buyer Role'::text,
      case when v_role = 'buyer' then 'PASS' else 'FAIL' end,
      'Role is: ' || coalesce(v_role::text, 'NULL');
  else
    return query select 
      'Buyer Role'::text,
      'FAIL'::text,
      'Cannot check - profile does not exist';
  end if;
  
  -- Check 4: Are there any items?
  return query select 
    'Items Available'::text,
    case when exists(select 1 from public.items where active) then 'PASS' else 'FAIL' end,
    'Count: ' || (select count(*) from public.items where active)::text;
  
  -- Check 5: Are there items with stock?
  return query select 
    'Items With Stock'::text,
    case when exists(select 1 from public.inventory where available_quantity > 0) then 'PASS' else 'FAIL' end,
    'Count: ' || (select count(*) from public.inventory where available_quantity > 0)::text;
  
  -- Check 6: Are items assigned to managers?
  return query select 
    'Manager Assignments'::text,
    case when exists(select 1 from public.item_manager_assignments) then 'PASS' else 'FAIL' end,
    'Count: ' || (select count(*) from public.item_manager_assignments)::text;
end;
$$;

-- Grant permission to run diagnostic
grant execute on function public.diagnose_buyer_order_issue() to authenticated;

-- Improved create_order with better error messages
create or replace function public.create_order(p_lines jsonb, p_payment_method public.payment_method)
returns table(order_id uuid, order_number text, total_paise integer)
language plpgsql security definer set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_order_id uuid := gen_random_uuid();
  v_order_number text := 'ORD-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  v_total integer := 0;
  v_line record;
  v_item public.items%rowtype;
  v_inventory public.inventory%rowtype;
  v_assigned_manager uuid;
  v_user_role app_role;
begin
  -- Validate user is logged in
  if auth.uid() is null then
    raise exception 'You must be logged in to place an order';
  end if;
  
  -- Validate user has buyer profile
  select * into v_profile from public.profiles where id = auth.uid();
  if not found then
    raise exception 'Buyer profile does not exist for this user. Please contact support.';
  end if;
  
  -- Validate user has buyer role
  v_user_role := v_profile.role;
  if v_user_role <> 'buyer' then
    raise exception 'Only buyers can place orders. Your role is: %', v_user_role;
  end if;
  
  -- Validate order lines
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Order must contain at least one line item';
  end if;
  
  if exists (select 1 from jsonb_array_elements(p_lines) e where coalesce((e->>'quantity')::integer, 0) <= 0) then
    raise exception 'All quantities must be positive integers';
  end if;
  
  if (select count(*) from jsonb_array_elements(p_lines)) <> (select count(distinct (e->>'item_id')) from jsonb_array_elements(p_lines) e) then
    raise exception 'Duplicate items are not allowed in a single order';
  end if;
  
  -- Process each item
  for v_line in select (e->>'item_id')::uuid as item_id, (e->>'quantity')::integer as quantity from jsonb_array_elements(p_lines) e order by (e->>'item_id') loop
    -- Get item details
    select * into v_item from public.items where id = v_line.item_id and active for share;
    if not found then 
      raise exception 'Item % is unavailable or has been deactivated', v_line.item_id;
    end if;
    
    -- Get inventory and check stock
    select * into v_inventory from public.inventory where item_id = v_line.item_id for update;
    if not found then
      raise exception 'No inventory record found for item %s', v_item.sku;
    end if;
    
    if v_inventory.available_quantity < v_line.quantity then
      raise exception 'Insufficient stock for item %s. Available: %, Requested: %', 
        v_item.sku, v_inventory.available_quantity, v_line.quantity;
    end if;
    
    -- Reserve inventory
    update public.inventory 
    set available_quantity = available_quantity - v_line.quantity,
        reserved_quantity = reserved_quantity + v_line.quantity, 
        updated_at = now() 
    where item_id = v_line.item_id;
    
    v_total := v_total + v_item.unit_price_paise * v_line.quantity;
  end loop;

  -- Create order record
  insert into public.orders (id, order_number, buyer_id, buyer_code, status, payment_method, total_paise)
  values (v_order_id, v_order_number, auth.uid(), v_profile.buyer_code,
    (case when p_payment_method = 'pay_later' then 'confirmed' else 'payment_pending' end)::public.order_status, 
    p_payment_method, v_total);
  
  -- Create order items and packing tasks
  for v_line in select (e->>'item_id')::uuid as item_id, (e->>'quantity')::integer as quantity from jsonb_array_elements(p_lines) e loop
    select * into v_item from public.items where id = v_line.item_id;
    
    -- Add order item
    insert into public.order_items (order_id, item_id, sku, item_name, quantity, unit_price_paise)
    values (v_order_id, v_item.id, v_item.sku, v_item.name, v_line.quantity, v_item.unit_price_paise);
    
    -- Create packing task for pay_later orders
    if p_payment_method = 'pay_later' then
      -- Find assigned manager for this item
      select profile_id into v_assigned_manager from public.item_manager_assignments 
      where item_id = v_item.id limit 1;
      
      insert into public.packing_tasks (order_id, order_number, buyer_code, item_id, item_name, quantity, assigned_manager_id)
      values (v_order_id, v_order_number, v_profile.buyer_code, v_item.id, v_item.name, v_line.quantity, v_assigned_manager);
    end if;
  end loop;
  
  -- Create payment record
  insert into public.payments (order_id, provider, status, amount_paise)
  values (v_order_id, 
    case when p_payment_method = 'razorpay' then 'razorpay' else 'pay_later' end,
    (case when p_payment_method = 'pay_later' then 'not_required' else 'pending' end)::public.payment_status, 
    v_total);
  
  -- Audit log
  insert into public.audit_events (actor_id, entity_type, entity_id, action, payload)
  values (auth.uid(), 'order', v_order_id, 'created', 
    jsonb_build_object('payment_method', p_payment_method, 'total_paise', v_total));
  
  -- Return success
  return query select v_order_id, v_order_number, v_total;
end;
$$;

revoke all on function public.create_order(jsonb, public.payment_method) from public;
grant execute on function public.create_order(jsonb, public.payment_method) to authenticated;
