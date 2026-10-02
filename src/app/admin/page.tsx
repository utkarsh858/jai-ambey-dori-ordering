import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";
import { assignManagerToItem, removeManagerFromItem, markOrderComplete } from "./actions";
import { AddItemForm } from "./add-item-form";
import { InventoryAdjuster } from "./inventory-adjuster";
import { ImageUploader } from "./image-uploader";
import { EditItemSection } from "./edit-item-section";
import { Pagination } from "@/components/Pagination";
import { ExportOrders } from "@/components/ExportOrders";
import { formatIST } from "@/lib/datetime";
import { pageRange, parsePage } from "@/lib/pagination";

export default async function AdminPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const page = parsePage(params.page);
  const { from, to } = pageRange(page);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [{ data: profile }, { data: orders, count: ordersCount }, { data: inventory }, { data: allItems }, { data: managers }, { data: assignments }] = await Promise.all([
    user ? supabase.from("profiles").select("role").eq("id", user.id).single() : { data: null, error: null },
    supabase.from("orders").select("id,order_number,buyer_code,status,total_paise,created_at", { count: "exact" }).order("created_at", { ascending: false }).range(from, to),
    supabase.from("inventory").select("item_id,available_quantity,reserved_quantity,items(name,sku)").limit(50),
    supabase.from("items").select("*").eq("active", true).order("name"),
    supabase.from("profiles").select("id,full_name,email").eq("role", "item_manager").order("full_name"),
    supabase.from("item_manager_assignments").select("item_id,manager_id"),
  ]);
  if (profile?.role !== "admin") redirect("/dashboard");

  const managerById = new Map(managers?.map((manager) => [manager.id, manager]));
  const assignmentsByItem = new Map<string, string[]>();
  assignments?.forEach((assignment) => {
    assignmentsByItem.set(assignment.item_id, [...(assignmentsByItem.get(assignment.item_id) ?? []), assignment.manager_id]);
  });

  return (
    <main>
      <header>
        <div>
          <p className="eyebrow">ADMIN</p>
          <h1>Factory operations</h1>
        </div>
        <form action={signOut}>
          <button className="secondary">Sign out</button>
        </form>
      </header>

      <section style={{ marginBottom: "2rem" }}>
        <h2>Add new item to catalog</h2>
        <AddItemForm />
      </section>

      <section className="grid">
        <article className="card">
          <h2>Manage inventory levels</h2>
          {inventory && inventory.length > 0 ? (
            <div style={{ maxHeight: "500px", overflowY: "auto" }}>
              {inventory.map((row) => {
                const item = Array.isArray(row.items) ? row.items[0] : row.items;
                return (
                  <InventoryAdjuster
                      key={row.item_id}
                    itemId={row.item_id}
                    itemName={item?.name ?? "Unknown"}
                    itemSku={item?.sku ?? "N/A"}
                    currentQuantity={row.available_quantity}
                  />
                );
              })}
            </div>
          ) : (
            <p>No items in inventory yet.</p>
          )}
        </article>

        <article className="card">
          <h2>All orders</h2>
          <ExportOrders />
          {orders && orders.length > 0 ? (
            orders.map((order) => (
              <div key={order.id} style={{ marginBottom: "1rem", paddingBottom: "1rem", borderBottom: "1px solid #eee" }}>
                <p>
                  <strong>{order.order_number}</strong>
                  <br />
                  <span style={{ color: order.status === "completed" ? "#4caf50" : "#ff9800" }}>
                    {order.status}
                  </span>
                  {" · "}₹{(order.total_paise / 100).toFixed(2)}
                  <br />
                  <small>Buyer {order.buyer_code} · {formatIST(order.created_at)}</small>
                </p>
                {order.status !== "completed" && (
                  <form action={markOrderComplete} style={{ display: "inline" }}>
                    <input type="hidden" name="orderId" value={order.id} />
                    <button type="submit" className="small" style={{ fontSize: "0.9rem", padding: "0.5rem 1rem" }}>
                      Mark complete
                    </button>
                  </form>
                )}
              </div>
            ))
          ) : (
            <p>No orders yet.</p>
          )}
          <Pagination page={page} total={ordersCount ?? 0} param="page" searchParams={params} basePath="/admin" />
        </article>

        <article className="card">
          <h2>Item manager assignments</h2>
          {inventory && inventory.length > 0 ? (
            inventory.map((row) => {
              const item = Array.isArray(row.items) ? row.items[0] : row.items;
              const assignedManagers = (assignmentsByItem.get(row.item_id) ?? [])
                .map((id) => managerById.get(id))
                .filter(Boolean);
              return (
                <div className="assignment-row" key={row.item_id}>
                  <p>
                    <strong>{item?.name}</strong>
                    <br />
                    <small>{item?.sku}</small>
                  </p>
                  {assignedManagers.length ? (
                    <ul>
                      {assignedManagers.map((manager) =>
                        manager ? (
                          <li key={manager.id}>
                            {manager.full_name || manager.email || manager.id}
                            <form action={removeManagerFromItem}>
                              <input type="hidden" name="itemId" value={row.item_id} />
                              <input type="hidden" name="managerId" value={manager.id} />
                              <button className="link-button" type="submit">
                                Remove
                              </button>
                            </form>
                          </li>
                        ) : null
                      )}
                    </ul>
                  ) : (
                    <p>
                      <small>No manager assigned</small>
                    </p>
                  )}
                  <form action={assignManagerToItem} className="inline-form">
                    <input type="hidden" name="itemId" value={row.item_id} />
                    <select name="managerId" required defaultValue="">
                      <option value="" disabled>
                        Select manager
                      </option>
                      {managers?.map((manager) => (
                        <option key={manager.id} value={manager.id}>
                          {manager.full_name || manager.email || manager.id}
                        </option>
                      ))}
                    </select>
                    <button type="submit" disabled={!managers?.length}>
                      Assign
                    </button>
                  </form>
                </div>
              );
            })
          ) : (
            <p>No items to assign.</p>
          )}
        </article>
      </section>

      <section style={{ marginTop: "2rem" }}>
        <h2>Manage item images</h2>
        {inventory && inventory.length > 0 ? (
          <div className="grid">
            {inventory.map((row) => {
              const item = Array.isArray(row.items) ? row.items[0] : row.items;
              return (
                <article className="card" key={row.item_id}>
                  <h3>{item?.name}</h3>
                  <small>{item?.sku}</small>
                  <ImageUploader item={{ id: row.item_id, name: item?.name ?? "Item", sku: item?.sku ?? "N/A" }} />
                </article>
              );
            })}
          </div>
        ) : (
          <p>No items available to add images to. Add items first.</p>
        )}
      </section>

      <EditItemSection items={allItems ?? []} />
    </main>
  );
}
