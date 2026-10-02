create or replace function public.get_available_stock()
returns table(item_id uuid, available_quantity integer)
language sql stable security definer set search_path = public
as $$
  select i.item_id, i.available_quantity
  from public.inventory i
  join public.items it on it.id = i.item_id and it.active
  where auth.uid() is not null;
$$;

revoke all on function public.get_available_stock() from public;
grant execute on function public.get_available_stock() to authenticated;
