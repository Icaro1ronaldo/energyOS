import { useState } from "react";
import { subDays, addHours } from "date-fns";
import { useLoad } from "../hooks/useEnergyData";
import LoadChart from "../components/charts/LoadChart";
import DateRangePicker from "../components/DateRangePicker";

const ZONES = ["DE_LU", "FR", "ES", "PT", "NL", "BE"];

const page: React.CSSProperties = { padding: 24 };
const title: React.CSSProperties = { fontSize: 20, fontWeight: 600, color: "#e2e8f0", marginBottom: 16 };
const select: React.CSSProperties = {
  background: "#1a1f2e", color: "#e2e8f0", border: "1px solid #2d3748",
  borderRadius: 6, padding: "6px 12px", fontSize: 13,
};

export default function LoadPage() {
  const [zone, setZone] = useState("DE_LU");
  const [startDate, setStartDate] = useState(() => subDays(new Date(), 7));
  const [endDate, setEndDate] = useState(() => new Date());

  const startIso = startDate.toISOString();
  const endIso = addHours(endDate, 24).toISOString();

  const { data, status } = useLoad(zone, startIso, endIso);

  return (
    <div style={page}>
      <h1 style={title}>Energy Consumption (Load)</h1>

      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
        <select style={select} value={zone} onChange={(e) => setZone(e.target.value)}>
          {ZONES.map((z) => <option key={z}>{z}</option>)}
        </select>
        <DateRangePicker
          start={startDate}
          end={endDate}
          onChange={(s, e) => { setStartDate(s); setEndDate(e); }}
        />
      </div>

      {status === "loading" && <p style={{ color: "#94a3b8" }}>Loading...</p>}
      {status === "error" && <p style={{ color: "#f56565" }}>Failed to load data.</p>}
      {data && (
        <>
          <p style={{ color: "#94a3b8", fontSize: 13, marginBottom: 16 }}>
            {startDate.toLocaleDateString()} → {endDate.toLocaleDateString()} · zone <strong>{zone}</strong>
          </p>
          <LoadChart actuals={data.actuals} forecasts={data.forecasts} />
        </>
      )}
    </div>
  );
}
