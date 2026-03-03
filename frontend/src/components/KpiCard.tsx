interface Props {
  label: string;
  value: string;
  unit?: string;
  trend?: "up" | "down" | "flat";
}

const trendColor = { up: "#f56565", down: "#48bb78", flat: "#94a3b8" } as const;
const trendIcon = { up: "▲", down: "▼", flat: "—" } as const;

export default function KpiCard({ label, value, unit, trend }: Props) {
  return (
    <div
      style={{
        background: "#1a1f2e", border: "1px solid #2d3748", borderRadius: 8,
        padding: "20px 24px", minWidth: 180,
      }}
    >
      <div style={{ fontSize: 12, color: "#94a3b8", marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: "#e2e8f0" }}>
        {value}
        {unit && <span style={{ fontSize: 14, color: "#94a3b8", marginLeft: 4 }}>{unit}</span>}
      </div>
      {trend && (
        <div style={{ fontSize: 12, color: trendColor[trend], marginTop: 6 }}>
          {trendIcon[trend]} {trend}
        </div>
      )}
    </div>
  );
}
