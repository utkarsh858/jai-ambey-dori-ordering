# Jai Ambey Dori factory ordering

A Next.js App Router foundation for buyer orders, factory operations, immediate inventory reservation, and Razorpay payment confirmation.

## Setup

1. Copy `.env.example` to `.env.local` and set the Supabase and Razorpay values.
2. Create a Supabase project, then run `supabase/migrations/20260923000000_factory_ordering.sql` with the Supabase CLI or SQL editor.
3. In Supabase Auth, enable **Email** (with email confirmation) and **Google**. Add `http://localhost:3000/auth/callback` and the production callback to the redirect allow list.
4. Set the initial administrator in the SQL editor after creating that user: `update public.profiles set role = 'admin' where email = 'admin@example.com';`. Only an administrator should assign `item_manager` roles and task ownership.
5. Add a Razorpay webhook for `payment.captured` at `/api/payments/razorpay/webhook`; configure its secret as `RAZORPAY_WEBHOOK_SECRET`.

## Security model

RLS permits buyers to read only their own profile, orders, line items, and payments. Item managers can read and update only assigned `packing_tasks`. They have no policies granting access to profiles, orders, order items, payments, inventory, or audit logs; task rows deliberately snapshot only order number, buyer code, item, and quantity.

`create_order` locks inventory, reserves stock, and creates all records atomically. Pay-later orders are confirmed immediately and create packing tasks. Razorpay orders reserve stock immediately, then create packing tasks only after a signed, idempotent `payment.captured` webhook calls the service-role-only confirmation RPC. `cancel_order` is safe to repeat and atomically restocks only non-cancelled, non-fulfilled orders.

## Admin sign-in recovery

An admin who authenticates successfully but sees **Administrator action required** has a valid Supabase session but no usable application profile. This commonly affects accounts created before the `on_auth_user_created` trigger migration was applied. The app deliberately does not create or elevate profiles from the browser or login flow.

In the Supabase dashboard, first confirm the exact account in **Authentication > Users**: verify the email is confirmed, the account is not banned, and copy its UUID. Then run these checks in the SQL editor, substituting the verified UUID:

```sql
select id, email, email_confirmed_at, confirmed_at, banned_until
from auth.users
where id = 'VERIFIED-USER-UUID'::uuid;

select id, role, email, created_at
from public.profiles
where id = 'VERIFIED-USER-UUID'::uuid;

select tgname, tgenabled
from pg_trigger
where tgrelid = 'auth.users'::regclass
  and tgname = 'on_auth_user_created';
```

Apply `supabase/migrations/20260925000000_admin_profile_recovery.sql` if it has not already been run. For a missing profile, only after verifying the UUID belongs to the intended administrator, restore it explicitly:

```sql
insert into public.profiles (id, role, full_name, email)
select
  id,
  'admin'::public.app_role,
  coalesce(raw_user_meta_data ->> 'full_name', raw_user_meta_data ->> 'name'),
  email
from auth.users
where id = 'VERIFIED-USER-UUID'::uuid
on conflict (id) do update set role = excluded.role;
```

For already functioning administrators, the migration also provides an RLS-respecting server-side recovery RPC: `select public.provision_missing_profile('VERIFIED-USER-UUID'::uuid, 'admin');`. It rejects unauthenticated and non-admin callers and never exposes a service-role key to the app. If the user is not confirmed, resend confirmation from **Authentication > Users** instead of creating a profile.

## Development

```bash
npm run dev
npm run lint
npm test
npm run build
```
