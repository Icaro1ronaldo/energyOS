interface Props {
  label: string;
  value: string;
  unit?: string;
  trend?: "up" | "down" | "flat";
}

const trendColor = { up: "#ff3b30", down: "#34c759", flat: "#aeaeb2" } as const;
const trendIcon  = { up: "↑", down: "↓", flat: "→" } as const;

export default function KpiCard({ label, value, unit, trend }: Props) {
  return (
    <div style={{
      background: "#fff",
      border: "1px solid rgba(0,0,0,0.07)",
      borderRadius: 14,
      padding: "22px 24px",
      minWidth: 180,
      flex: 1,
      boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 14px rgba(0,0,0,0.04)",
    }}>
      <div style={{ fontSize: 11, fontWeight: 500, color: "#6e6e73", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.6px" }}>
        {label}
      </div>
      <div style={{ fontSize: 30, fontWeight: 600, color: "#1d1d1f", letterSpacing: "-1px", lineHeight: 1 }}>
        {value}
        {unit && <span style={{ fontSize: 13, fontWeight: 400, color: "#6e6e73", marginLeft: 5, letterSpacing: 0 }}>{unit}</span>}
      </div>
      {trend && (
        <div style={{ fontSize: 12, color: trendColor[trend], marginTop: 8, fontWeight: 500 }}>
          {trendIcon[trend]} {trend}
        </div>
      )}
    </div>
  );
}
