import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import DashboardPage from "./pages/DashboardPage";
import MapPage from "./pages/MapPage";
import ChatPage from "./pages/ChatPage";
import DocsPage from "./pages/DocsPage";
import LiveBadge from "./components/LiveBadge";
import { useWebSocket } from "./hooks/useWebSocket";
import { useState, useCallback } from "react";

export default function App() {
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);

  const onMessage = useCallback((msg: { domain: string; zone: string }) => {
    setLastUpdate(`${msg.domain} · ${msg.zone}`);
  }, []);

  const { connected } = useWebSocket({ onMessage });

  const navStyle = ({ isActive }: { isActive: boolean }): React.CSSProperties => ({
    color: isActive ? "#63b3ed" : "#94a3b8",
    textDecoration: "none",
    fontSize: 14,
    fontWeight: isActive ? 600 : 400,
    padding: "4px 10px",
    borderRadius: 4,
    background: isActive ? "rgba(99,179,237,0.12)" : "transparent",
  });

  return (
    <BrowserRouter>
      <div style={{ minHeight: "100vh", background: "#0f1117", color: "#e2e8f0", fontFamily: "system-ui, -apple-system, sans-serif" }}>
        <header style={{
          display: "flex", alignItems: "center", gap: 16,
          padding: "12px 24px", background: "#1a1f2e", borderBottom: "1px solid #2d3748",
          position: "sticky", top: 0, zIndex: 10,
        }}>
          <span style={{ fontWeight: 700, fontSize: 16, color: "#63b3ed", letterSpacing: "-0.3px" }}>
            EnergyOS
          </span>

          <nav style={{ display: "flex", gap: 2 }}>
            <NavLink to="/" end style={navStyle}>Overview</NavLink>
            <NavLink to="/map" style={navStyle}>Zone Map</NavLink>
            <NavLink to="/chat" style={navStyle}>AI Chat</NavLink>
            <NavLink to="/docs" style={navStyle}>Docs</NavLink>
          </nav>

          <div style={{ marginLeft: "auto" }}>
            <LiveBadge connected={connected} lastUpdate={lastUpdate} />
          </div>
        </header>

        <Routes>
          <Route path="/"     element={<DashboardPage />} />
          <Route path="/map"  element={<MapPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/docs" element={<DocsPage />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
