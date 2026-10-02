alter table public.items_images
  add column if not exists is_cover boolean not null default false,
  add column if not exists storage_path text;

-- Existing images: treat the first one per item as its cover
update public.items_images ii set is_cover = true
where ii.id in (
  select distinct on (item_id) id from public.items_images
  order by item_id, display_order, created_at
)
and not exists (select 1 from public.items_images c where c.item_id = ii.item_id and c.is_cover);

create unique index if not exists items_images_one_cover_per_item
  on public.items_images (item_id) where is_cover;

drop function if exists public.add_item_image(uuid, text, text, integer);

create or replace function public.add_item_image(
  p_item_id uuid,
  p_image_url text,
  p_storage_path text,
  p_alt_text text,
  p_is_cover boolean
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := gen_random_uuid();
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

  if p_is_cover then
    update public.items_images ii set is_cover = false where ii.item_id = p_item_id and ii.is_cover;
  end if;

  select coalesce(max(ii.display_order), 0) + 1 into v_order
    from public.items_images ii where ii.item_id = p_item_id;

  insert into public.items_images (id, item_id, image_url, storage_path, alt_text, display_order, is_cover)
  values (v_id, p_item_id, p_image_url, p_storage_path, p_alt_text, v_order, coalesce(p_is_cover, false));

  return v_id;
end;
$$;

create or replace function public.set_cover_image(p_image_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item uuid;
begin
  if auth.uid() is null or public.current_role() <> 'admin' then
    raise exception 'Only admins can change cover images';
  end if;
  select ii.item_id into v_item from public.items_images ii where ii.id = p_image_id;
  if v_item is null then raise exception 'Image not found'; end if;
  update public.items_images ii set is_cover = false where ii.item_id = v_item and ii.is_cover;
  update public.items_images ii set is_cover = true where ii.id = p_image_id;
end;
$$;

revoke all on function public.add_item_image(uuid, text, text, text, boolean) from public;
revoke all on function public.set_cover_image(uuid) from public;
grant execute on function public.add_item_image(uuid, text, text, text, boolean) to authenticated;
grant execute on function public.set_cover_image(uuid) to authenticated;
