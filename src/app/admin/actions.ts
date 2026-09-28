"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const assignmentSchema = z.object({
  itemId: z.uuid(),
  managerId: z.uuid(),
});

const addItemSchema = z.object({
  sku: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional().default(""),
  descriptionFull: z.string().max(5000).optional().default(""),
  uom: z.string().min(1).max(50).optional().default("piece"),
  unitPricePaise: z.coerce.number().int().min(0),
});

const setInventorySchema = z.object({
  itemId: z.uuid(),
  quantity: z.coerce.number().int().min(0),
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

export async function addItem(formData: FormData) {
  const input = addItemSchema.parse(Object.fromEntries(formData));
  const supabase = await createClient();
  
  const { data, error } = await supabase
    .from("items")
    .insert({
      sku: input.sku,
      name: input.name,
      description: input.description || null,
      description_full: input.descriptionFull || null,
      uom: input.uom || "piece",
      unit_price_paise: input.unitPricePaise,
      active: true,
    })
    .select("id")
    .single();
  
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Failed to create item");
  
  const { error: invError } = await supabase
    .from("inventory")
    .insert({ item_id: data.id, available_quantity: 0 });
  
  if (invError) throw new Error(invError.message);
  
  revalidatePath("/admin");
}

export async function setInventoryQuantity(formData: FormData) {
  const input = setInventorySchema.parse(Object.fromEntries(formData));
  const supabase = await createClient();
  
  const { error } = await supabase
    .from("inventory")
    .upsert({ item_id: input.itemId, available_quantity: input.quantity }, { onConflict: "item_id" });
  
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

export async function addItemImage(itemId: string, imageUrl: string, altText: string = "") {
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_item_image", {
    p_item_id: itemId,
    p_image_url: imageUrl,
    p_alt_text: altText || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

export async function markOrderComplete(formData: FormData) {
  const orderId = formData.get("orderId") as string;
  if (!orderId) throw new Error("Order ID is required");
  
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_order_complete", {
    p_order_id: orderId,
    p_completion_notes: null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}
