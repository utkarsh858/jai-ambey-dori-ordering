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
  unitPricePaise: z.coerce.number().min(0),
});

const setInventorySchema = z.object({
  itemId: z.uuid(),
  quantity: z.coerce.number().int().min(0),
});

const editItemSchema = z.object({
  itemId: z.uuid(),
  sku: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  description: z.string().max(500).optional().default(""),
  descriptionFull: z.string().max(5000).optional().default(""),
  uom: z.string().min(1).max(50).optional().default("piece"),
  unitPricePaise: z.coerce.number().min(0),
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
  
  // Convert rupees to paise (multiply by 100)
  const priceInPaise = Math.round(input.unitPricePaise * 100);
  
  const { data, error } = await supabase
    .from("items")
    .insert({
      sku: input.sku,
      name: input.name,
      description: input.description || null,
      description_full: input.descriptionFull || null,
      uom: input.uom || "piece",
      unit_price_paise: priceInPaise,
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

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const BUCKET = "item-images";

export async function uploadItemImage(formData: FormData) {
  const itemId = z.uuid().parse(formData.get("itemId"));
  const isCover = formData.get("imageType") === "cover";
  const altText = String(formData.get("altText") ?? "").slice(0, 200);
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) throw new Error("No file selected");
  if (!file.type.startsWith("image/")) throw new Error("Only image files are allowed");
  if (file.size > MAX_IMAGE_BYTES) throw new Error("Image must be smaller than 4MB");

  const supabase = await createClient();
  const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "");
  const path = `${itemId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false, contentType: file.type });
  if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

  const { data: publicUrl } = supabase.storage.from(BUCKET).getPublicUrl(path);
  const { error: dbError } = await supabase.rpc("add_item_image", {
    p_item_id: itemId,
    p_image_url: publicUrl.publicUrl,
    p_storage_path: path,
    p_alt_text: altText || null,
    p_is_cover: isCover,
  });
  if (dbError) {
    await supabase.storage.from(BUCKET).remove([path]);
    throw new Error(`Failed to save image: ${dbError.message}`);
  }

  revalidatePath("/admin");
  revalidatePath("/buyer");
}

export async function setCoverImage(imageId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_cover_image", { p_image_id: z.uuid().parse(imageId) });
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
  revalidatePath("/buyer");
}

export async function deleteItemImage(imageId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("items_images")
    .delete()
    .eq("id", z.uuid().parse(imageId))
    .select("image_url,storage_path");
  if (error) throw new Error(error.message);
  const removed = data?.[0];
  if (!removed) throw new Error("Image not found or not permitted");

  const path = removed.storage_path ?? removed.image_url.split(`/${BUCKET}/`)[1];
  if (path) await supabase.storage.from(BUCKET).remove([decodeURIComponent(path)]);

  revalidatePath("/admin");
  revalidatePath("/buyer");
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

export async function editItem(formData: FormData) {
  const input = editItemSchema.parse(Object.fromEntries(formData));
  const supabase = await createClient();
  
  // Convert rupees to paise (multiply by 100)
  const priceInPaise = Math.round(input.unitPricePaise * 100);
  
  const { error } = await supabase
    .from("items")
    .update({
      sku: input.sku,
      name: input.name,
      description: input.description || null,
      description_full: input.descriptionFull || null,
      uom: input.uom || "piece",
      unit_price_paise: priceInPaise,
    })
    .eq("id", input.itemId);
  
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}

