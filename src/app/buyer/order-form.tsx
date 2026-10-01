"use client";

import { useState } from "react";
import { createOrder } from "@/app/buyer/actions";

type Item = { 
  id: string; 
  sku: string; 
  name: string; 
  description?: string | null;
  description_full?: string | null;
  uom?: string | null;
  unit_price_paise: number 
};

export function OrderForm({ items }: { items: Item[] }) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [method, setMethod] = useState<"razorpay" | "pay_later">("pay_later");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  async function submit() {
    try {
      const order = await createOrder({ 
        paymentMethod: method, 
        lines: Object.entries(quantities)
          .filter(([, q]) => q > 0)
          .map(([item_id, quantity]) => ({ item_id, quantity }))
      });
      setMessage(order ? `Order ${order.order_number} reserved successfully.` : "Order reserved.");
      setMessageType("success");
      setQuantities({});
    } catch (error) { 
      const errorMsg = error instanceof Error ? error.message : "Unable to place order";
      setMessage(errorMsg); 
      setMessageType("error");
    }
  }

  return (
    <section className="card">
      <h2>New order</h2>
      <div className="stack">
        {items.map((item) => (
          <div key={item.id} className="item-card" style={{ border: "1px solid #ddd", borderRadius: "4px", padding: "1rem", marginBottom: "1rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: "1rem" }}>
              <div style={{ flex: 1 }}>
                <strong style={{ fontSize: "1.1rem" }}>{item.name}</strong>
                <div style={{ marginTop: "0.5rem", color: "#666", fontSize: "0.9rem" }}>
                  {item.sku} · ₹{(item.unit_price_paise / 100).toFixed(2)}
                  {item.uom && <span> · {item.uom}</span>}
                </div>
                {item.description && (
                  <div style={{ marginTop: "0.5rem", color: "#777", fontSize: "0.9rem" }}>
                    {item.description}
                  </div>
                )}
                {item.description_full && (
                  <button
                    type="button"
                    onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#1976d2",
                      cursor: "pointer",
                      padding: "0.25rem 0",
                      textDecoration: "underline",
                      marginTop: "0.5rem",
                      fontSize: "0.9rem"
                    }}
                  >
                    {expandedItem === item.id ? "Hide details" : "Show details"}
                  </button>
                )}
              </div>
              <input 
                aria-label={`Quantity for ${item.name}`} 
                type="number" 
                min="0" 
                value={quantities[item.id] ?? 0} 
                onChange={(e) => setQuantities({ ...quantities, [item.id]: Number(e.target.value) })}
                style={{ width: "5rem" }}
              />
            </div>
            {expandedItem === item.id && item.description_full && (
              <div style={{
                marginTop: "1rem",
                paddingTop: "1rem",
                borderTop: "1px solid #eee",
                whiteSpace: "pre-wrap",
                fontFamily: "monospace",
                fontSize: "0.9rem",
                color: "#555",
                lineHeight: "1.5"
              }}>
                {item.description_full}
              </div>
            )}
          </div>
        ))}
      </div>
      <fieldset>
        <legend>Payment</legend>
        <label>
          <input type="radio" checked={method === "pay_later"} onChange={() => setMethod("pay_later")} /> Pay later
        </label>
        <label>
          <input type="radio" checked={method === "razorpay"} onChange={() => setMethod("razorpay")} /> Razorpay
        </label>
      </fieldset>
      <button onClick={submit}>Reserve stock & place order</button>
      {message && (
        <p className="notice" style={{
          backgroundColor: messageType === "error" ? "#ffebee" : "#e8f5e9",
          color: messageType === "error" ? "#c62828" : "#2e7d32",
          padding: "1rem",
          borderRadius: "4px",
          borderLeft: `4px solid ${messageType === "error" ? "#c62828" : "#2e7d32"}`,
          marginTop: "1rem"
        }}>
          {messageType === "error" ? "❌ " : "✅ "}{message}
        </p>
      )}
    </section>
  );
}
