"use client";

import { useState } from "react";
import { EditItemForm } from "./edit-item-form";

interface Item {
  id: string;
  sku: string;
  name: string;
  description?: string | null;
  description_full?: string | null;
  uom?: string | null;
  unit_price_paise: number;
}

export function EditItemSection({ items }: { items: Item[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <section style={{ marginTop: "2rem" }}>
      <h2>Edit existing items</h2>
      {items && items.length > 0 ? (
        <div>
          {items.map((item) => (
            <div key={item.id} style={{ marginBottom: "1rem", borderBottom: "1px solid #eee", paddingBottom: "1rem" }}>
              {editingId === item.id ? (
                <EditItemForm
                  item={item}
                  onClose={() => setEditingId(null)}
                />
              ) : (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: "1rem" }}>
                  <div>
                    <h4 style={{ margin: "0 0 0.5rem 0" }}>{item.name}</h4>
                    <p style={{ margin: "0.25rem 0", fontSize: "0.9rem", color: "#666" }}>
                      <strong>SKU:</strong> {item.sku}
                    </p>
                    <p style={{ margin: "0.25rem 0", fontSize: "0.9rem", color: "#666" }}>
                      <strong>Price:</strong> ₹{(item.unit_price_paise / 100).toFixed(2)}
                    </p>
                    {item.uom && (
                      <p style={{ margin: "0.25rem 0", fontSize: "0.9rem", color: "#666" }}>
                        <strong>UOM:</strong> {item.uom}
                      </p>
                    )}
                    {item.description && (
                      <p style={{ margin: "0.25rem 0", fontSize: "0.9rem", color: "#666" }}>
                        <strong>Description:</strong> {item.description}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setEditingId(item.id)}
                    className="primary"
                    style={{ padding: "0.5rem 1rem", whiteSpace: "nowrap" }}
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p>No items available to edit.</p>
      )}
    </section>
  );
}
