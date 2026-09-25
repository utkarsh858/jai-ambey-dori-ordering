# Jai Ambey Dori factory ordering

A Next.js App Router foundation for buyer orders, factory operations, immediate inventory reservation, and Razorpay payment confirmation.

## Setup

1. Copy `.env.example` to `.env.local` and set the Supabase and Razorpay values.
2. Create a Supabase project, then apply both migrations in filename order with the Supabase CLI (`supabase db push`) or the SQL editor:
   - `supabase/migrations/20260923000000_factory_ordering.sql`
   - `supabase/migrations/20260924000000_manager_item_assignments.sql`
3. In Supabase Auth, enable **Email** (with email confirmation) and **Google**. Add `http://localhost:3000/auth/callback` and the production callback to the redirect allow list.
4. Create administrator, buyer, and manager accounts in **Authentication > Users** (or through the application sign-up flow). After the users are created, run the following exact SQL in the SQL editor, replacing the example emails:

   ```sql
   -- The signup trigger creates buyer profiles. Make the initial administrator explicit.
   update public.profiles set role = 'admin' where email = 'admin@example.com';

   -- Buyer accounts must retain the buyer role.
   update public.profiles set role = 'buyer' where email = 'buyer@example.com';

   -- Promote only factory staff who should adjust assigned inventory and receive packing tasks.
   update public.profiles set role = 'item_manager' where email = 'manager@example.com';

   -- Assign one or more managers to an item. The UI provides the same admin-only workflow.
   insert into public.item_manager_assignments (item_id, manager_id)
   select item.id, manager.id
   from public.items item
   join public.profiles manager on manager.email = 'manager@example.com'
   where item.sku = 'DORI-001'
   on conflict (item_id, manager_id) do nothing;
   ```

   Assign managers before accepting orders when possible. New assignments also create tasks for matching already-confirmed orders. The assignment trigger rejects users whose role is not `item_manager`.
5. Add a Razorpay webhook for `payment.captured` at `/api/payments/razorpay/webhook`; configure its secret as `RAZORPAY_WEBHOOK_SECRET`.

## Security model

RLS permits buyers to read only their own profile, orders, line items, and payments. Item managers can read only their item assignments, assigned item catalog rows, assigned inventory, and assigned packing tasks. They have no policies granting access to profiles, orders, order items, payments, or audit logs. Packing tasks contain only operational order/item/quantity data plus the buyer's non-contact `buyer_code`; they never contain buyer names, email addresses, phone numbers, or other contact details. Managers cannot update inventory directly: the authenticated `adjust_assigned_inventory` RPC checks their assignment, rejects negative stock, requires a reason, and writes an audit event.

`create_order` locks inventory, reserves stock, and creates all records atomically. Pay-later orders are confirmed immediately and create one packing task per assigned manager for each item. Razorpay orders reserve stock immediately, then create those tasks only after a signed, idempotent `payment.captured` webhook calls the service-role-only confirmation RPC. `cancel_order` is safe to repeat and atomically restocks only non-cancelled, non-fulfilled orders.

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
