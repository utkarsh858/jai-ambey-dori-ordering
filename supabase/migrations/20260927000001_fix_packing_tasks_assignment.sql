-- Fix packing tasks assignment issue
-- Problem: packing_tasks.assigned_manager_id is being inserted as NULL but apparently has a NOT NULL constraint
-- Solution: Update create_order() to find an assigned manager for each item

-- First, ensure assigned_manager_id is nullable (in case it somehow has NOT NULL)
alter table public.packing_tasks 
  alter column assigned_manager_id drop not null;

-- Update create_order function to assign a manager when creating packing tasks
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
begin
  if auth.uid() is null or public.current_role() <> 'buyer' then
    raise exception 'Only buyers can place orders';
  end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Order must contain at least one line';
  end if;
  if exists (select 1 from jsonb_array_elements(p_lines) e where coalesce((e->>'quantity')::integer, 0) <= 0) then
    raise exception 'Quantities must be positive';
  end if;
  if (select count(*) from jsonb_array_elements(p_lines)) <> (select count(distinct (e->>'item_id')) from jsonb_array_elements(p_lines) e) then
    raise exception 'Duplicate items are not allowed';
  end if;

  select * into v_profile from public.profiles where id = auth.uid();
  for v_line in select (e->>'item_id')::uuid as item_id, (e->>'quantity')::integer as quantity from jsonb_array_elements(p_lines) e order by (e->>'item_id') loop
    select * into v_item from public.items where id = v_line.item_id and active for share;
    if not found then raise exception 'Item is unavailable'; end if;
    select * into v_inventory from public.inventory where item_id = v_line.item_id for update;
    if not found or v_inventory.available_quantity < v_line.quantity then raise exception 'Insufficient stock for %', v_item.sku; end if;
    update public.inventory set available_quantity = available_quantity - v_line.quantity,
      reserved_quantity = reserved_quantity + v_line.quantity, updated_at = now() where item_id = v_line.item_id;
    v_total := v_total + v_item.unit_price_paise * v_line.quantity;
  end loop;

  insert into public.orders (id, order_number, buyer_id, buyer_code, status, payment_method, total_paise)
  values (v_order_id, v_order_number, auth.uid(), v_profile.buyer_code,
    (case when p_payment_method = 'pay_later' then 'confirmed' else 'payment_pending' end)::public.order_status, p_payment_method, v_total);
  for v_line in select (e->>'item_id')::uuid as item_id, (e->>'quantity')::integer as quantity from jsonb_array_elements(p_lines) e loop
    select * into v_item from public.items where id = v_line.item_id;
    insert into public.order_items (order_id, item_id, sku, item_name, quantity, unit_price_paise)
    values (v_order_id, v_item.id, v_item.sku, v_item.name, v_line.quantity, v_item.unit_price_paise);
    if p_payment_method = 'pay_later' then
      -- Find an assigned manager for this item
      select profile_id into v_assigned_manager from public.item_manager_assignments 
        where item_id = v_item.id limit 1;
      
      insert into public.packing_tasks (order_id, order_number, buyer_code, item_id, item_name, quantity, assigned_manager_id)
      values (v_order_id, v_order_number, v_profile.buyer_code, v_item.id, v_item.name, v_line.quantity, v_assigned_manager);
    end if;
  end loop;
  insert into public.payments (order_id, provider, status, amount_paise)
  values (v_order_id, case when p_payment_method = 'razorpay' then 'razorpay' else 'pay_later' end,
    (case when p_payment_method = 'pay_later' then 'not_required' else 'pending' end)::public.payment_status, v_total);
  insert into public.audit_events (actor_id, entity_type, entity_id, action, payload)
  values (auth.uid(), 'order', v_order_id, 'created', jsonb_build_object('payment_method', p_payment_method, 'total_paise', v_total));
  return query select v_order_id, v_order_number, v_total;
end;
$$;

revoke all on function public.create_order(jsonb, public.payment_method) from public;
grant execute on function public.create_order(jsonb, public.payment_method) to authenticated;
