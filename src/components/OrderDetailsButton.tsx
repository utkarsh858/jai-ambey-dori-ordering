"use client";

import { useEffect, useState } from "react";

export type OrderLine = { item_name: string; sku: string; quantity: number; unit_price_paise: number; packed?: boolean };
export type OrderDetails = {
  order_number: string;
  status: string;
  payment_method?: string | null;
  total_paise: number;
  created_at_ist: string;
  buyer_code?: string | null;
  cancellation_reason?: string | null;
  lines: OrderLine[];
};

export function OrderDetailsButton({ order }: { order: OrderDetails }) {
  const [open, setOpen] = useState(false);
  const hasPacking = order.lines.some((l) => l.packed !== undefined);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ background: "none", border: "none", padding: 0, color: "#1976d2", textDecoration: "underline", cursor: "pointer", fontWeight: 700, font: "inherit" }}
      >
        {order.order_number}
      </button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Order ${order.order_number}`}
          onClick={() => setOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "1rem" }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: "#fff", color: "#222", borderRadius: 8, padding: "1.5rem", width: "100%", maxWidth: 640, maxHeight: "85vh", overflowY: "auto" }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ margin: 0 }}>Order {order.order_number}</h2>
              <button type="button" className="secondary" onClick={() => setOpen(false)} aria-label="Close">✕</button>
            </div>
            <p style={{ lineHeight: 1.7 }}>
              <strong>Date &amp; time:</strong> {order.created_at_ist}
              <br />
              <strong>Status:</strong> {order.status.replace("_", " ")}
              {order.payment_method && (<><br /><strong>Payment:</strong> {order.payment_method.replace("_", " ")}</>)}
              {order.buyer_code && (<><br /><strong>Buyer code:</strong> {order.buyer_code}</>)}
              {order.cancellation_reason && (<><br /><strong>Cancellation reason:</strong> {order.cancellation_reason}</>)}
            </p>
            <table style={{ width: "100%" }}>
              <thead>
                <tr><th>Item</th><th>SKU</th><th>Qty</th><th>Unit price</th><th>Subtotal</th>{hasPacking && <th>Packed</th>}</tr>
              </thead>
              <tbody>
                {order.lines.map((line, i) => (
                  <tr key={i}>
                    <td>{line.item_name}</td>
                    <td>{line.sku}</td>
                    <td>{line.quantity}</td>
                    <td>₹{(line.unit_price_paise / 100).toFixed(2)}</td>
                    <td>₹{((line.unit_price_paise * line.quantity) / 100).toFixed(2)}</td>
                    {hasPacking && (
                      <td style={{ color: line.packed ? "#2e7d32" : "#c62828", fontWeight: 700 }}>{line.packed ? "✓ Packed" : "✗ Not packed"}</td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            <p style={{ textAlign: "right", fontWeight: 700 }}>Total: ₹{(order.total_paise / 100).toFixed(2)}</p>
          </div>
        </div>
      )}
    </>
  );
}
