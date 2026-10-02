import { AutoRefresh } from "@/components/AutoRefresh";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";
import { ActionButton } from "@/components/ActionButton";
import { ItemCodeButton } from "@/components/ItemCodeButton";
import { markTaskPacked } from "./actions";
import { ManagerStockAdjuster } from "./stock-adjuster";
import { Pagination } from "@/components/Pagination";
import { ExportOrders } from "@/components/ExportOrders";
import { formatIST } from "@/lib/datetime";
import { pageRange, parsePage } from "@/lib/pagination";

export default async function ManagerPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const page = parsePage(params.page);
  const { from, to } = pageRange(page);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = user
    ? await supabase.from("profiles").select("role,full_name").eq("id", user.id).single()
    : { data: null };
  if (profile?.role !== "item_manager") redirect("/dashboard");

  const [{ data: tasks, count: tasksCount }, { data: inventory }] = await Promise.all([
    supabase
      .from("packing_tasks")
      .select("id,order_id,item_id,order_number,buyer_code,item_name,quantity,status,created_at,items(sku)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(from, to),
    supabase
      .from("inventory")
      .select("item_id,available_quantity,reserved_quantity,items(name,sku)")
      .order("item_id"),
  ]);

  const itemIds = [...new Set(tasks?.map((t) => t.item_id) ?? [])];
  const { data: images } = itemIds.length
    ? await supabase.from("items_images").select("id,item_id,image_url,alt_text,is_cover").in("item_id", itemIds)
    : { data: [] };
  const imagesByItem = new Map<string, NonNullable<typeof images>>();
  images?.forEach((img) => imagesByItem.set(img.item_id, [...(imagesByItem.get(img.item_id) ?? []), img]));
  const isOpen = (status: string) => status === "queued" || status === "assigned";

  return (
    <main>
      <AutoRefresh seconds={10} />
      <header>
        <div>
          <p className="eyebrow">ITEM MANAGER</p>
          <h1>Packing queue</h1>
        </div>
        <form action={signOut}>
          <button className="secondary">Sign out</button>
        </form>
      </header>

      <p className="privacy">
        This workspace exposes only assigned item stock and operational packing details. Buyer contact and order records are not available.
      </p>

      <section className="card">
        <h2>Assigned inventory</h2>
        {inventory?.length ? (
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th>Available</th>
                <th>Reserved</th>
                <th>Adjust stock</th>
              </tr>
            </thead>
            <tbody>
              {inventory.map((row) => {
                const item = Array.isArray(row.items) ? row.items[0] : row.items;
                return (
                  <tr key={row.item_id}>
                    <td>
                      <strong>{item?.name}</strong>
                      <br />
                      <small>{item?.sku}</small>
                    </td>
                    <td>{row.available_quantity}</td>
                    <td>{row.reserved_quantity}</td>
                    <td>
                      <ManagerStockAdjuster
                        itemId={row.item_id}
                        itemName={item?.name ?? "Item"}
                        itemSku={item?.sku ?? "N/A"}
                        currentQuantity={row.available_quantity}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p>No items are assigned to you yet.</p>
        )}
      </section>

      <section className="card">
        <h2>Assigned packing tasks</h2>
        <ExportOrders />
        {tasks?.length ? (
          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>Date &amp; time (IST)</th>
                <th>Buyer code</th>
                <th>Item code</th>
                <th>Item</th>
                <th>Quantity</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <tr key={task.id}>
                  <td>{task.order_number}</td>
                  <td>{formatIST(task.created_at)}</td>
                  <td>{task.buyer_code}</td>
                  <td>
                    <ItemCodeButton sku={(Array.isArray(task.items) ? task.items[0]?.sku : (task.items as { sku?: string } | null)?.sku) ?? "N/A"} itemName={task.item_name} images={imagesByItem.get(task.item_id) ?? []} />
                  </td>
                  <td>{task.item_name}</td>
                  <td>{task.quantity}</td>
                  <td>
                    <span className="pill" style={{
                      backgroundColor: task.status === 'completed' ? '#4caf50' : task.status === 'packed' ? '#2196f3' : task.status === 'cancelled' ? '#c62828' : '#ff9800'
                    }}>
                      {task.status}
                    </span>
                  </td>
                  <td>
                    {isOpen(task.status) ? (
                      <>
                        <ActionButton label="Mark item packed" busyLabel="Saving..." onAction={markTaskPacked.bind(null, task.id)} />
                      </>
                    ) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>No packing tasks are assigned to you.</p>
        )}
        <Pagination page={page} total={tasksCount ?? 0} param="page" searchParams={params} basePath="/manager" />
      </section>
    </main>
  );
}
