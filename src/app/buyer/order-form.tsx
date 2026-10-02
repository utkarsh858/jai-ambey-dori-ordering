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

export function OrderForm({ items, stock }: { items: Item[]; stock: Record<string, number> }) {
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [method, setMethod] = useState<"razorpay" | "pay_later">("pay_later");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [expandedItem, setExpandedItem] = useState<string | null>(null);

  async function submit() {
    const over = items.filter((i) => (quantities[i.id] ?? 0) > (stock[i.id] ?? 0));
    if (over.length) {
      setMessage(over.map((i) => `${i.name}: ordered ${quantities[i.id]}, only ${stock[i.id] ?? 0} available`).join("\n"));
      setMessageType("error");
      return;
    }
    if (!Object.values(quantities).some((q) => q > 0)) {
      setMessage("Select a quantity for at least one item.");
      setMessageType("error");
      return;
    }
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
      let errorMsg = error instanceof Error ? error.message : "Unable to place order";
      
      // Parse stock error and provide detailed feedback
      if (errorMsg.includes("Insufficient stock")) {
        const match = errorMsg.match(/Insufficient stock for (\w+)/);
        if (match) {
          const sku = match[1];
          const item = items.find(i => i.sku === sku);
          if (item) {
            const available = stock[item.id] ?? 0;
            const ordered = quantities[item.id] ?? 0;
            const overOrdered = ordered - available;
            errorMsg = `❌ Insufficient stock for ${item.name} (SKU: ${sku})\n\n📊 Stock Details:\n• Available: ${available} units\n• You ordered: ${ordered} units\n• Over-ordered by: ${overOrdered} units\n\nPlease reduce quantity or try again later.`;
          }
        }
      }
      
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
                <div style={{ marginTop: "0.25rem", fontSize: "0.9rem", fontWeight: 600, color: (stock[item.id] ?? 0) > 0 ? "#2e7d32" : "#c62828" }}>
                  {(stock[item.id] ?? 0) > 0 ? `Available: ${stock[item.id]}${item.uom ? ` ${item.uom}` : ""}` : "Out of stock"}
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
                max={stock[item.id] ?? 0}
                step="1"
                disabled={(stock[item.id] ?? 0) <= 0}
                value={quantities[item.id] ?? 0} 
                onChange={(e) => {
                  const max = stock[item.id] ?? 0;
                  const value = Math.max(0, Math.floor(Number(e.target.value) || 0));
                  setQuantities({ ...quantities, [item.id]: Math.min(value, max) });
                }}
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
        <div style={{
          backgroundColor: messageType === "error" ? "#ffebee" : "#e8f5e9",
          color: messageType === "error" ? "#c62828" : "#2e7d32",
          padding: "1rem",
          borderRadius: "4px",
          borderLeft: `4px solid ${messageType === "error" ? "#c62828" : "#2e7d32"}`,
          marginTop: "1rem",
          whiteSpace: "pre-wrap",
          fontFamily: messageType === "error" ? "system-ui, -apple-system, sans-serif" : "inherit",
          fontSize: "0.95rem",
          lineHeight: "1.6"
        }}>
          {message}
        </div>
      )}
    </section>
  );
}
