drop function if exists public.mark_order_packed(uuid);

create or replace function public.mark_task_packed(p_task_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare v_updated integer;
begin
  if auth.uid() is null or public.current_role() <> 'item_manager' then
    raise exception 'Only item managers can mark items packed';
  end if;
  update public.packing_tasks pt
    set status = 'packed'::public.task_status,
        packed_at = now(),
        assigned_manager_id = coalesce(pt.assigned_manager_id, auth.uid())
    where pt.id = p_task_id
      and pt.status::text in ('queued', 'assigned')
      and (
        pt.assigned_manager_id = auth.uid()
        or exists (
          select 1 from public.item_manager_assignments ima
          where ima.item_id = pt.item_id and ima.manager_id = auth.uid()
        )
      );
  get diagnostics v_updated = row_count;
  if v_updated = 0 then raise exception 'Task not found, not assigned to you, or no longer open'; end if;
end;
$$;

revoke all on function public.mark_task_packed(uuid) from public;
grant execute on function public.mark_task_packed(uuid) to authenticated;
