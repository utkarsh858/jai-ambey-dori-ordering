import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OrderForm } from "@/app/buyer/order-form";
import { signOut } from "@/app/auth/actions";

export default async function BuyerPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [{ data: profile }, { data: items }, { data: orders }] = await Promise.all([
    user ? supabase.from("profiles").select("full_name,buyer_code").eq("id", user.id).single() : { data: null },
    supabase.from("items").select("id,sku,name,unit_price_paise").eq("active", true).order("name"),
    supabase.from("orders").select("order_number,status,total_paise,created_at").order("created_at", { ascending: false }),
  ]);
  if (!profile) redirect("/dashboard");
  return <main><header><div><p className="eyebrow">BUYER PORTAL</p><h1>Welcome, {profile.full_name ?? profile.buyer_code}</h1></div><form action={signOut}><button className="secondary">Sign out</button></form></header><OrderForm items={items ?? []} /><section className="card"><h2>Your orders</h2><table><thead><tr><th>Order</th><th>Status</th><th>Total</th></tr></thead><tbody>{orders?.map((order) => <tr key={order.order_number}><td>{order.order_number}</td><td><span className="pill">{order.status.replace("_", " ")}</span></td><td>₹{(order.total_paise / 100).toFixed(2)}</td></tr>)}</tbody></table></section></main>;
}
