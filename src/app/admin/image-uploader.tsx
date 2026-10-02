"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ImageModal } from "@/components/ImageModal";
import { deleteItemImage, setCoverImage, uploadItemImage } from "./actions";

type ItemForImages = { id: string; name: string; sku: string };
export type ItemImage = { id: string; image_url: string; alt_text: string | null; is_cover: boolean };

export function ImageUploader({ item, images }: { item: ItemForImages; images: ItemImage[] }) {
  const router = useRouter();
  const [imageType, setImageType] = useState<"cover" | "gallery">("gallery");
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const cover = images.find((i) => i.is_cover);
  const gallery = images.filter((i) => !i.is_cover);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setError(null);
    setSuccess(null);
    setLoading(true);
    try {
      const data = new FormData(form);
      data.set("itemId", item.id);
      data.set("imageType", imageType);
      await uploadItemImage(data);
      form.reset();
      setSuccess(imageType === "cover" ? "Cover image updated" : "Gallery image added");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload image");
    } finally {
      setLoading(false);
    }
  }

  async function run(id: string, action: () => Promise<void>, ok: string) {
    setError(null);
    setSuccess(null);
    setBusyId(id);
    try {
      await action();
      setSuccess(ok);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusyId(null);
    }
  }

  function thumb(image: ItemImage) {
    return (
      <div key={image.id} style={{ width: 110, textAlign: "center" }}>
        <ImageModal src={image.image_url} alt={image.alt_text ?? item.name} thumbStyle={{ width: 110, height: 110, border: image.is_cover ? "3px solid #2e7d32" : "1px solid #ddd" }} />
        {image.is_cover && <div style={{ fontSize: "0.75rem", color: "#2e7d32", fontWeight: 700 }}>COVER</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 4 }}>
          {!image.is_cover && (
            <button type="button" className="secondary" disabled={busyId === image.id} style={{ fontSize: "0.75rem", padding: "0.25rem" }} onClick={() => run(image.id, () => setCoverImage(image.id), "Cover image updated")}>
              Make cover
            </button>
          )}
          <button
            type="button"
            className="secondary"
            disabled={busyId === image.id}
            style={{ fontSize: "0.75rem", padding: "0.25rem", color: "#c62828" }}
            onClick={() => window.confirm("Remove this image permanently?") && run(image.id, () => deleteItemImage(image.id), "Image removed")}
          >
            {busyId === image.id ? "Working..." : "Remove"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: "1rem" }}>
      <p style={{ fontSize: "0.9rem", margin: "0 0 0.5rem" }}><strong>Cover image</strong> (shown in the buyer item list)</p>
      {cover ? <div style={{ display: "flex" }}>{thumb(cover)}</div> : <p style={{ color: "#777", fontSize: "0.9rem" }}>No cover image yet.</p>}

      <p style={{ fontSize: "0.9rem", margin: "1rem 0 0.5rem" }}><strong>Gallery images</strong> (shown under Show details)</p>
      {gallery.length ? <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>{gallery.map(thumb)}</div> : <p style={{ color: "#777", fontSize: "0.9rem" }}>No gallery images yet.</p>}

      <form onSubmit={handleSubmit} style={{ marginTop: "1rem", padding: "1rem", backgroundColor: "#f5f5f5", borderRadius: 4 }}>
        <p style={{ fontSize: "0.9rem", margin: "0 0 0.75rem" }}><strong>Upload image for {item.name}</strong></p>
        {error && <p style={{ color: "#d32f2f", fontSize: "0.9rem" }}>{error}</p>}
        {success && <p style={{ color: "#4caf50", fontSize: "0.9rem" }}>✓ {success}</p>}
        <div style={{ display: "flex", gap: "1rem", marginBottom: "0.75rem" }}>
          <label style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <input type="radio" checked={imageType === "cover"} onChange={() => setImageType("cover")} /> Cover (replaces current)
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <input type="radio" checked={imageType === "gallery"} onChange={() => setImageType("gallery")} /> Gallery
          </label>
        </div>
        <input type="file" name="file" accept="image/*" required style={{ width: "100%", marginBottom: "0.5rem" }} />
        <small style={{ color: "#666" }}>JPG, PNG, GIF, WebP (max 4MB)</small>
        <input type="text" name="altText" placeholder="Alt text (optional)" maxLength={200} style={{ width: "100%", margin: "0.5rem 0" }} />
        <button type="submit" disabled={loading}>{loading ? "Uploading..." : "Upload image"}</button>
      </form>
    </div>
  );
}
