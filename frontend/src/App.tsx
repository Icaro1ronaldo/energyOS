import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import MainPage from "./pages/MainPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import DocsPage from "./pages/DocsPage";
import LiveBadge from "./components/LiveBadge";
import ChatWidget from "./components/ChatWidget";
import { useWebSocket } from "./hooks/useWebSocket";
import { useState, useCallback } from "react";
import { subDays } from "date-fns";

export default function App() {
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(() => subDays(new Date(), 7));
  const [endDate, setEndDate]     = useState(() => new Date());

  const onMessage = useCallback((msg: { domain: string; zone: string }) => {
    setLastUpdate(`${msg.domain} · ${msg.zone}`);
  }, []);

  const { connected } = useWebSocket({ onMessage });

  const navStyle = ({ isActive }: { isActive: boolean }): React.CSSProperties => ({
    color: isActive ? "#ffffff" : "rgba(255,255,255,0.72)",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: isActive ? 600 : 400,
    padding: "5px 12px",
    borderRadius: 20,
    background: isActive ? "rgba(255,255,255,0.18)" : "transparent",
    transition: "color 0.15s, background 0.15s",
    letterSpacing: "-0.1px",
  });

  return (
    <BrowserRouter>
      <div style={{ minHeight: "100vh", background: "#f5f5f7", color: "#1d1d1f" }}>
        <header style={{
          display: "flex", alignItems: "center", gap: 20,
          padding: "0 28px", height: 52,
          background: "rgba(0, 112, 184, 0.92)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(255,255,255,0.12)",
          position: "sticky", top: 0, zIndex: 100,
        }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: "#ffffff", letterSpacing: "-0.4px" }}>
            EnergyOS
          </span>

          <nav style={{ display: "flex", gap: 2 }}>
            <NavLink to="/" end style={navStyle}>Overview</NavLink>
            <NavLink to="/analytics" style={navStyle}>Analytics</NavLink>
            <NavLink to="/docs" style={navStyle}>Docs</NavLink>
          </nav>

          <div style={{ marginLeft: "auto" }}>
            <LiveBadge connected={connected} lastUpdate={lastUpdate} />
          </div>
        </header>

        <Routes>
          <Route path="/"          element={<MainPage startDate={startDate} endDate={endDate} onChange={(s,e)=>{setStartDate(s);setEndDate(e);}} />} />
          <Route path="/analytics" element={<AnalyticsPage startDate={startDate} endDate={endDate} onChange={(s,e)=>{setStartDate(s);setEndDate(e);}} />} />
          <Route path="/docs"      element={<DocsPage />} />
        </Routes>

        <ChatWidget />
      </div>
    </BrowserRouter>
  );
}
