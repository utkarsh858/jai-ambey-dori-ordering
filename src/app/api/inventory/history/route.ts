import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { formatIST } from "@/lib/datetime";

function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  const itemId = new URL(request.url).searchParams.get("itemId") ?? "";
  if (!/^[0-9a-f-]{36}$/i.test(itemId)) return NextResponse.json({ error: "Invalid item" }, { status: 400 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const [{ data: item }, { data: rows, error }] = await Promise.all([
    supabase.from("items").select("sku,name").eq("id", itemId).single(),
    supabase
      .from("inventory_adjustments")
      .select("created_at,changed_by_role,previous_quantity,new_quantity,delta,reason,profiles:changed_by(full_name,email)")
      .eq("item_id", itemId)
      .order("created_at", { ascending: false }),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const lines = [["Date & time (IST)", "Item", "SKU", "Changed by", "Role", "Previous quantity", "New quantity", "Change", "Reason"].map(csvCell).join(",")];
  for (const r of rows ?? []) {
    const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
    lines.push(
      [formatIST(r.created_at), item?.name, item?.sku, p?.full_name || p?.email || "", r.changed_by_role, r.previous_quantity, r.new_quantity, r.delta, r.reason]
        .map(csvCell)
        .join(","),
    );
  }
  const safeSku = (item?.sku ?? "item").replace(/[^a-zA-Z0-9_-]/g, "");
  return new NextResponse("\uFEFF" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="stock-history-${safeSku}.csv"`,
    },
  });
}
