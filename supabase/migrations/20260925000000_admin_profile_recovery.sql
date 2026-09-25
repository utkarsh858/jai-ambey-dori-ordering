-- This is intentionally admin-mediated: authentication alone must never create or elevate a profile.
create or replace function public.provision_missing_profile(
  p_user_id uuid,
  p_role public.app_role default 'buyer'
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user auth.users%rowtype;
  v_profile public.profiles%rowtype;
begin
  if auth.uid() is null or not public.is_admin() then
    raise exception 'Not authorized';
  end if;

  select * into v_user from auth.users where id = p_user_id;
  if not found then
    raise exception 'User not found';
  end if;

  if exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'Profile already exists';
  end if;

  insert into public.profiles (id, role, full_name, email)
  values (
    v_user.id,
    p_role,
    coalesce(v_user.raw_user_meta_data ->> 'full_name', v_user.raw_user_meta_data ->> 'name'),
    v_user.email
  )
  returning * into v_profile;

  return v_profile;
end;
$$;

revoke all on function public.provision_missing_profile(uuid, public.app_role) from public;
grant execute on function public.provision_missing_profile(uuid, public.app_role) to authenticated;
