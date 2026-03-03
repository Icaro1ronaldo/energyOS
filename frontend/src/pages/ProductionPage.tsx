import { useState } from "react";
import { useProduction } from "../hooks/useEnergyData";
import ProductionChart from "../components/charts/ProductionChart";

const ZONES = ["DE_LU", "FR", "ES", "PT", "NL", "BE"];

const page: React.CSSProperties = { padding: 24 };
const title: React.CSSProperties = { fontSize: 20, fontWeight: 600, color: "#e2e8f0", marginBottom: 16 };
const select: React.CSSProperties = {
  background: "#1a1f2e", color: "#e2e8f0", border: "1px solid #2d3748",
  borderRadius: 6, padding: "6px 12px", fontSize: 13, marginBottom: 8,
};
const toggle: React.CSSProperties = {
  background: "transparent", color: "#94a3b8", border: "1px solid #2d3748",
  borderRadius: 6, padding: "6px 14px", fontSize: 13, cursor: "pointer", marginLeft: 12,
};
const toggleActive: React.CSSProperties = { ...toggle, background: "#2d3748", color: "#e2e8f0" };

export default function ProductionPage() {
  const [zone, setZone] = useState("DE_LU");
  const [showForecast, setShowForecast] = useState(false);
  const { data, status } = useProduction(zone);

  return (
    <div style={page}>
      <h1 style={title}>Energy Production by Type</h1>

      <div style={{ display: "flex", alignItems: "center", marginBottom: 24, gap: 4 }}>
        <select style={select} value={zone} onChange={(e) => setZone(e.target.value)}>
          {ZONES.map((z) => <option key={z}>{z}</option>)}
        </select>
        <button style={showForecast ? toggle : toggleActive} onClick={() => setShowForecast(false)}>
          Actuals
        </button>
        <button style={showForecast ? toggleActive : toggle} onClick={() => setShowForecast(true)}>
          Forecast
        </button>
      </div>

      {status === "loading" && <p style={{ color: "#94a3b8" }}>Loading...</p>}
      {status === "error" && <p style={{ color: "#f56565" }}>Failed to load data.</p>}
      {data && data.length > 0 && (
        <>
          <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 16 }}>
            {showForecast ? "48h ML forecast" : "Actuals (7 days)"} · zone <strong>{zone}</strong>
            {" "}· {data.length} production types
          </p>
          <ProductionChart data={data} showForecast={showForecast} />
        </>
      )}
      {data && data.length === 0 && (
        <p style={{ color: "#4a5568" }}>No production data available for {zone} yet.</p>
      )}
    </div>
  );
}
