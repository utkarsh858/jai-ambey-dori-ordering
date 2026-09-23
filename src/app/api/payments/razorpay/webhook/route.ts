import { NextResponse } from "next/server";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyRazorpayWebhook } from "@/lib/razorpay";

const eventSchema = z.object({
  event: z.string(),
  payload: z.object({ payment: z.object({ entity: z.object({ id: z.string(), order_id: z.string() }) }) }),
});

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!signature || !secret || !verifyRazorpayWebhook(rawBody, signature, secret)) return new NextResponse("Invalid signature", { status: 400 });
  const event = eventSchema.parse(JSON.parse(rawBody));
  const eventId = request.headers.get("x-razorpay-event-id");
  if (!eventId) return new NextResponse("Missing event ID", { status: 400 });
  const admin = createAdminClient();
  const { error: inserted } = await admin.from("payment_webhook_events").insert({ provider_event_id: eventId, payload: event });
  if (inserted?.code === "23505") return NextResponse.json({ received: true, duplicate: true });
  if (inserted) return new NextResponse("Unable to record event", { status: 500 });
  if (event.event === "payment.captured") {
    const { error } = await admin.rpc("confirm_razorpay_payment", { p_provider_order_id: event.payload.payment.entity.order_id, p_provider_payment_id: event.payload.payment.entity.id });
    if (error) return new NextResponse("Payment reconciliation failed", { status: 500 });
  }
  return NextResponse.json({ received: true });
}
