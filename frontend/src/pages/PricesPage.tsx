import { useState } from "react";
import { usePrices } from "../hooks/useEnergyData";
import PriceChart from "../components/charts/PriceChart";

const ZONES = ["DE_LU", "FR", "ES", "PT", "NL", "BE"];

const page: React.CSSProperties = { padding: 24 };
const title: React.CSSProperties = { fontSize: 20, fontWeight: 600, color: "#e2e8f0", marginBottom: 16 };
const select: React.CSSProperties = {
  background: "#1a1f2e", color: "#e2e8f0", border: "1px solid #2d3748",
  borderRadius: 6, padding: "6px 12px", fontSize: 13, marginBottom: 24,
};

export default function PricesPage() {
  const [zone, setZone] = useState("DE_LU");
  const { data, status } = usePrices(zone);

  return (
    <div style={page}>
      <h1 style={title}>Electricity Prices</h1>

      <select style={select} value={zone} onChange={(e) => setZone(e.target.value)}>
        {ZONES.map((z) => <option key={z}>{z}</option>)}
      </select>

      {status === "loading" && <p style={{ color: "#94a3b8" }}>Loading...</p>}
      {status === "error" && <p style={{ color: "#f56565" }}>Failed to load data.</p>}
      {data && (
        <>
          <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 16 }}>
            Actuals (7 days) + 48h ML forecast · zone <strong>{zone}</strong>
          </p>
          <PriceChart actuals={data.actuals} forecasts={data.forecasts} />
        </>
      )}
    </div>
  );
}
