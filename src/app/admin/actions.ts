"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const assignmentSchema = z.object({
  itemId: z.uuid(),
  managerId: z.uuid(),
});

export async function assignManagerToItem(formData: FormData) {
  const input = assignmentSchema.parse(Object.fromEntries(formData));
  const supabase = await createClient();
  const { error } = await supabase
    .from("item_manager_assignments")
    .upsert({ item_id: input.itemId, manager_id: input.managerId }, { onConflict: "item_id,manager_id" });
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

export async function removeManagerFromItem(formData: FormData) {
  const input = assignmentSchema.parse(Object.fromEntries(formData));
  const supabase = await createClient();
  const { error } = await supabase
    .from("item_manager_assignments")
    .delete()
    .eq("item_id", input.itemId)
    .eq("manager_id", input.managerId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}
