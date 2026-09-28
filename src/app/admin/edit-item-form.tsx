"use client";

import { useState } from "react";
import { editItem } from "./actions";

interface EditItemFormProps {
  item: {
    id: string;
    sku: string;
    name: string;
    description?: string | null;
    description_full?: string | null;
    uom?: string | null;
    unit_price_paise: number;
  };
  onClose: () => void;
}

export function EditItemForm({ item, onClose }: EditItemFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    formData.append("itemId", item.id);

    try {
      await editItem(formData);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update item");
    } finally {
      setLoading(false);
    }
  }

  const priceInRupees = (item.unit_price_paise / 100).toFixed(2);

  return (
    <form onSubmit={handleSubmit} className="card" style={{ padding: "1.5rem", marginBottom: "1rem", backgroundColor: "#f9f9f9" }}>
      <h3>Edit Item</h3>
      {error && <p className="error" style={{ color: "#d32f2f", marginBottom: "1rem" }}>{error}</p>}

      <div style={{ marginBottom: "1rem" }}>
        <label>SKU *</label>
        <input type="text" name="sku" required defaultValue={item.sku} placeholder="e.g., CLOTH-001" maxLength={100} />
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <label>Item Name *</label>
        <input type="text" name="name" required defaultValue={item.name} placeholder="e.g., Cotton Cloth 5m" maxLength={200} />
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <label>Description (Single Line)</label>
        <input type="text" name="description" defaultValue={item.description || ""} placeholder="Optional short description" maxLength={500} />
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <label>Full Description (Multi-line)</label>
        <textarea 
          name="descriptionFull" 
          defaultValue={item.description_full || ""}
          placeholder="Optional detailed description (supports multiple lines, spaces, and indents)" 
          maxLength={5000}
          rows={5}
          style={{ 
            fontFamily: "monospace", 
            whiteSpace: "pre-wrap",
            width: "100%",
            padding: "0.5rem",
            border: "1px solid #ddd",
            borderRadius: "4px"
          }} 
        />
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <label>Unit of Measurement (UOM) *</label>
        <input 
          type="text" 
          name="uom" 
          required 
          defaultValue={item.uom || "piece"}
          placeholder="e.g., piece, meter, kg, liter" 
          maxLength={50}
        />
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <label>Price (₹) *</label>
        <input
          type="number"
          name="unitPricePaise"
          required
          defaultValue={priceInRupees}
          placeholder="e.g., 500 or 500.50"
          min="0"
          step="0.01"
        />
        <small>Enter price in Rupees (e.g., 500 for ₹500, or 500.50 for ₹500.50)</small>
      </div>

      <div style={{ display: "flex", gap: "1rem" }}>
        <button type="submit" disabled={loading} className="primary">
          {loading ? "Saving..." : "Save Changes"}
        </button>
        <button type="button" onClick={onClose} className="secondary">
          Cancel
        </button>
      </div>
    </form>
  );
}
