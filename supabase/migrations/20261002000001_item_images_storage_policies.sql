insert into storage.buckets (id, name, public)
values ('item-images', 'item-images', true)
on conflict (id) do update set public = true;

drop policy if exists "item images public read" on storage.objects;
create policy "item images public read" on storage.objects
  for select using (bucket_id = 'item-images');

drop policy if exists "item images admin insert" on storage.objects;
create policy "item images admin insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'item-images' and public.is_admin());

drop policy if exists "item images admin update" on storage.objects;
create policy "item images admin update" on storage.objects
  for update to authenticated
  using (bucket_id = 'item-images' and public.is_admin())
  with check (bucket_id = 'item-images' and public.is_admin());

drop policy if exists "item images admin delete" on storage.objects;
create policy "item images admin delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'item-images' and public.is_admin());
