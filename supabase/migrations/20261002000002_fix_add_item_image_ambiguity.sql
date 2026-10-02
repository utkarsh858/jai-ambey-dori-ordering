create or replace function public.add_item_image(
  p_item_id uuid,
  p_image_url text,
  p_alt_text text default null,
  p_display_order integer default null
)
returns table(image_id uuid, item_id uuid, image_url text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_image_id uuid := gen_random_uuid();
  v_order integer;
begin
  if auth.uid() is null or public.current_role() <> 'admin' then
    raise exception 'Only admins can add item images';
  end if;
  if not exists (select 1 from public.items it where it.id = p_item_id) then
    raise exception 'Item not found';
  end if;
  if p_image_url is null or length(trim(p_image_url)) = 0 then
    raise exception 'Image URL cannot be empty';
  end if;

  if p_display_order is null then
    select coalesce(max(ii.display_order), 0) + 1 into v_order
      from public.items_images ii
      where ii.item_id = p_item_id;
  else
    v_order := p_display_order;
  end if;

  insert into public.items_images as ni (id, item_id, image_url, alt_text, display_order)
    values (v_image_id, p_item_id, p_image_url, p_alt_text, v_order);

  return query select v_image_id, p_item_id, p_image_url;
end;
$$;

revoke all on function public.add_item_image(uuid, text, text, integer) from public;
grant execute on function public.add_item_image(uuid, text, text, integer) to authenticated;
