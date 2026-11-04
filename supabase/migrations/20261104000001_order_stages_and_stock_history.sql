-- ===== Order stages =====
alter table public.orders add column if not exists stage text not null default 'placed';
alter table public.orders drop constraint if exists orders_stage_check;
alter table public.orders add constraint orders_stage_check
  check (stage in ('placed', 'approved', 'packed_ready', 'dispatch_approved'));
alter table public.packing_tasks add column if not exists order_stage text not null default 'placed';

update public.orders set stage = 'dispatch_approved' where status::text in ('completed', 'fulfilled');
update public.packing_tasks pt set order_stage = o.stage from public.orders o where o.id = pt.order_id;

create or replace function public.sync_task_order_stage()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  update public.packing_tasks pt set order_stage = new.stage where pt.order_id = new.id;
  return new;
end;
$$;
drop trigger if exists sync_task_order_stage_trigger on public.orders;
create trigger sync_task_order_stage_trigger
  after update of stage on public.orders
  for each row when (old.stage is distinct from new.stage)
  execute function public.sync_task_order_stage();

create or replace function public.refresh_order_packed_stage(p_order_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if exists (select 1 from public.orders o where o.id = p_order_id and o.stage = 'approved'
               and o.status::text not in ('cancelled', 'completed', 'fulfilled'))
     and exists (select 1 from public.packing_tasks pt where pt.order_id = p_order_id and pt.status::text <> 'cancelled')
     and not exists (select 1 from public.packing_tasks pt where pt.order_id = p_order_id and pt.status::text in ('queued', 'assigned'))
  then
    update public.orders o set stage = 'packed_ready', updated_at = now() where o.id = p_order_id;
  end if;
end;
$$;

create or replace function public.packing_task_packed_trigger()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  perform public.refresh_order_packed_stage(new.order_id);
  return new;
end;
$$;
drop trigger if exists packing_task_packed on public.packing_tasks;
create trigger packing_task_packed
  after update of status on public.packing_tasks
  for each row when (new.status::text = 'packed' and old.status::text is distinct from 'packed')
  execute function public.packing_task_packed_trigger();

create or replace function public.approve_order(p_order_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare v_order public.orders%rowtype;
begin
  if auth.uid() is null or public.current_role() <> 'admin' then
    raise exception 'Only admins can approve orders';
  end if;
  select * into v_order from public.orders o where o.id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.status::text in ('cancelled', 'completed', 'fulfilled') then
    raise exception 'Order is % and cannot be approved', v_order.status::text;
  end if;
  if v_order.stage <> 'placed' then raise exception 'Order is already approved'; end if;
  update public.orders o set stage = 'approved', updated_at = now() where o.id = p_order_id;
  insert into public.audit_events (actor_id, entity_type, entity_id, action, payload)
    values (auth.uid(), 'order', p_order_id, 'approved', '{}'::jsonb);
  perform public.refresh_order_packed_stage(p_order_id);
end;
$$;

create or replace function public.approve_order_dispatch(p_order_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare v_order public.orders%rowtype;
begin
  if auth.uid() is null or public.current_role() <> 'admin' then
    raise exception 'Only admins can approve dispatch';
  end if;
  select * into v_order from public.orders o where o.id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.status::text in ('cancelled', 'completed', 'fulfilled') then
    raise exception 'Order is % and cannot be dispatched', v_order.status::text;
  end if;
  if v_order.stage <> 'packed_ready' then
    raise exception 'All items must be packed before approving dispatch';
  end if;
  update public.orders o set stage = 'dispatch_approved', updated_at = now() where o.id = p_order_id;
  insert into public.audit_events (actor_id, entity_type, entity_id, action, payload)
    values (auth.uid(), 'order', p_order_id, 'dispatch_approved', '{}'::jsonb);
end;
$$;

create or replace function public.mark_task_packed(p_task_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare v_task public.packing_tasks%rowtype;
begin
  if auth.uid() is null or public.current_role() <> 'item_manager' then
    raise exception 'Only item managers can mark items packed';
  end if;
  select * into v_task from public.packing_tasks pt where pt.id = p_task_id for update;
  if not found
     or not (v_task.assigned_manager_id = auth.uid()
             or exists (select 1 from public.item_manager_assignments ima
                        where ima.item_id = v_task.item_id and ima.manager_id = auth.uid())) then
    raise exception 'Task not found or not assigned to you';
  end if;
  if v_task.status::text not in ('queued', 'assigned') then
    raise exception 'Task is no longer open';
  end if;
  if v_task.order_stage <> 'approved' then
    raise exception 'This order has not been approved by admin yet';
  end if;
  update public.packing_tasks pt
    set status = 'packed'::public.task_status, packed_at = now(),
        assigned_manager_id = coalesce(pt.assigned_manager_id, auth.uid())
    where pt.id = p_task_id;
end;
$$;

create or replace function public.get_order_item_stages(p_order_ids uuid[])
returns table(order_id uuid, item_id uuid, is_packed boolean)
language sql stable security definer set search_path = public
as $$
  select pt.order_id, pt.item_id,
         bool_and(pt.packed_at is not null or pt.status::text = 'packed') as is_packed
  from public.packing_tasks pt
  where pt.order_id = any(p_order_ids)
    and pt.status::text <> 'cancelled'
    and exists (select 1 from public.orders o
                where o.id = pt.order_id and (o.buyer_id = auth.uid() or public.is_admin()))
  group by pt.order_id, pt.item_id;
$$;

revoke all on function public.approve_order(uuid) from public;
revoke all on function public.approve_order_dispatch(uuid) from public;
revoke all on function public.mark_task_packed(uuid) from public;
revoke all on function public.get_order_item_stages(uuid[]) from public;
grant execute on function public.approve_order(uuid) to authenticated;
grant execute on function public.approve_order_dispatch(uuid) to authenticated;
grant execute on function public.mark_task_packed(uuid) to authenticated;
grant execute on function public.get_order_item_stages(uuid[]) to authenticated;

-- ===== Stock edit history =====
create table if not exists public.inventory_adjustments (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  changed_by uuid references public.profiles(id),
  changed_by_role text not null,
  previous_quantity integer not null,
  new_quantity integer not null,
  delta integer not null,
  reason text not null,
  created_at timestamptz not null default now()
);
create index if not exists inventory_adjustments_item_idx on public.inventory_adjustments (item_id, created_at desc);
alter table public.inventory_adjustments enable row level security;
drop policy if exists "admins read stock history" on public.inventory_adjustments;
create policy "admins read stock history" on public.inventory_adjustments
  for select using (public.is_admin());
grant select on public.inventory_adjustments to authenticated;

create or replace function public.set_inventory_quantity(p_item_id uuid, p_new_quantity integer, p_reason text)
returns void language plpgsql security definer set search_path = public
as $$
declare
  v_reason text := btrim(coalesce(p_reason, ''));
  v_prev integer;
begin
  if auth.uid() is null or public.current_role() <> 'admin' then
    raise exception 'Only admins can set stock';
  end if;
  if p_new_quantity is null or p_new_quantity < 0 then raise exception 'Quantity must be zero or more'; end if;
  if length(v_reason) < 3 or length(v_reason) > 500 then
    raise exception 'A reason of 3 to 500 characters is required';
  end if;
  select inv.available_quantity into v_prev from public.inventory inv where inv.item_id = p_item_id for update;
  if not found then
    insert into public.inventory (item_id, available_quantity) values (p_item_id, p_new_quantity);
    v_prev := 0;
  else
    update public.inventory inv set available_quantity = p_new_quantity, updated_at = now() where inv.item_id = p_item_id;
  end if;
  insert into public.inventory_adjustments (item_id, changed_by, changed_by_role, previous_quantity, new_quantity, delta, reason)
    values (p_item_id, auth.uid(), 'admin', v_prev, p_new_quantity, p_new_quantity - v_prev, v_reason);
end;
$$;
revoke all on function public.set_inventory_quantity(uuid, integer, text) from public;
grant execute on function public.set_inventory_quantity(uuid, integer, text) to authenticated;

create or replace function public.adjust_assigned_inventory(p_item_id uuid, p_quantity_delta integer, p_reason text)
returns table(available_quantity integer, reserved_quantity integer)
language plpgsql security definer set search_path = public
as $$
declare
  v_inventory public.inventory%rowtype;
  v_reason text := btrim(coalesce(p_reason, ''));
begin
  if auth.uid() is null or public.current_role() <> 'item_manager' then
    raise exception 'Only item managers can adjust assigned inventory';
  end if;
  if p_quantity_delta = 0 then raise exception 'Stock adjustment must not be zero'; end if;
  if length(v_reason) < 3 or length(v_reason) > 500 then
    raise exception 'Adjustment reason must be between 3 and 500 characters';
  end if;
  if not exists (select 1 from public.item_manager_assignments ima
                 where ima.item_id = p_item_id and ima.manager_id = auth.uid()) then
    raise exception 'Item is not assigned to this manager';
  end if;
  select * into v_inventory from public.inventory inv where inv.item_id = p_item_id for update;
  if not found then raise exception 'Inventory record not found'; end if;
  if v_inventory.available_quantity + p_quantity_delta < 0 then
    raise exception 'Adjustment would make available stock negative';
  end if;
  update public.inventory inv
    set available_quantity = inv.available_quantity + p_quantity_delta, updated_at = now()
    where inv.item_id = p_item_id
    returning * into v_inventory;
  insert into public.inventory_adjustments (item_id, changed_by, changed_by_role, previous_quantity, new_quantity, delta, reason)
    values (p_item_id, auth.uid(), 'item_manager', v_inventory.available_quantity - p_quantity_delta,
            v_inventory.available_quantity, p_quantity_delta, v_reason);
  insert into public.audit_events (actor_id, entity_type, entity_id, action, payload)
    values (auth.uid(), 'inventory', p_item_id, 'manager_stock_adjusted',
      jsonb_build_object('quantity_delta', p_quantity_delta, 'available_quantity', v_inventory.available_quantity, 'reason', v_reason));
  return query select v_inventory.available_quantity, v_inventory.reserved_quantity;
end;
$$;
revoke all on function public.adjust_assigned_inventory(uuid, integer, text) from public;
grant execute on function public.adjust_assigned_inventory(uuid, integer, text) to authenticated;
