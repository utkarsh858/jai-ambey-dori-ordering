"use client";

import { useState } from "react";
import { addItemImage, uploadItemImage } from "./actions";

type ItemForImages = { id: string; name: string; sku: string };

export function ImageUploader({ item }: { item: ItemForImages }) {
  const [uploadMode, setUploadMode] = useState<"url" | "file">("url");
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [altText, setAltText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);

    try {
      if (uploadMode === "url") {
        if (!imageUrl.trim()) {
          throw new Error("Image URL is required");
        }
        await addItemImage(item.id, imageUrl, altText);
      } else {
        if (!imageFile) {
          throw new Error("Please select an image file");
        }
        await uploadItemImage(item.id, imageFile, altText);
      }
      
      setImageUrl("");
      setImageFile(null);
      setAltText("");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add image");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: "1rem", padding: "1rem", backgroundColor: "#f5f5f5", borderRadius: "4px" }}>
      <p style={{ fontSize: "0.9rem", margin: "0 0 1rem 0" }}>
        <strong>Add image to {item.name}</strong>
      </p>
      
      {error && <p style={{ color: "#d32f2f", marginBottom: "1rem", fontSize: "0.9rem" }}>{error}</p>}
      {success && <p style={{ color: "#4caf50", marginBottom: "1rem", fontSize: "0.9rem" }}>✓ Image added successfully</p>}

      <div style={{ marginBottom: "1rem", display: "flex", gap: "1rem", borderBottom: "1px solid #ddd", paddingBottom: "1rem" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
          <input
            type="radio"
            checked={uploadMode === "url"}
            onChange={() => setUploadMode("url")}
          />
          From URL
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer" }}>
          <input
            type="radio"
            checked={uploadMode === "file"}
            onChange={() => setUploadMode("file")}
          />
          From device
        </label>
      </div>

      {uploadMode === "url" ? (
        <div style={{ marginBottom: "0.75rem" }}>
          <input
            type="url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="Image URL (e.g., https://example.com/image.jpg)"
            required
            style={{ width: "100%", padding: "0.5rem", border: "1px solid #ddd", borderRadius: "4px" }}
          />
        </div>
      ) : (
        <div style={{ marginBottom: "0.75rem" }}>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setImageFile(e.target.files?.[0] || null)}
            required
            style={{ width: "100%", padding: "0.5rem", border: "1px solid #ddd", borderRadius: "4px" }}
          />
          <small style={{ color: "#666" }}>Supported: JPG, PNG, GIF, WebP (max 5MB)</small>
        </div>
      )}

      <div style={{ marginBottom: "0.75rem" }}>
        <input
          type="text"
          value={altText}
          onChange={(e) => setAltText(e.target.value)}
          placeholder="Alt text (optional, e.g., 'Product photo')"
          maxLength={200}
          style={{ width: "100%", padding: "0.5rem", border: "1px solid #ddd", borderRadius: "4px" }}
        />
      </div>

      <button type="submit" disabled={loading} style={{ padding: "0.5rem 1rem", fontSize: "0.9rem" }}>
        {loading ? "Adding..." : "Add Image"}
      </button>
    </form>
  );
}
