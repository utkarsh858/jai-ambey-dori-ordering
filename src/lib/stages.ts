export type OrderStage = "placed" | "approved" | "packed_ready" | "dispatch_approved";

export const STAGES: { key: OrderStage; label: string }[] = [
  { key: "placed", label: "Placed" },
  { key: "approved", label: "Approved" },
  { key: "packed_ready", label: "Packed and ready" },
  { key: "dispatch_approved", label: "Approved for dispatch" },
];

export function stageLabel(stage: string | null | undefined): string {
  return STAGES.find((s) => s.key === stage)?.label ?? "Placed";
}

export function stageIndex(stage: string | null | undefined): number {
  return Math.max(0, STAGES.findIndex((s) => s.key === stage));
}

// An item's stage follows its order, except that a packed item shows "Packed and ready" once the order is approved.
export function itemStage(orderStage: string, packed: boolean): OrderStage {
  if (orderStage === "dispatch_approved") return "dispatch_approved";
  if (packed) return "packed_ready";
  return orderStage === "placed" ? "placed" : "approved";
}

const COLORS = ["#757575", "#1976d2", "#f57c00", "#2e7d32"];
export function stageColor(stage: string | null | undefined): string {
  return COLORS[stageIndex(stage)];
}
