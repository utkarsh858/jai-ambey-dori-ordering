-- Manager access remains limited to assigned item inventory and operational packing tasks.
-- No manager policy is added for profiles, orders, order_items, payments, or audit_events.

create table if not exists public.item_manager_assignments (
  item_id uuid not null references public.items(id) on delete cascade,
  manager_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (item_id, manager_id)
);

create index if not exists item_manager_assignments_manager_id_idx
  on public.item_manager_assignments (manager_id);

create or replace function public.validate_item_manager_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.profiles
    where id = new.manager_id and role = 'item_manager'
  ) then
    raise exception 'Assignments require an item manager';
  end if;
  return new;
end;
$$;

drop trigger if exists validate_item_manager_assignment on public.item_manager_assignments;
create trigger validate_item_manager_assignment
before insert or update of manager_id on public.item_manager_assignments
for each row execute function public.validate_item_manager_assignment();

alter table public.item_manager_assignments enable row level security;

drop policy if exists "admins manage item manager assignments" on public.item_manager_assignments;
create policy "admins manage item manager assignments"
on public.item_manager_assignments
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "managers read their item assignments" on public.item_manager_assignments;
create policy "managers read their item assignments"
on public.item_manager_assignments
for select
using (manager_id = auth.uid());

drop policy if exists "catalog is readable" on public.items;
create policy "catalog is readable"
on public.items
for select
using (
  active
  or public.is_admin()
  or exists (
    select 1
    from public.item_manager_assignments assignment
    where assignment.item_id = items.id
      and assignment.manager_id = auth.uid()
  )
);

drop policy if exists "managers read assigned inventory" on public.inventory;
create policy "managers read assigned inventory"
on public.inventory
for select
using (
  exists (
    select 1
    from public.item_manager_assignments assignment
    where assignment.item_id = inventory.item_id
      and assignment.manager_id = auth.uid()
  )
);

-- The old task rows were deliberately unassigned. Recreate outstanding work only as
-- assignments exist, rather than leaving any manager-visible unassigned work.
delete from public.packing_tasks where assigned_manager_id is null;
alter table public.packing_tasks alter column assigned_manager_id set not null;
create unique index if not exists packing_tasks_order_item_manager_key
  on public.packing_tasks (order_id, item_id, assigned_manager_id);

alter table public.packing_tasks add column if not exists buyer_code text;
update public.packing_tasks task
set buyer_code = factory_order.buyer_code
from public.orders factory_order
where factory_order.id = task.order_id
  and task.buyer_code is null;
alter table public.packing_tasks alter column buyer_code set not null;

