import { useState } from "react";
import { subDays, addHours } from "date-fns";
import { useProduction } from "../hooks/useEnergyData";
import ProductionChart from "../components/charts/ProductionChart";
import DateRangePicker from "../components/DateRangePicker";

const ZONES = ["DE_LU", "FR", "ES", "PT", "NL", "BE"];

const page: React.CSSProperties = { padding: 24 };
const title: React.CSSProperties = { fontSize: 20, fontWeight: 600, color: "#e2e8f0", marginBottom: 16 };
const select: React.CSSProperties = {
  background: "#1a1f2e", color: "#e2e8f0", border: "1px solid #2d3748",
  borderRadius: 6, padding: "6px 12px", fontSize: 13,
};
const toggle: React.CSSProperties = {
  background: "transparent", color: "#94a3b8", border: "1px solid #2d3748",
  borderRadius: 6, padding: "6px 14px", fontSize: 13, cursor: "pointer",
};
const toggleActive: React.CSSProperties = { ...toggle, background: "#2d3748", color: "#e2e8f0" };

export default function ProductionPage() {
  const [zone, setZone] = useState("DE_LU");
  const [showForecast, setShowForecast] = useState(false);
  const [startDate, setStartDate] = useState(() => subDays(new Date(), 7));
  const [endDate, setEndDate] = useState(() => new Date());

  const startIso = startDate.toISOString();
  const endIso = addHours(endDate, 24).toISOString();

  const { data, status } = useProduction(zone, startIso, endIso);

  return (
    <div style={page}>
      <h1 style={title}>Energy Production by Type</h1>

      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 24 }}>
        <select style={select} value={zone} onChange={(e) => setZone(e.target.value)}>
          {ZONES.map((z) => <option key={z}>{z}</option>)}
        </select>
        <button style={showForecast ? toggle : toggleActive} onClick={() => setShowForecast(false)}>
          Actuals
        </button>
        <button style={showForecast ? toggleActive : toggle} onClick={() => setShowForecast(true)}>
          Forecast
        </button>
        <DateRangePicker
          start={startDate}
          end={endDate}
          onChange={(s, e) => { setStartDate(s); setEndDate(e); }}
        />
      </div>

      {status === "loading" && <p style={{ color: "#94a3b8" }}>Loading...</p>}
      {status === "error" && <p style={{ color: "#f56565" }}>Failed to load data.</p>}
      {data && data.length > 0 && (
        <>
          <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 16 }}>
            {showForecast ? "48h ML forecast" : `${startDate.toLocaleDateString()} → ${endDate.toLocaleDateString()}`}
            {" "}· zone <strong>{zone}</strong> · {data.length} production types
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
