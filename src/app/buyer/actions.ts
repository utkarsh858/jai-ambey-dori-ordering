"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const orderSchema = z.object({
  paymentMethod: z.enum(["razorpay", "pay_later"]),
  lines: z.array(z.object({ item_id: z.uuid(), quantity: z.number().int().positive() })).min(1),
});

export async function createOrder(input: unknown) {
  const order = orderSchema.parse(input);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_order", { p_lines: order.lines, p_payment_method: order.paymentMethod });
  if (error) throw new Error(error.message);
  revalidatePath("/buyer");
  return data?.[0];
}

export async function cancelOrder(orderId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_order", { p_order_id: z.uuid().parse(orderId), p_reason: "Cancelled by buyer" });
  if (error) throw new Error(error.message);
  revalidatePath("/buyer");
}
