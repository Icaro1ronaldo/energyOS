import { useState } from "react";
import { subDays } from "date-fns";
import MapPage from "./MapPage";
import DateRangePicker from "../components/DateRangePicker";

export default function AnalyticsPage() {
  const [startDate, setStartDate] = useState(() => subDays(new Date(), 7));
  const [endDate, setEndDate]     = useState(() => new Date());

  return (
    <>
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "8px 32px",
        background: "#fff",
        borderBottom: "1px solid rgba(0,0,0,0.07)",
        boxShadow: "0 1px 0 rgba(0,0,0,0.04)",
      }}>
        <span style={{ fontSize: 11, fontWeight: 500, color: "#aeaeb2", letterSpacing: "0.5px", textTransform: "uppercase" }}>
          Period
        </span>
        <DateRangePicker
          start={startDate}
          end={endDate}
          onChange={(s, e) => { setStartDate(s); setEndDate(e); }}
        />
      </div>

      <MapPage startDate={startDate} endDate={endDate} />
    </>
  );
}