create or replace function public.create_assigned_packing_tasks(p_order_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.packing_tasks (
    order_id,
    order_number,
    buyer_code,
    item_id,
    item_name,
    quantity,
    assigned_manager_id,
    status
  )
  select
    order_line.order_id,
    factory_order.order_number,
    factory_order.buyer_code,
    order_line.item_id,
    order_line.item_name,
    order_line.quantity,
    assignment.manager_id,
    'assigned'::public.task_status
  from public.order_items order_line
  join public.orders factory_order on factory_order.id = order_line.order_id
  join public.item_manager_assignments assignment on assignment.item_id = order_line.item_id
  where order_line.order_id = p_order_id
    and factory_order.status = 'confirmed'
  on conflict (order_id, item_id, assigned_manager_id) do nothing;
end;
$$;

create or replace function public.create_packing_tasks_for_new_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.packing_tasks (
    order_id,
    order_number,
    buyer_code,
    item_id,
    item_name,
    quantity,
    assigned_manager_id,
    status
  )
  select
    order_line.order_id,
    factory_order.order_number,
    factory_order.buyer_code,
    order_line.item_id,
    order_line.item_name,
    order_line.quantity,
    new.manager_id,
    'assigned'::public.task_status
  from public.order_items order_line
  join public.orders factory_order on factory_order.id = order_line.order_id
  where order_line.item_id = new.item_id
    and factory_order.status = 'confirmed'
  on conflict (order_id, item_id, assigned_manager_id) do nothing;
  return new;
end;
$$;

drop trigger if exists create_packing_tasks_for_new_assignment on public.item_manager_assignments;
create trigger create_packing_tasks_for_new_assignment
after insert on public.item_manager_assignments
for each row execute function public.create_packing_tasks_for_new_assignment();

create or replace function public.create_order(p_lines jsonb, p_payment_method public.payment_method)
returns table(order_id uuid, order_number text, total_paise integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_order_id uuid := gen_random_uuid();
  v_order_number text := 'ORD-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  v_total integer := 0;
  v_line record;
  v_item public.items%rowtype;
  v_inventory public.inventory%rowtype;
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
    case when p_payment_method = 'pay_later' then 'confirmed' else 'payment_pending' end, p_payment_method, v_total);
  for v_line in select (e->>'item_id')::uuid as item_id, (e->>'quantity')::integer as quantity from jsonb_array_elements(p_lines) e loop
    select * into v_item from public.items where id = v_line.item_id;
    insert into public.order_items (order_id, item_id, sku, item_name, quantity, unit_price_paise)
    values (v_order_id, v_item.id, v_item.sku, v_item.name, v_line.quantity, v_item.unit_price_paise);
  end loop;
  if p_payment_method = 'pay_later' then
    perform public.create_assigned_packing_tasks(v_order_id);
  end if;
  insert into public.payments (order_id, provider, status, amount_paise)
  values (v_order_id, case when p_payment_method = 'razorpay' then 'razorpay' else 'pay_later' end,
    case when p_payment_method = 'pay_later' then 'not_required' else 'pending' end, v_total);
  insert into public.audit_events (actor_id, entity_type, entity_id, action, payload)
  values (auth.uid(), 'order', v_order_id, 'created', jsonb_build_object('payment_method', p_payment_method, 'total_paise', v_total));
  return query select v_order_id, v_order_number, v_total;
end;
$$;

create or replace function public.confirm_razorpay_payment(p_provider_order_id text, p_provider_payment_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment public.payments%rowtype;
  v_order public.orders%rowtype;
begin
  select * into v_payment from public.payments where provider_order_id = p_provider_order_id for update;
  if not found then raise exception 'Payment not found'; end if;
  if v_payment.status = 'paid' then return; end if;
  select * into v_order from public.orders where id = v_payment.order_id for update;
  if v_order.status <> 'payment_pending' then raise exception 'Order cannot be paid'; end if;
  update public.payments set status = 'paid', provider_payment_id = p_provider_payment_id, updated_at = now() where id = v_payment.id;
  update public.orders set status = 'confirmed', updated_at = now() where id = v_order.id;
  perform public.create_assigned_packing_tasks(v_order.id);
  insert into public.audit_events (entity_type, entity_id, action, payload)
  values ('order', v_order.id, 'payment_confirmed', jsonb_build_object('provider_payment_id', p_provider_payment_id));
end;
$$;

create or replace function public.adjust_assigned_inventory(
  p_item_id uuid,
  p_quantity_delta integer,
  p_reason text
)
returns table(available_quantity integer, reserved_quantity integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inventory public.inventory%rowtype;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if auth.uid() is null or public.current_role() <> 'item_manager' then
    raise exception 'Only item managers can adjust assigned inventory';
  end if;
  if p_quantity_delta = 0 then
    raise exception 'Stock adjustment must not be zero';
  end if;
  if length(v_reason) < 3 or length(v_reason) > 500 then
    raise exception 'Adjustment reason must be between 3 and 500 characters';
  end if;
  if not exists (
    select 1
    from public.item_manager_assignments assignment
    where assignment.item_id = p_item_id
      and assignment.manager_id = auth.uid()
  ) then
    raise exception 'Item is not assigned to this manager';
  end if;

  select * into v_inventory from public.inventory where item_id = p_item_id for update;
  if not found then
    raise exception 'Inventory record not found';
  end if;
  if v_inventory.available_quantity + p_quantity_delta < 0 then
    raise exception 'Adjustment would make available stock negative';
  end if;

  update public.inventory
  set available_quantity = available_quantity + p_quantity_delta,
      updated_at = now()
  where item_id = p_item_id
  returning * into v_inventory;

  insert into public.audit_events (actor_id, entity_type, entity_id, action, payload)
  values (
    auth.uid(),
    'inventory',
    p_item_id,
    'manager_stock_adjusted',
    jsonb_build_object(
      'quantity_delta', p_quantity_delta,
      'previous_available_quantity', v_inventory.available_quantity - p_quantity_delta,
      'available_quantity', v_inventory.available_quantity,
      'reason', v_reason
    )
  );

  return query select v_inventory.available_quantity, v_inventory.reserved_quantity;
end;
$$;

revoke all on function public.create_assigned_packing_tasks(uuid) from public;
revoke all on function public.adjust_assigned_inventory(uuid, integer, text) from public;
grant execute on function public.adjust_assigned_inventory(uuid, integer, text) to authenticated;
