import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";

export default async function ManagerPage() {
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("role,full_name").single();
  if (profile?.role !== "item_manager") redirect("/dashboard");
  const { data: tasks } = await supabase.from("packing_tasks").select("id,order_number,buyer_code,item_name,quantity,status").order("created_at");
  return <main><header><div><p className="eyebrow">ITEM MANAGER</p><h1>Packing queue</h1></div><form action={signOut}><button className="secondary">Sign out</button></form></header><p className="privacy">This queue exposes only the operational data required to pack an assigned item.</p><section className="card"><table><thead><tr><th>Order</th><th>Buyer code</th><th>Item</th><th>Quantity</th><th>Status</th></tr></thead><tbody>{tasks?.map((task) => <tr key={task.id}><td>{task.order_number}</td><td>{task.buyer_code}</td><td>{task.item_name}</td><td>{task.quantity}</td><td><span className="pill">{task.status}</span></td></tr>)}</tbody></table></section></main>;
}
