"use client";

import { useState } from "react";
import { addItem } from "./actions";

export function AddItemForm() {
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const formData = new FormData(e.currentTarget);
    try {
      await addItem(formData);
      setIsOpen(false);
      (e.target as HTMLFormElement).reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add item");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button onClick={() => setIsOpen(!isOpen)} className="primary" style={{ marginBottom: "1rem" }}>
        {isOpen ? "Cancel" : "Add Item"}
      </button>

      {isOpen && (
        <form onSubmit={handleSubmit} className="card" style={{ marginBottom: "1rem", padding: "1.5rem" }}>
          <h3>Add New Item</h3>
          {error && <p className="error" style={{ color: "#d32f2f", marginBottom: "1rem" }}>{error}</p>}

          <div style={{ marginBottom: "1rem" }}>
            <label>SKU *</label>
            <input type="text" name="sku" required placeholder="e.g., CLOTH-001" maxLength={100} />
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label>Item Name *</label>
            <input type="text" name="name" required placeholder="e.g., Cotton Cloth 5m" maxLength={200} />
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label>Description (Single Line)</label>
            <input type="text" name="description" placeholder="Optional short description" maxLength={500} />
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label>Full Description (Multi-line)</label>
            <textarea 
              name="descriptionFull" 
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
              placeholder="e.g., piece, meter, kg, liter" 
              maxLength={50}
              defaultValue="piece"
            />
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label>Price (₹) *</label>
            <input
              type="number"
              name="unitPricePaise"
              required
              placeholder="e.g., 500 for ₹500"
              min="0"
              step="0.01"
              onChange={(e) => {
                const rupees = parseFloat(e.currentTarget.value) || 0;
                const paise = Math.round(rupees * 100);
                e.currentTarget.value = paise.toString();
              }}
            />
            <small>Enter price in Rupees (will be stored in paise)</small>
          </div>

          <button type="submit" disabled={loading} className="primary">
            {loading ? "Adding..." : "Add Item"}
          </button>

          <small style={{ display: "block", marginTop: "1rem", color: "#666" }}>
            Note: Images can be added to this item after creation via the item management interface.
          </small>
        </form>
      )}
    </>
  );
}
