interface Props {
  connected: boolean;
  lastUpdate: string | null;
}

export default function LiveBadge({ connected }: Props) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
      <span style={{
        width: 7, height: 7, borderRadius: "50%",
        background: connected ? "#30d158" : "#ff453a",
        display: "inline-block",
        boxShadow: connected ? "0 0 6px #30d158" : "0 0 6px #ff453a",
      }} />
      <span style={{ color: connected ? "rgba(255,255,255,0.8)" : "#ff6b6b", fontWeight: connected ? 400 : 500 }}>
        {connected ? "Live" : "Reconnecting…"}
      </span>
    </div>
  );
}
