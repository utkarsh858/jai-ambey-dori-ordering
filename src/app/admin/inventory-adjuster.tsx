"use client";

import { useState } from "react";
import { setInventoryQuantity } from "./actions";

interface InventoryItemProps {
  itemId: string;
  itemName: string;
  itemSku: string;
  currentQuantity: number;
}

export function InventoryAdjuster({ itemId, itemName, itemSku, currentQuantity }: InventoryItemProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [quantity, setQuantity] = useState(currentQuantity.toString());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    setError(null);
    setLoading(true);

    const formData = new FormData();
    formData.append("itemId", itemId);
    formData.append("quantity", quantity);

    try {
      await setInventoryQuantity(formData);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update inventory");
    } finally {
      setLoading(false);
    }
  }

  if (!isEditing) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "0.75rem",
          borderBottom: "1px solid #e0e0e0",
        }}
      >
        <div>
          <strong>{itemName}</strong>
          <br />
          <small>{itemSku}</small>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "1.2rem", fontWeight: "bold" }}>{currentQuantity}</div>
          <button onClick={() => setIsEditing(true)} className="link-button">
            Edit
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: "1rem",
        borderBottom: "1px solid #e0e0e0",
        backgroundColor: "#f5f5f5",
      }}
    >
      {error && <p style={{ color: "#d32f2f", marginBottom: "0.5rem" }}>{error}</p>}
      <div>
        <strong>{itemName}</strong> <small>({itemSku})</small>
      </div>
      <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <input
          type="number"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          min="0"
          style={{ width: "100px" }}
        />
        <button onClick={handleSave} disabled={loading} className="primary" style={{ padding: "0.5rem 1rem" }}>
          {loading ? "Saving..." : "Save"}
        </button>
        <button onClick={() => setIsEditing(false)} className="secondary" style={{ padding: "0.5rem 1rem" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}
