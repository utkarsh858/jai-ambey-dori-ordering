"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const adjustmentSchema = z.object({
  itemId: z.uuid(),
  quantityDelta: z.coerce.number().int().refine((value) => value !== 0, "Adjustment must not be zero"),
  reason: z.string().trim().min(3).max(500),
});

export async function adjustAssignedInventory(formData: FormData) {
  const input = adjustmentSchema.parse(Object.fromEntries(formData));
  const supabase = await createClient();
  const { error } = await supabase.rpc("adjust_assigned_inventory", {
    p_item_id: input.itemId,
    p_quantity_delta: input.quantityDelta,
    p_reason: input.reason,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/manager");
}
