import DashboardPage from "./DashboardPage";
import DateRangePicker from "../components/DateRangePicker";

interface Props {
  startDate: Date;
  endDate: Date;
  onChange: (start: Date, end: Date) => void;
}

export default function MainPage({ startDate, endDate, onChange }: Props) {
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
        <DateRangePicker start={startDate} end={endDate} onChange={onChange} />
      </div>

      <DashboardPage startDate={startDate} endDate={endDate} />
    </>
  );
}
