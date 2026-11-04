import { AutoRefresh } from "@/components/AutoRefresh";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OrderForm } from "@/app/buyer/order-form";
import { signOut } from "@/app/auth/actions";
import { Pagination } from "@/components/Pagination";
import { ExportOrders } from "@/components/ExportOrders";
import { formatIST } from "@/lib/datetime";
import { StageBadge } from "@/components/StageBadge";
import { OrderDetailsButton } from "@/components/OrderDetailsButton";
import { ORDER_COLUMNS, toOrderDetailsWithPacking } from "@/lib/order-details";
import { pageRange, parsePage } from "@/lib/pagination";

export default async function BuyerPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const page = parsePage(params.page);
  const { from, to } = pageRange(page);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [{ data: profile }, { data: items }, { data: inventory }, { data: orders, count: ordersCount }] = await Promise.all([
    user ? supabase.from("profiles").select("full_name").eq("id", user.id).single() : { data: null },
    supabase.from("items").select("id,sku,name,description,description_full,uom,unit_price_paise,items_images(id,image_url,alt_text,is_cover,display_order)").eq("active", true).order("name"),
    supabase.rpc("get_available_stock"),
    supabase.from("orders").select(ORDER_COLUMNS, { count: "exact" }).order("created_at", { ascending: false }).range(from, to),
  ]);
  if (!profile) redirect("/dashboard");

  const { data: stageRows } = orders?.length
    ? await supabase.rpc("get_order_item_stages", { p_order_ids: orders.map((o) => o.id) })
    : { data: [] };
  const packedByOrder = new Map<string, Set<string>>();
  (stageRows ?? []).forEach((r: { order_id: string; item_id: string; is_packed: boolean }) => {
    if (r.is_packed) packedByOrder.set(r.order_id, (packedByOrder.get(r.order_id) ?? new Set<string>()).add(r.item_id));
  });
  
  // Create inventory map for easy lookup
  const stock: Record<string, number> = Object.fromEntries(
    (inventory ?? []).map((inv: { item_id: string; available_quantity: number }) => [inv.item_id, inv.available_quantity])
  );
  
  return (
    <main>
      <AutoRefresh seconds={10} />
      <header>
        <div>
          <p className="eyebrow">BUYER PORTAL</p>
          <h1>Welcome, {profile.full_name ?? "Buyer"}</h1>
        </div>
        <form action={signOut}>
          <button className="secondary">Sign out</button>
        </form>
      </header>
      <OrderForm items={items ?? []} stock={stock} />
      <section className="card">
        <h2>Your orders</h2>
        <ExportOrders />
        <table>
          <thead>
            <tr>
              <th>Order</th>
              <th>Date &amp; time (IST)</th>
              <th>Status</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            {orders?.map((order) => (
              <tr key={order.order_number}>
                <td><OrderDetailsButton order={toOrderDetailsWithPacking(order as never, false, packedByOrder.get(order.id) ?? new Set())} /></td>
                <td>{formatIST(order.created_at)}</td>
                <td>{order.status === "cancelled" ? <span className="pill">cancelled</span> : <StageBadge stage={order.stage ?? "placed"} />}</td>
                <td>₹{(order.total_paise / 100).toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination page={page} total={ordersCount ?? 0} param="page" searchParams={params} basePath="/buyer" />
      </section>
    </main>
  );
}
