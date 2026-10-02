import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { formatIST } from "@/lib/datetime";

const BATCH = 1000;

function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export async function GET(request: Request) {
  const from = new URL(request.url).searchParams.get("from") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from)) {
    return NextResponse.json({ error: "A valid start date (YYYY-MM-DD) is required" }, { status: 400 });
  }
  const startIso = new Date(`${from}T00:00:00+05:30`).toISOString();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const role = profile?.role;

  let header: string[];
  let table: "orders" | "packing_tasks";
  let columns: string;
  if (role === "admin" || role === "buyer") {
    table = "orders";
    columns = "order_number,buyer_code,status,payment_method,total_paise,created_at";
    header = ["Order number", "Buyer code", "Status", "Payment method", "Total (INR)", "Date & time (IST)"];
  } else if (role === "item_manager") {
    table = "packing_tasks";
    columns = "order_number,buyer_code,item_name,quantity,status,created_at";
    header = ["Order number", "Buyer code", "Item", "Quantity", "Status", "Date & time (IST)"];
  } else {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rows: Record<string, unknown>[] = [];
  for (let offset = 0; ; offset += BATCH) {
    let query = supabase
      .from(table)
      .select(columns)
      .gte("created_at", startIso)
      .order("created_at", { ascending: false })
      .range(offset, offset + BATCH - 1);
    if (role === "buyer") query = query.eq("buyer_id", user.id);
    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    const batch = (data ?? []) as unknown as Record<string, unknown>[];
    rows.push(...batch);
    if (batch.length < BATCH) break;
  }

  const lines = [header.map(csvCell).join(",")];
  for (const row of rows) {
    const cells =
      table === "orders"
        ? [row.order_number, row.buyer_code, row.status, row.payment_method, (Number(row.total_paise) / 100).toFixed(2), formatIST(row.created_at as string)]
        : [row.order_number, row.buyer_code, row.item_name, row.quantity, row.status, formatIST(row.created_at as string)];
    lines.push(cells.map(csvCell).join(","));
  }

  return new NextResponse("\uFEFF" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="orders-from-${from}.csv"`,
    },
  });
}
