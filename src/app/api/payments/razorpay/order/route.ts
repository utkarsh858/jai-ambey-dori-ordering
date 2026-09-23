import { NextResponse } from "next/server";
import { z } from "zod";
import { razorpay } from "@/lib/razorpay";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ orderId: z.uuid() });
export async function POST(request: Request) {
  const { orderId } = schema.parse(await request.json());
  const supabase = await createClient();
  const { data: order } = await supabase.from("orders").select("id,order_number,total_paise,status,payments(id,provider_order_id)").eq("id", orderId).single();
  if (!order || order.status !== "payment_pending") return NextResponse.json({ error: "Order is not payable" }, { status: 400 });
  const payment = order.payments as unknown as { id: string; provider_order_id: string | null } | null;
  if (payment?.provider_order_id) return NextResponse.json({ providerOrderId: payment.provider_order_id });
  const providerOrder = await razorpay().orders.create({ amount: order.total_paise, currency: "INR", receipt: order.order_number });
  const { error } = await supabase.rpc("set_razorpay_provider_order", {
    p_order_id: orderId,
    p_provider_order_id: providerOrder.id,
  });
  if (error) return NextResponse.json({ error: "Unable to prepare payment" }, { status: 409 });
  return NextResponse.json({ providerOrderId: providerOrder.id, amount: order.total_paise });
}
