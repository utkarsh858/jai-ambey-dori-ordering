"use client";

import { useState } from "react";
import { adjustAssignedInventory } from "./actions";

interface ManagerStockAdjusterProps {
  itemId: string;
  itemName?: string;
  itemSku?: string;
  currentQuantity?: number;
}

export function ManagerStockAdjuster({ itemId }: ManagerStockAdjusterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData();
    formData.append("itemId", itemId);
    formData.append("quantityDelta", delta);
    formData.append("reason", reason);

    try {
      await adjustAssignedInventory(formData);
      setIsOpen(false);
      setDelta("");
      setReason("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to adjust stock");
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) {
    return (
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <button onClick={() => setIsOpen(true)} className="secondary" style={{ padding: "0.4rem 0.8rem", fontSize: "0.9rem" }}>
          Adjust stock
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "0.5rem", padding: "0.75rem", backgroundColor: "#f5f5f5", borderRadius: "4px", minWidth: "300px" }}>
      {error && <p style={{ color: "#d32f2f", margin: 0, fontSize: "0.9rem" }}>{error}</p>}
      
      <div>
        <label style={{ fontSize: "0.9rem", display: "block", marginBottom: "0.25rem" }}>
          <strong>Adjustment</strong>
        </label>
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <input
            type="number"
            value={delta}
            onChange={(e) => setDelta(e.target.value)}
            placeholder="Qty (+ or -)"
            required
            style={{ width: "80px", padding: "0.4rem" }}
          />
          <small style={{ color: "#666" }}>
            Positive to add, negative to remove
          </small>
        </div>
      </div>

      <div>
        <label style={{ fontSize: "0.9rem", display: "block", marginBottom: "0.25rem" }}>
          <strong>Reason</strong>
        </label>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g., Damaged, Miscount, etc."
          required
          minLength={3}
          maxLength={500}
          style={{ width: "100%", padding: "0.4rem" }}
        />
      </div>

      <div style={{ display: "flex", gap: "0.5rem" }}>
        <button type="submit" disabled={loading} className="primary" style={{ padding: "0.4rem 0.8rem", fontSize: "0.9rem" }}>
          {loading ? "Saving..." : "Adjust"}
        </button>
        <button type="button" onClick={() => setIsOpen(false)} className="secondary" style={{ padding: "0.4rem 0.8rem", fontSize: "0.9rem" }}>
          Cancel
        </button>
      </div>
    </form>
  );
}
