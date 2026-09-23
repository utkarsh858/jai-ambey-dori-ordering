"use client";

import { useState } from "react";
import { createOrder } from "@/app/buyer/actions";

type Item = { id: string; sku: string; name: string; unit_price_paise: number };
export function OrderForm({ items }: { items: Item[] }) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [method, setMethod] = useState<"razorpay" | "pay_later">("pay_later");
  const [message, setMessage] = useState("");
  async function submit() {
    try {
      const order = await createOrder({ paymentMethod: method, lines: Object.entries(quantities).filter(([, q]) => q > 0).map(([item_id, quantity]) => ({ item_id, quantity })) });
      setMessage(order ? `Order ${order.order_number} reserved successfully.` : "Order reserved.");
      setQuantities({});
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to place order"); }
  }
  return <section className="card"><h2>New order</h2><div className="stack">{items.map((item) => <label className="item" key={item.id}><span><strong>{item.name}</strong><small>{item.sku} · ₹{(item.unit_price_paise / 100).toFixed(2)}</small></span><input aria-label={`Quantity for ${item.name}`} type="number" min="0" value={quantities[item.id] ?? 0} onChange={(e) => setQuantities({ ...quantities, [item.id]: Number(e.target.value) })} /></label>)}</div><fieldset><legend>Payment</legend><label><input type="radio" checked={method === "pay_later"} onChange={() => setMethod("pay_later")} /> Pay later</label><label><input type="radio" checked={method === "razorpay"} onChange={() => setMethod("razorpay")} /> Razorpay</label></fieldset><button onClick={submit}>Reserve stock & place order</button>{message && <p className="notice">{message}</p>}</section>;
}
