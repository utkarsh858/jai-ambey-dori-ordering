"use client";

import { useEffect, useState } from "react";

export type SimpleImage = { id: string; image_url: string; alt_text: string | null; is_cover: boolean };

export function ItemCodeButton({ sku, itemName, images }: { sku: string; itemName: string; images: SimpleImage[] }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(0);
  const sorted = [...images].sort((a, b) => Number(b.is_cover) - Number(a.is_cover));

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button type="button" onClick={() => { setSelected(0); setOpen(true); }} style={{ background: "none", border: "none", padding: 0, color: "#1976d2", textDecoration: "underline", cursor: "pointer", font: "inherit" }}>
        {sku}
      </button>
      {open && (
        <div role="dialog" aria-modal="true" onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: "1rem" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", color: "#222", borderRadius: 8, padding: "1rem", maxWidth: 720, width: "100%", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <strong>{itemName} ({sku})</strong>
              <button type="button" className="secondary" onClick={() => setOpen(false)}>✕</button>
            </div>
            {sorted.length ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={sorted[selected]?.image_url} alt={sorted[selected]?.alt_text ?? itemName} style={{ width: "100%", maxHeight: "65vh", objectFit: "contain", marginTop: "0.5rem" }} />
                {sorted.length > 1 && (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                    {sorted.map((img, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={img.id} src={img.image_url} alt="" onClick={() => setSelected(i)} style={{ width: 64, height: 64, objectFit: "cover", cursor: "pointer", borderRadius: 4, border: i === selected ? "3px solid #1976d2" : "1px solid #ddd" }} />
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p style={{ color: "#777" }}>No image available for this item.</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
