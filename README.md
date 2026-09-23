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

## Development

```bash
npm run dev
npm run lint
npm test
npm run build
```
