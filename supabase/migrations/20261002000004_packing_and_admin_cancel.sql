-- Cancel: allow admin cancel of any non-completed order, cancel all open/packed tasks
create or replace function public.cancel_order(p_order_id uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public
as $$
declare v_order public.orders%rowtype; v_line record;
begin
  select * into v_order from public.orders o where o.id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.buyer_id <> auth.uid() and not public.is_admin() then raise exception 'Not authorized'; end if;
  if v_order.status::text = 'cancelled' then return; end if;
  if v_order.status::text in ('fulfilled', 'completed') then raise exception 'Completed orders cannot be cancelled'; end if;
  for v_line in select oi.item_id, oi.quantity from public.order_items oi where oi.order_id = p_order_id order by oi.item_id loop
    update public.inventory inv set available_quantity = inv.available_quantity + v_line.quantity,
      reserved_quantity = inv.reserved_quantity - v_line.quantity, updated_at = now() where inv.item_id = v_line.item_id;
  end loop;
  update public.orders o set status = 'cancelled'::public.order_status, cancellation_reason = p_reason, cancelled_at = now(), updated_at = now() where o.id = p_order_id;
  update public.packing_tasks pt set status = 'cancelled'::public.task_status where pt.order_id = p_order_id;
  insert into public.audit_events (actor_id, entity_type, entity_id, action, payload)
  values (auth.uid(), 'order', p_order_id, 'cancelled', jsonb_build_object('reason', p_reason));
end;
$$;

-- Manager marks one packing task packed
create or replace function public.mark_task_packed(p_task_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare v_updated integer;
begin
  if auth.uid() is null or public.current_role() <> 'item_manager' then
    raise exception 'Only item managers can mark items packed';
  end if;
  update public.packing_tasks pt
    set status = 'packed'::public.task_status, packed_at = now()
    where pt.id = p_task_id and pt.assigned_manager_id = auth.uid()
      and pt.status::text in ('queued', 'assigned');
  get diagnostics v_updated = row_count;
  if v_updated = 0 then raise exception 'Task not found, not yours, or no longer open'; end if;
end;
$$;

-- Manager marks all of their open tasks in an order packed
create or replace function public.mark_order_packed(p_order_id uuid)
returns integer language plpgsql security definer set search_path = public
as $$
declare v_updated integer;
begin
  if auth.uid() is null or public.current_role() <> 'item_manager' then
    raise exception 'Only item managers can mark items packed';
  end if;
  update public.packing_tasks pt
    set status = 'packed'::public.task_status, packed_at = now()
    where pt.order_id = p_order_id and pt.assigned_manager_id = auth.uid()
      and pt.status::text in ('queued', 'assigned');
  get diagnostics v_updated = row_count;
  if v_updated = 0 then raise exception 'No open tasks for this order'; end if;
  return v_updated;
end;
$$;

revoke all on function public.mark_task_packed(uuid) from public;
revoke all on function public.mark_order_packed(uuid) from public;
grant execute on function public.mark_task_packed(uuid) to authenticated;
grant execute on function public.mark_order_packed(uuid) to authenticated;
