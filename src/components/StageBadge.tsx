import { stageColor, stageLabel } from "@/lib/stages";

export function StageBadge({ stage }: { stage: string }) {
  return (
    <span className="pill" style={{ background: stageColor(stage), color: "#fff", textTransform: "none", whiteSpace: "nowrap" }}>
      {stageLabel(stage)}
    </span>
  );
}
