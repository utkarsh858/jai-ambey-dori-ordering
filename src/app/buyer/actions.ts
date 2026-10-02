"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const orderSchema = z.object({
  paymentMethod: z.enum(["razorpay", "pay_later"]),
  lines: z.array(z.object({ item_id: z.uuid(), quantity: z.number().int().positive() })).min(1),
});

export async function createOrder(input: unknown) {
  try {
    const order = orderSchema.parse(input);
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("create_order", { p_lines: order.lines, p_payment_method: order.paymentMethod });
    
    if (error) {
      // Extract error message and provide helpful feedback
      const errorMsg = error.message || "Failed to place order";
      
      // Check for stock error pattern
      if (errorMsg.includes("Insufficient stock")) {
        throw new Error(`Stock unavailable: ${errorMsg}`);
      }
      
      throw new Error(errorMsg);
    }
    
    revalidatePath("/buyer");
    return data?.[0];
  } catch (err) {
    // Ensure we throw a proper error with serializable message
    if (err instanceof z.ZodError) {
      throw new Error("Invalid order data");
    }
    if (err instanceof Error) {
      throw new Error(err.message);
    }
    throw new Error("Failed to place order");
  }
}

export async function cancelOrder(orderId: string) {
  try {
    const supabase = await createClient();
    const { error } = await supabase.rpc("cancel_order", { p_order_id: z.uuid().parse(orderId), p_reason: "Cancelled by buyer" });
    
    if (error) {
      throw new Error(error.message || "Failed to cancel order");
    }
    
    revalidatePath("/buyer");
  } catch (err) {
    if (err instanceof Error) {
      throw new Error(err.message);
    }
    throw new Error("Failed to cancel order");
  }
}

export async function fetchLatestStock(): Promise<Record<string, number>> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_available_stock");
  if (error) throw new Error("Unable to check current stock. Please try again.");
  return Object.fromEntries(
    (data ?? []).map((r: { item_id: string; available_quantity: number }) => [r.item_id, r.available_quantity]),
  );
}
