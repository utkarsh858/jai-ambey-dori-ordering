"use client";

import { useEffect, useState } from "react";

export function ImageModal({ src, alt, thumbStyle, caption }: { src: string; alt: string; thumbStyle?: React.CSSProperties; caption?: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} onClick={() => setOpen(true)} style={{ cursor: "zoom-in", objectFit: "cover", borderRadius: 4, ...thumbStyle }} />
      {open && (
        <div role="dialog" aria-modal="true" onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: "1rem" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} onClick={(e) => e.stopPropagation()} style={{ maxWidth: "92vw", maxHeight: "85vh", objectFit: "contain", background: "#fff", borderRadius: 6 }} />
          {caption && <p style={{ color: "#fff", marginTop: "0.5rem" }}>{caption}</p>}
          <button type="button" className="secondary" onClick={() => setOpen(false)} style={{ position: "absolute", top: 16, right: 16 }}>✕ Close</button>
        </div>
      )}
    </>
  );
}
