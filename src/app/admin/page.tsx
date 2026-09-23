import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";

export default async function AdminPage() {
  const supabase = await createClient();
  const [{ data: profile }, { data: orders }, { data: inventory }] = await Promise.all([
    supabase.from("profiles").select("role").single(),
    supabase.from("orders").select("order_number,status,total_paise,created_at").order("created_at", { ascending: false }).limit(20),
    supabase.from("inventory").select("item_id,available_quantity,reserved_quantity,items(name,sku)").limit(50),
  ]);
  if (profile?.role !== "admin") redirect("/dashboard");
  return <main><header><div><p className="eyebrow">ADMIN</p><h1>Factory operations</h1></div><form action={signOut}><button className="secondary">Sign out</button></form></header><section className="grid"><article className="card"><h2>Inventory</h2>{inventory?.map((row) => {
    const item = Array.isArray(row.items) ? row.items[0] : row.items;
    return <p key={item?.sku ?? row.item_id}><strong>{item?.name}</strong><br />Available: {row.available_quantity} · Reserved: {row.reserved_quantity}</p>;
  })}</article><article className="card"><h2>Recent orders</h2>{orders?.map((order) => <p key={order.order_number}><strong>{order.order_number}</strong><br />{order.status} · ₹{(order.total_paise / 100).toFixed(2)}</p>)}</article></section></main>;
}
