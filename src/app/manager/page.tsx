import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";
import { adjustAssignedInventory } from "./actions";

export default async function ManagerPage() {
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("role,full_name").single();
  if (profile?.role !== "item_manager") redirect("/dashboard");
  const [{ data: tasks }, { data: inventory }] = await Promise.all([
    supabase.from("packing_tasks").select("id,order_number,buyer_code,item_name,quantity,status").order("created_at"),
    supabase.from("inventory").select("item_id,available_quantity,reserved_quantity,items(name,sku)").order("item_id"),
  ]);
  return <main><header><div><p className="eyebrow">ITEM MANAGER</p><h1>Packing queue</h1></div><form action={signOut}><button className="secondary">Sign out</button></form></header><p className="privacy">This workspace exposes only assigned item stock and operational packing details. Buyer contact and order records are not available.</p><section className="card"><h2>Assigned inventory</h2>{inventory?.length ? <table><thead><tr><th>Item</th><th>Available</th><th>Reserved</th><th>Adjust stock</th></tr></thead><tbody>{inventory.map((row) => {
    const item = Array.isArray(row.items) ? row.items[0] : row.items;
    return <tr key={row.item_id}><td><strong>{item?.name}</strong><br /><small>{item?.sku}</small></td><td>{row.available_quantity}</td><td>{row.reserved_quantity}</td><td><form action={adjustAssignedInventory} className="inline-form"><input type="hidden" name="itemId" value={row.item_id} /><input name="quantityDelta" type="number" required aria-label={`Stock adjustment for ${item?.name ?? "item"}`} /><input name="reason" required minLength={3} maxLength={500} placeholder="Reason" aria-label={`Reason for ${item?.name ?? "item"} adjustment`} /><button type="submit">Adjust</button></form></td></tr>;
  })}</tbody></table> : <p>No items are assigned to you yet.</p>}</section><section className="card"><h2>Assigned packing tasks</h2>{tasks?.length ? <table><thead><tr><th>Order</th><th>Buyer code</th><th>Item</th><th>Quantity</th><th>Status</th></tr></thead><tbody>{tasks.map((task) => <tr key={task.id}><td>{task.order_number}</td><td>{task.buyer_code}</td><td>{task.item_name}</td><td>{task.quantity}</td><td><span className="pill">{task.status}</span></td></tr>)}</tbody></table> : <p>No packing tasks are assigned to you.</p>}</section></main>;
}
