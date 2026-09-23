create extension if not exists pgcrypto;

create type public.app_role as enum ('buyer', 'admin', 'item_manager');
create type public.order_status as enum ('payment_pending', 'confirmed', 'cancelled', 'fulfilled');
create type public.payment_method as enum ('razorpay', 'pay_later');
create type public.payment_status as enum ('pending', 'paid', 'failed', 'not_required', 'refunded');
create type public.task_status as enum ('queued', 'assigned', 'packed', 'cancelled');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'buyer',
  buyer_code text unique not null default ('B' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8))),
  full_name text,
  email text,
  phone text,
  created_at timestamptz not null default now()
);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  sku text unique not null,
  name text not null,
  description text,
  unit_price_paise integer not null check (unit_price_paise >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.inventory (
  item_id uuid primary key references public.items(id) on delete cascade,
  available_quantity integer not null default 0 check (available_quantity >= 0),
  reserved_quantity integer not null default 0 check (reserved_quantity >= 0),
  updated_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text unique not null default ('ORD-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6))),
  buyer_id uuid not null references public.profiles(id),
  buyer_code text not null,
  status public.order_status not null default 'payment_pending',
  payment_method public.payment_method not null,
  total_paise integer not null check (total_paise >= 0),
  cancellation_reason text,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  item_id uuid not null references public.items(id),
  sku text not null,
  item_name text not null,
  quantity integer not null check (quantity > 0),
  unit_price_paise integer not null check (unit_price_paise >= 0),
  unique (order_id, item_id)
);

create table public.packing_tasks (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  order_number text not null,
  buyer_code text not null,
  item_id uuid not null references public.items(id),
  item_name text not null,
  quantity integer not null check (quantity > 0),
  assigned_manager_id uuid references public.profiles(id),
  status public.task_status not null default 'queued',
  created_at timestamptz not null default now(),
  packed_at timestamptz
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders(id) on delete cascade,
  provider text not null default 'razorpay',
  provider_order_id text unique,
  provider_payment_id text unique,
  status public.payment_status not null default 'pending',
  amount_paise integer not null check (amount_paise >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id),
  entity_type text not null,
  entity_id uuid,
  action text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.payment_webhook_events (
  provider_event_id text primary key,
  received_at timestamptz not null default now(),
  payload jsonb not null
);

create or replace function public.current_role()
returns public.app_role
language sql stable security definer set search_path = public
as $$ select role from public.profiles where id = auth.uid() $$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select coalesce(public.current_role() = 'admin', false) $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'), new.email);
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.items enable row level security;
alter table public.inventory enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.packing_tasks enable row level security;
alter table public.payments enable row level security;
alter table public.audit_events enable row level security;
alter table public.payment_webhook_events enable row level security;

create policy "own profile only" on public.profiles for select using (id = auth.uid());
create policy "admins manage profiles" on public.profiles for all using (public.is_admin()) with check (public.is_admin());
create policy "catalog is readable" on public.items for select using (active or public.is_admin());
create policy "admins manage catalog" on public.items for all using (public.is_admin()) with check (public.is_admin());
create policy "stock is admin only" on public.inventory for all using (public.is_admin()) with check (public.is_admin());
create policy "buyers read their orders" on public.orders for select using (buyer_id = auth.uid() or public.is_admin());
create policy "buyers read their order lines" on public.order_items for select using (
  exists (select 1 from public.orders o where o.id = order_id and (o.buyer_id = auth.uid() or public.is_admin()))
);
create policy "buyers read their payments" on public.payments for select using (
  exists (select 1 from public.orders o where o.id = order_id and (o.buyer_id = auth.uid() or public.is_admin()))
);
create policy "managers read assigned safe tasks" on public.packing_tasks for select using (
  assigned_manager_id = auth.uid() or public.is_admin()
);
create policy "managers update their tasks" on public.packing_tasks for update using (
  assigned_manager_id = auth.uid() or public.is_admin()
) with check (
  assigned_manager_id = auth.uid() or public.is_admin()
);
create policy "admins read audit log" on public.audit_events for select using (public.is_admin());

-- The manager role has no SELECT policy on profiles, orders, order_items, or payments.
-- packing_tasks intentionally contains only operational snapshots (order number, buyer code, item, quantity).

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
    if p_payment_method = 'pay_later' then
      insert into public.packing_tasks (order_id, order_number, buyer_code, item_id, item_name, quantity)
      values (v_order_id, v_order_number, v_profile.buyer_code, v_item.id, v_item.name, v_line.quantity);
    end if;
  end loop;
  insert into public.payments (order_id, provider, status, amount_paise)
  values (v_order_id, case when p_payment_method = 'razorpay' then 'razorpay' else 'pay_later' end,
    case when p_payment_method = 'pay_later' then 'not_required' else 'pending' end, v_total);
  insert into public.audit_events (actor_id, entity_type, entity_id, action, payload)
  values (auth.uid(), 'order', v_order_id, 'created', jsonb_build_object('payment_method', p_payment_method, 'total_paise', v_total));
  return query select v_order_id, v_order_number, v_total;
end;
$$;

create or replace function public.cancel_order(p_order_id uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public
as $$
declare v_order public.orders%rowtype; v_line record;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then raise exception 'Order not found'; end if;
  if v_order.buyer_id <> auth.uid() and not public.is_admin() then raise exception 'Not authorized'; end if;
  if v_order.status = 'cancelled' then return; end if;
  if v_order.status = 'fulfilled' then raise exception 'Fulfilled orders cannot be cancelled'; end if;
  for v_line in select * from public.order_items where order_id = p_order_id order by item_id loop
    update public.inventory set available_quantity = available_quantity + v_line.quantity,
      reserved_quantity = reserved_quantity - v_line.quantity, updated_at = now() where item_id = v_line.item_id;
  end loop;
  update public.orders set status = 'cancelled', cancellation_reason = p_reason, cancelled_at = now(), updated_at = now() where id = p_order_id;
  update public.packing_tasks set status = 'cancelled' where order_id = p_order_id and status in ('queued', 'assigned');
  insert into public.audit_events (actor_id, entity_type, entity_id, action, payload)
  values (auth.uid(), 'order', p_order_id, 'cancelled', jsonb_build_object('reason', p_reason));
end;
$$;

create or replace function public.confirm_razorpay_payment(p_provider_order_id text, p_provider_payment_id text)
returns void language plpgsql security definer set search_path = public
as $$
declare v_payment public.payments%rowtype; v_order public.orders%rowtype; v_line record;
begin
  select * into v_payment from public.payments where provider_order_id = p_provider_order_id for update;
  if not found then raise exception 'Payment not found'; end if;
  if v_payment.status = 'paid' then return; end if;
  select * into v_order from public.orders where id = v_payment.order_id for update;
  if v_order.status <> 'payment_pending' then raise exception 'Order cannot be paid'; end if;
  update public.payments set status = 'paid', provider_payment_id = p_provider_payment_id, updated_at = now() where id = v_payment.id;
  update public.orders set status = 'confirmed', updated_at = now() where id = v_order.id;
  for v_line in select * from public.order_items where order_id = v_order.id loop
    insert into public.packing_tasks (order_id, order_number, buyer_code, item_id, item_name, quantity)
    values (v_order.id, v_order.order_number, v_order.buyer_code, v_line.item_id, v_line.item_name, v_line.quantity);
  end loop;
  insert into public.audit_events (entity_type, entity_id, action, payload)
  values ('order', v_order.id, 'payment_confirmed', jsonb_build_object('provider_payment_id', p_provider_payment_id));
end;
$$;

create or replace function public.set_razorpay_provider_order(p_order_id uuid, p_provider_order_id text)
returns void language plpgsql security definer set search_path = public
as $$
declare v_order public.orders%rowtype;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found or v_order.buyer_id <> auth.uid() then raise exception 'Order not found'; end if;
  if v_order.status <> 'payment_pending' or v_order.payment_method <> 'razorpay' then
    raise exception 'Order is not awaiting Razorpay payment';
  end if;
  update public.payments set provider_order_id = p_provider_order_id, updated_at = now()
  where order_id = p_order_id and provider_order_id is null;
  if not found then raise exception 'Provider order already exists'; end if;
end;
$$;

revoke all on function public.create_order(jsonb, public.payment_method) from public;
revoke all on function public.cancel_order(uuid, text) from public;
revoke all on function public.confirm_razorpay_payment(text, text) from public;
revoke all on function public.set_razorpay_provider_order(uuid, text) from public;
grant execute on function public.create_order(jsonb, public.payment_method) to authenticated;
grant execute on function public.cancel_order(uuid, text) to authenticated;
grant execute on function public.confirm_razorpay_payment(text, text) to service_role;
grant execute on function public.set_razorpay_provider_order(uuid, text) to authenticated;
