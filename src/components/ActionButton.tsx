"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ActionButton({ label, busyLabel, confirmText, onAction, danger, className }: {
  label: string;
  busyLabel?: string;
  confirmText?: string;
  onAction: () => Promise<void>;
  danger?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function click() {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true);
    setError(null);
    try {
      await onAction();
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className={className} disabled={busy} onClick={click} style={{ fontSize: "0.85rem", padding: "0.35rem 0.8rem", ...(danger ? { background: "#c62828", color: "#fff" } : {}) }}>
        {busy ? busyLabel ?? "Working..." : label}
      </button>
      {error && <small style={{ color: "#d32f2f", display: "block" }}>{error}</small>}
    </>
  );
}
