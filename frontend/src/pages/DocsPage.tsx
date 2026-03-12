import { useEffect, useState } from "react";

// ── Primitives ─────────────────────────────────────────────────────────────────

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code style={{
      background: "#eef2ff", color: "#4f46e5",
      padding: "2px 7px", borderRadius: 5, fontSize: 12,
      fontFamily: "'JetBrains Mono','Fira Code','Cascadia Code',monospace",
    }}>
      {children}
    </code>
  );
}

function Block({ lang = "", children }: { lang?: string; children: string }) {
  return (
    <div style={{ margin: "14px 0", borderRadius: 12, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}>
      {/* window chrome */}
      <div style={{
        background: "#1e1e2e", padding: "10px 16px",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#ff5f57", display: "inline-block" }} />
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#ffbd2e", display: "inline-block" }} />
        <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#28c840", display: "inline-block" }} />
        {lang && <span style={{ marginLeft: "auto", fontSize: 10, color: "rgba(255,255,255,0.3)", letterSpacing: 1 }}>{lang}</span>}
      </div>
      <pre style={{
        background: "#13131f", margin: 0, padding: "18px 20px",
        fontSize: 12.5, color: "#cdd6f4", overflowX: "auto",
        lineHeight: 1.75, fontFamily: "'JetBrains Mono','Fira Code',monospace",
      }}>
        {children.trim()}
      </pre>
    </div>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div style={{ overflowX: "auto", margin: "14px 0", borderRadius: 10, border: "1px solid rgba(0,0,0,0.08)", overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ background: "#f8f8fb" }}>
            {headers.map((h) => (
              <th key={h} style={{
                textAlign: "left", padding: "10px 16px",
                color: "#6e6e73", fontWeight: 600,
                fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px",
                borderBottom: "1px solid rgba(0,0,0,0.08)",
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ background: i % 2 ? "rgba(0,0,0,0.012)" : "#fff", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
              {row.map((cell, j) => (
                <td key={j} style={{
                  padding: "10px 16px",
                  color: j === 0 ? "#4f46e5" : "#374151",
                  fontFamily: j === 0 ? "'JetBrains Mono','Fira Code',monospace" : "inherit",
                  fontSize: j === 0 ? 12 : 13, lineHeight: 1.5,
                }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Badge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span style={{
      background: color + "18", color,
      border: `1px solid ${color}35`,
      borderRadius: 6, padding: "3px 10px",
      fontSize: 11.5, fontWeight: 600, letterSpacing: "0.1px",
    }}>{children}</span>
  );
}

function Callout({ type, children }: { type: "info" | "warning" | "tip"; children: React.ReactNode }) {
  const cfg = {
    info:    { bg: "#eff6ff", border: "#bfdbfe", icon: "ℹ️", accent: "#3b82f6" },
    warning: { bg: "#fffbeb", border: "#fde68a", icon: "⚠️", accent: "#d97706" },
    tip:     { bg: "#f0fdf4", border: "#bbf7d0", icon: "💡", accent: "#16a34a" },
  }[type];
  return (
    <div style={{
      background: cfg.bg, border: `1px solid ${cfg.border}`,
      borderLeft: `3px solid ${cfg.accent}`,
      borderRadius: 8, padding: "12px 16px",
      display: "flex", gap: 10, margin: "14px 0",
    }}>
      <span style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }}>{cfg.icon}</span>
      <p style={{ margin: 0, fontSize: 13, color: "#374151", lineHeight: 1.65 }}>{children}</p>
    </div>
  );
}

// ── TOC ────────────────────────────────────────────────────────────────────────

const SECTIONS = [
  { id: "overview",       label: "Overview",             icon: "⚡" },
  { id: "architecture",   label: "Architecture",          icon: "🏗",  indent: true },
  { id: "ml-model",       label: "ML Forecasting",        icon: "🤖" },
  { id: "ml-why",         label: "LightGBM vs Prophet",   icon: "",   indent: true },
  { id: "ml-features",    label: "Input Features",        icon: "",   indent: true },
  { id: "ml-params",      label: "Hyperparameters",       icon: "",   indent: true },
  { id: "api",            label: "REST API",              icon: "🔌" },
  { id: "api-prices",     label: "Prices",                icon: "",   indent: true },
  { id: "api-load-prod",  label: "Load & Production",     icon: "",   indent: true },
  { id: "api-chat",       label: "AI Chat",               icon: "",   indent: true },
  { id: "database",       label: "Database Schema",       icon: "🗄" },
  { id: "runbook",        label: "Runbook",               icon: "📋" },
  { id: "env-vars",       label: "Environment Variables", icon: "",   indent: true },
] as const;

function scrollTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ── Section helpers ────────────────────────────────────────────────────────────

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} style={{
      fontSize: 20, fontWeight: 700, color: "#111827",
      margin: "0 0 20px", letterSpacing: "-0.5px", scrollMarginTop: 76,
      display: "flex", alignItems: "center", gap: 10,
    }}>
      {children}
    </h2>
  );
}

function H3({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h3 id={id} style={{
      fontSize: 14, fontWeight: 600, color: "#4f46e5",
      margin: "28px 0 10px", letterSpacing: "-0.1px", scrollMarginTop: 76,
    }}>
      {children}
    </h3>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p style={{ color: "#4b5563", fontSize: 14, lineHeight: 1.75, margin: "0 0 14px" }}>{children}</p>;
}

function Divider() {
  return <div style={{ borderTop: "1px solid rgba(0,0,0,0.07)", margin: "44px 0" }} />;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DocsPage() {
  const [active, setActive] = useState("overview");

  useEffect(() => {
    const els = SECTIONS.map(s => document.getElementById(s.id)).filter(Boolean) as HTMLElement[];
    const io = new IntersectionObserver(
      es => { const hit = es.find(e => e.isIntersecting); if (hit) setActive(hit.target.id); },
      { rootMargin: "-10% 0px -80% 0px" },
    );
    els.forEach(el => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div style={{ display: "flex", background: "#f9fafb", minHeight: "calc(100vh - 52px)" }}>

      {/* ── Sidebar ── */}
      <aside style={{
        width: 240, flexShrink: 0,
        background: "#fff",
        borderRight: "1px solid #e5e7eb",
        padding: "28px 0 40px",
        position: "sticky", top: 52,
        height: "calc(100vh - 52px)", overflowY: "auto",
      }}>
        <div style={{ padding: "0 20px 10px", fontSize: 10, fontWeight: 700, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "1px" }}>
          Documentation
        </div>

        {SECTIONS.map(s => {
          const on = active === s.id;
          return (
            <button
              key={s.id}
              onClick={() => scrollTo(s.id)}
              style={{
                display: "flex", alignItems: "center", gap: 8, width: "100%",
                padding: s.indent ? "6px 20px 6px 36px" : "7px 20px",
                background: on ? "#eff6ff" : "transparent",
                border: "none", borderLeft: `2px solid ${on ? "#3b82f6" : "transparent"}`,
                cursor: "pointer", textAlign: "left",
                color: on ? "#1d4ed8" : s.indent ? "#6b7280" : "#374151",
                fontSize: s.indent ? 12.5 : 13,
                fontWeight: on ? 600 : 400,
                fontFamily: "inherit",
                transition: "all 0.1s",
              }}
            >
              {!s.indent && s.icon && <span style={{ fontSize: 13, width: 18, textAlign: "center" }}>{s.icon}</span>}
              {s.label}
            </button>
          );
        })}

        <div style={{ margin: "28px 16px 0", padding: "16px", background: "#f8faff", border: "1px solid #e0e7ff", borderRadius: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#4f46e5", marginBottom: 6 }}>Tech Stack</div>
          {[["Frontend", "React 18 + Vite"], ["Backend", "FastAPI + Celery"], ["ML", "LightGBM"], ["DB", "TimescaleDB"], ["AI", "Claude (Anthropic)"]].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#6b7280", marginBottom: 3 }}>
              <span style={{ color: "#9ca3af" }}>{k}</span>
              <span style={{ color: "#374151", fontWeight: 500 }}>{v}</span>
            </div>
          ))}
        </div>
      </aside>

      {/* ── Content ── */}
      <main style={{ flex: 1, padding: "48px 64px 100px", maxWidth: 900 }}>

        {/* Hero */}
        <div id="overview" style={{ scrollMarginTop: 76, marginBottom: 48 }}>
          <div style={{
            background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #1e3a5f 100%)",
            borderRadius: 16, padding: "36px 40px", marginBottom: 32, color: "#fff",
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "1.5px", textTransform: "uppercase", color: "rgba(255,255,255,0.5)", marginBottom: 10 }}>
              EnergyOS Platform
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 10px", letterSpacing: "-0.8px", color: "#fff" }}>
              Developer Documentation
            </h1>
            <p style={{ fontSize: 14, color: "rgba(255,255,255,0.65)", margin: "0 0 24px", lineHeight: 1.6 }}>
              Architecture, ML forecasting, REST API reference, and operational runbook for the EnergyOS real-time European electricity market platform.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {[["FastAPI", "#6366f1"], ["LightGBM", "#059669"], ["TimescaleDB", "#7c3aed"], ["ENTSO-E", "#b45309"], ["Claude AI", "#374151"]].map(([name, color]) => (
                <span key={name} style={{
                  background: color + "30", color: "#fff",
                  border: `1px solid ${color}60`,
                  borderRadius: 6, padding: "4px 12px", fontSize: 12, fontWeight: 500,
                }}>{name}</span>
              ))}
            </div>
          </div>

          {/* Architecture */}
          <H2 id="architecture">🏗 Architecture Overview</H2>
          <P>
            EnergyOS is composed of four layers: a <strong>React SPA</strong> served by Vite, a <strong>FastAPI</strong> backend with async SQLAlchemy,
            a <strong>Celery</strong> worker for ingestion and ML, and a <strong>TimescaleDB</strong> hypertable database for time-series storage.
          </P>
          <Block lang="DIAGRAM">{`
┌─────────────┐    WebSocket     ┌───────────────────────────────┐
│  React SPA  │◄────────────────►│  FastAPI  (port 8000)         │
│  Vite 5     │    REST JSON     │  /api/v1/prices  /load  /prod │
└─────────────┘                  │  /api/v1/chat  (Claude AI)    │
                                 └──────────┬────────────────────┘
                                            │ SQLAlchemy async
                                 ┌──────────▼────────────────────┐
                                 │  TimescaleDB (PostgreSQL 15)  │
                                 │  energy_prices  energy_loads  │
                                 │  energy_productions           │
                                 │  ml_model_registry            │
                                 └──────────▲────────────────────┘
                                            │ SQLAlchemy sync
                                 ┌──────────┴────────────────────┐
                                 │  Celery Worker + Beat         │
                                 │  • ingestion  (ENTSO-E API)   │
                                 │  • ml_forecast (LightGBM)     │
                                 └───────────────────────────────┘`}
          </Block>
          <Callout type="info">
            The WebSocket connection at <Code>/ws</Code> pushes live ingestion events to the dashboard header. The green dot confirms an active connection.
          </Callout>
        </div>

        <Divider />

        {/* ML */}
        <div style={{ marginBottom: 48 }}>
          <H2 id="ml-model">🤖 ML Forecasting — LightGBM</H2>
          <P>
            Price and load forecasting uses <strong>LightGBM quantile regression</strong>. Three independent models are trained per zone —{" "}
            <Badge color="#16a34a">p10</Badge>{" "}<Badge color="#d97706">p50</Badge>{" "}<Badge color="#dc2626">p90</Badge> — producing a
            calibrated confidence band rendered as the shaded region on the chart.
          </P>

          <H3 id="ml-why">LightGBM vs Prophet</H3>
          <Table
            headers={["Criterion", "Prophet (previous)", "LightGBM (current)"]}
            rows={[
              ["Spike handling", "Poor — additive model breaks on spikes", "Excellent — tree splits capture sharp spikes"],
              ["Seasonality", "Automatic Fourier decomposition", "Learned via hour / weekday / month features"],
              ["Confidence bands", "Additive noise estimate", "Native quantile regression (calibrated)"],
              ["Training speed", "~60 s per zone", "~20 s per zone"],
              ["Dependencies", "prophet, pystan, cmdstanpy", "lightgbm only"],
            ]}
          />

          <H3 id="ml-features">Input Features</H3>
          <Table
            headers={["Feature", "Type", "Description"]}
            rows={[
              ["hour", "cyclic", "Hour of day (0–23) — intraday price pattern"],
              ["dayofweek", "cyclic", "Day of week (0=Mon, 6=Sun) — weekend effect"],
              ["month", "cyclic", "Month (1–12) — seasonal trend"],
              ["lag_24", "autoregressive", "Value 24 h ago — strong daily autocorrelation"],
              ["lag_48", "autoregressive", "Value 48 h ago — two-day memory"],
              ["lag_168", "autoregressive", "Same hour last week — weekly cycle"],
              ["roll_24_mean", "rolling stat", "Rolling 24h mean — local trend"],
            ]}
          />

          <H3 id="ml-params">Hyperparameters</H3>
          <Block lang="PYTHON">{`
lgb.train({
    "objective":     "quantile",
    "alpha":          0.1 | 0.5 | 0.9,   # one model per quantile
    "num_leaves":     63,
    "learning_rate":  0.05,
    "num_iterations": 100,
})`}
          </Block>
          <Callout type="tip">
            Forecasts are generated <strong>recursively</strong>: each step's prediction becomes the lag input for the next.
            The p50 model drives the lags; p10 and p90 are evaluated independently at each step.
          </Callout>
        </div>

        <Divider />

        {/* API */}
        <div style={{ marginBottom: 48 }}>
          <H2 id="api">🔌 REST API Reference</H2>

          <H3 id="api-prices">Prices</H3>
          <Table
            headers={["Method", "Endpoint", "Description"]}
            rows={[["GET", "/api/v1/prices/{zone}", "Actuals + 48-hour forecast with confidence bands"]]}
          />
          <Block lang="HTTP">{`
GET /api/v1/prices/FR?start=2026-03-11T00:00:00Z&end=2026-03-13T00:00:00Z

{
  "zone": "FR",
  "actuals":   [{ "timestamp": "...", "price_eur_mwh": 88.34 }],
  "forecasts": [{
    "timestamp":           "2026-03-12T00:00:00Z",
    "price_eur_mwh":       97.86,
    "price_lower_eur_mwh": 70.49,
    "price_upper_eur_mwh": 115.05,
    "is_forecast":         true
  }]
}`}
          </Block>

          <H3 id="api-load-prod">Load & Production</H3>
          <Table
            headers={["Method", "Endpoint", "Description"]}
            rows={[
              ["GET", "/api/v1/load/{zone}", "Actual + forecast load in MW"],
              ["GET", "/api/v1/production/{zone}", "Generation mix by production type (actuals only)"],
            ]}
          />

          <H3 id="api-chat">AI Chat</H3>
          <Table
            headers={["Method", "Endpoint", "Description"]}
            rows={[["POST", "/api/v1/chat", "Claude-powered streaming energy assistant (SSE)"]]}
          />
          <Callout type="info">
            Send <Code>{"{ messages: [{role, content}] }"}</Code>. The response streams as <Code>data: "token"</Code> lines until <Code>data: [DONE]</Code>.
          </Callout>

          <H3 id="api-zones">Bidding Zones</H3>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", margin: "10px 0 16px" }}>
            {["DE_LU", "FR", "ES", "PT", "NL", "BE"].map(z => <Badge key={z} color="#4f46e5">{z}</Badge>)}
          </div>
          <P>Configured via <Code>BIDDING_ZONES</Code>. Any ENTSO-E EIC zone code is accepted.</P>
        </div>

        <Divider />

        {/* Database */}
        <div style={{ marginBottom: 48 }}>
          <H2 id="database">🗄 Database Schema</H2>
          <Table
            headers={["Table", "Key columns", "Notes"]}
            rows={[
              ["energy_prices", "timestamp, bidding_zone, is_forecast, price_eur_mwh, price_lower/upper_eur_mwh", "Hypertable; confidence columns from migration 002"],
              ["energy_loads", "timestamp, bidding_zone, is_forecast, load_mw", "Hypertable; 15-min resolution"],
              ["energy_productions", "timestamp, bidding_zone, production_type, is_forecast, value_mw", "Hypertable; one row per type"],
              ["ml_model_registry", "domain, bidding_zone, s3_key, trained_at, is_active", "Active model pointer per zone/domain"],
            ]}
          />
          <Callout type="warning">
            All timestamps are stored in <strong>UTC</strong>. The frontend converts to local time for display only. Never insert local-time strings into the database.
          </Callout>
        </div>

        <Divider />

        {/* Runbook */}
        <div>
          <H2 id="runbook">📋 Operational Runbook</H2>

          <H3 id="runbook-start">Start All Services</H3>
          <Block lang="SHELL">{`docker compose up --build`}</Block>

          <H3 id="runbook-migrate">Run Migrations</H3>
          <Block lang="SHELL">{`docker compose exec backend alembic upgrade head`}</Block>

          <H3 id="runbook-forecast">Trigger ML Forecast Manually</H3>
          <Block lang="SHELL">{`docker compose exec celery_worker \\
  celery -A app.workers.celery_app call app.workers.ml_forecast.run_all_forecasts`}</Block>

          <H3 id="runbook-ingest">Trigger Data Ingestion Manually</H3>
          <Block lang="SHELL">{`docker compose exec celery_worker \\
  celery -A app.workers.celery_app call app.workers.ingestion.run_ingestion`}</Block>

          <H3 id="env-vars">Environment Variables</H3>
          <Table
            headers={["Variable", "Required", "Description"]}
            rows={[
              ["DATABASE_URL", "✅ Yes", "Async PostgreSQL DSN (asyncpg)"],
              ["DATABASE_SYNC_URL", "✅ Yes", "Sync DSN for Celery (psycopg2)"],
              ["REDIS_URL", "✅ Yes", "Redis broker URL for Celery"],
              ["ENTSOE_API_KEY", "✅ Yes", "ENTSO-E Transparency Platform key"],
              ["ANTHROPIC_API_KEY", "✅ Yes", "Anthropic key for AI Chat"],
              ["AWS_ACCESS_KEY_ID", "⬜ Optional", "S3 credentials for model storage"],
              ["S3_BUCKET", "⬜ Optional", "S3 bucket for trained LightGBM models"],
              ["BIDDING_ZONES", "⬜ Optional", "Zones to ingest (default: DE_LU,FR,ES,PT,NL,BE)"],
              ["FORECAST_HORIZON_HOURS", "⬜ Optional", "Forecast horizon (default: 48)"],
            ]}
          />
        </div>

      </main>
    </div>
  );
}
