interface Props {
  connected: boolean;
  lastUpdate: string | null;
}

export default function LiveBadge({ connected, lastUpdate }: Props) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#94a3b8" }}>
      <span
        style={{
          width: 8, height: 8, borderRadius: "50%",
          background: connected ? "#48bb78" : "#f56565",
          display: "inline-block",
        }}
      />
      <span>{connected ? "Live" : "Reconnecting..."}</span>
      {lastUpdate && <span style={{ color: "#4a5568" }}>· {lastUpdate}</span>}
    </div>
  );
}
