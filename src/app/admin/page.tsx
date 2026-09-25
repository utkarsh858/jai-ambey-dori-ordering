import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";
import { assignManagerToItem, removeManagerFromItem } from "./actions";

export default async function AdminPage() {
  const supabase = await createClient();
  const [{ data: profile }, { data: orders }, { data: inventory }, { data: managers }, { data: assignments }] = await Promise.all([
    supabase.from("profiles").select("role").single(),
    supabase.from("orders").select("order_number,status,total_paise,created_at").order("created_at", { ascending: false }).limit(20),
    supabase.from("inventory").select("item_id,available_quantity,reserved_quantity,items(name,sku)").limit(50),
    supabase.from("profiles").select("id,full_name,email").eq("role", "item_manager").order("full_name"),
    supabase.from("item_manager_assignments").select("item_id,manager_id"),
  ]);
  if (profile?.role !== "admin") redirect("/dashboard");
  const managerById = new Map(managers?.map((manager) => [manager.id, manager]));
  const assignmentsByItem = new Map<string, string[]>();
  assignments?.forEach((assignment) => {
    assignmentsByItem.set(assignment.item_id, [...(assignmentsByItem.get(assignment.item_id) ?? []), assignment.manager_id]);
  });
  return <main>
    <header><div><p className="eyebrow">ADMIN</p><h1>Factory operations</h1></div><form action={signOut}><button className="secondary">Sign out</button></form></header>
    <section className="grid">
      <article className="card"><h2>Inventory</h2>{inventory?.map((row) => {
        const item = Array.isArray(row.items) ? row.items[0] : row.items;
        return <p key={item?.sku ?? row.item_id}><strong>{item?.name}</strong><br />Available: {row.available_quantity} · Reserved: {row.reserved_quantity}</p>;
      })}</article>
      <article className="card"><h2>Recent orders</h2>{orders?.map((order) => <p key={order.order_number}><strong>{order.order_number}</strong><br />{order.status} · ₹{(order.total_paise / 100).toFixed(2)}</p>)}</article>
      <article className="card"><h2>Item manager assignments</h2>{inventory?.map((row) => {
        const item = Array.isArray(row.items) ? row.items[0] : row.items;
        const assignedManagers = (assignmentsByItem.get(row.item_id) ?? []).map((id) => managerById.get(id)).filter(Boolean);
        return <div className="assignment-row" key={row.item_id}><p><strong>{item?.name}</strong><br /><small>{item?.sku}</small></p>{assignedManagers.length ? <ul>{assignedManagers.map((manager) => manager && <li key={manager.id}>{manager.full_name || manager.email || manager.id}<form action={removeManagerFromItem}><input type="hidden" name="itemId" value={row.item_id} /><input type="hidden" name="managerId" value={manager.id} /><button className="link-button" type="submit">Remove</button></form></li>)}</ul> : <p><small>No manager assigned</small></p>}<form action={assignManagerToItem} className="inline-form"><input type="hidden" name="itemId" value={row.item_id} /><select name="managerId" required defaultValue=""><option value="" disabled>Select manager</option>{managers?.map((manager) => <option key={manager.id} value={manager.id}>{manager.full_name || manager.email || manager.id}</option>)}</select><button type="submit" disabled={!managers?.length}>Assign</button></form></div>;
      })}</article>
    </section>
  </main>;
}
