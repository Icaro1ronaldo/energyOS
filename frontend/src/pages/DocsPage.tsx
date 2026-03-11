function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 40 }}>
      <h2 style={{ fontSize: 16, fontWeight: 700, color: "#63b3ed", margin: "0 0 16px", borderBottom: "1px solid #2d3748", paddingBottom: 8 }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code style={{ background: "#2d3748", color: "#f6ad55", padding: "1px 6px", borderRadius: 3, fontSize: 12, fontFamily: "monospace" }}>
      {children}
    </code>
  );
}

function Block({ children }: { children: string }) {
  return (
    <pre style={{ background: "#141820", border: "1px solid #2d3748", borderRadius: 6, padding: "14px 16px", fontSize: 12, color: "#e2e8f0", overflowX: "auto", lineHeight: 1.6 }}>
      {children.trim()}
    </pre>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h} style={{ textAlign: "left", padding: "8px 12px", background: "#2d3748", color: "#94a3b8", fontWeight: 600, borderBottom: "1px solid #4a5568" }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: "1px solid #2d3748" }}>
              {row.map((cell, j) => (
                <td key={j} style={{ padding: "8px 12px", color: j === 0 ? "#f6ad55" : "#e2e8f0", fontFamily: j === 0 ? "monospace" : "inherit", fontSize: j === 0 ? 12 : 13 }}>
                  {cell}
                </td>
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
    <span style={{ background: color + "22", color, border: `1px solid ${color}44`, borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 600 }}>
      {children}
    </span>
  );
}

export default function DocsPage() {
  return (
    <div style={{ padding: "32px 40px", maxWidth: 900, margin: "0 auto", lineHeight: 1.7 }}>
      <div style={{ marginBottom: 36 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#e2e8f0", margin: "0 0 8px" }}>EnergyOS Documentation</h1>
        <p style={{ color: "#718096", fontSize: 14, margin: 0 }}>
          Architecture, ML forecasting model, REST API reference, and operational runbook.
        </p>
      </div>

      {/* ── Architecture ──────────────────────────────────────────────── */}
      <Section title="Architecture Overview">
        <p style={{ color: "#a0aec0", fontSize: 13, marginBottom: 16 }}>
          EnergyOS is a real-time energy market dashboard backed by a FastAPI service, a Celery ML worker, and a TimescaleDB time-series database.
        </p>
        <Block>{`
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
                                 └───────────────────────────────┘
        `}</Block>
      </Section>

      {/* ── ML Model ──────────────────────────────────────────────────── */}
      <Section title="ML Forecasting Model — LightGBM Quantile Regression">
        <p style={{ color: "#a0aec0", fontSize: 13, marginBottom: 12 }}>
          Electricity price forecasting uses <strong style={{ color: "#e2e8f0" }}>LightGBM</strong> with quantile regression.
          Three independent models are trained — <Badge color="#48bb78">p10</Badge>{" "}
          <Badge color="#f6ad55">p50</Badge>{" "}<Badge color="#fc8181">p90</Badge> — producing a calibrated confidence band
          displayed as the shaded region on the price chart.
        </p>

        <h3 style={{ fontSize: 13, fontWeight: 600, color: "#94a3b8", margin: "20px 0 10px" }}>Why LightGBM over Prophet</h3>
        <Table
          headers={["Criterion", "Prophet (previous)", "LightGBM (current)"]}
          rows={[
            ["Spike handling", "Poor — additive model assumes smooth changes", "Excellent — tree splits capture sharp price spikes"],
            ["Seasonality", "Automatic Fourier decomposition", "Learned via hour/weekday/month features"],
            ["Confidence intervals", "Additive noise estimate", "Native quantile regression (calibrated)"],
            ["Training speed", "~60 s per zone", "~20 s per zone"],
            ["Dependencies", "prophet, pystan, cmdstanpy", "lightgbm only"],
          ]}
        />

        <h3 style={{ fontSize: 13, fontWeight: 600, color: "#94a3b8", margin: "20px 0 10px" }}>Input features</h3>
        <Table
          headers={["Feature", "Description"]}
          rows={[
            ["hour", "Hour of day (0–23) — captures intraday price patterns"],
            ["dayofweek", "Day of week (0=Mon … 6=Sun) — captures weekend/weekday effects"],
            ["month", "Month of year (1–12) — captures seasonal trends"],
            ["lag_24", "Price 24 hours ago — strong daily autocorrelation"],
            ["lag_48", "Price 48 hours ago — two-day memory"],
            ["lag_168", "Price 168 hours ago (same hour last week) — weekly cycle"],
            ["roll_24_mean", "Rolling 24h mean of the previous 24 values — local trend"],
          ]}
        />

        <h3 style={{ fontSize: 13, fontWeight: 600, color: "#94a3b8", margin: "20px 0 10px" }}>Hyperparameters</h3>
        <Block>{`
objective      = quantile   # pinball loss
alpha          = 0.1 / 0.5 / 0.9
num_leaves     = 63         # model complexity
learning_rate  = 0.05
num_iterations = 100
        `}</Block>

        <h3 style={{ fontSize: 13, fontWeight: 600, color: "#94a3b8", margin: "20px 0 10px" }}>Forecasting strategy</h3>
        <p style={{ color: "#a0aec0", fontSize: 13 }}>
          Forecasts are generated <strong style={{ color: "#e2e8f0" }}>recursively</strong>: each hour's prediction becomes
          the lag input for the next step. A numpy value buffer avoids slow DataFrame copies, keeping the 48-step
          horizon fast. The p50 model drives the recursive lags; p10 and p90 are predicted independently at each step.
        </p>
      </Section>

      {/* ── REST API ──────────────────────────────────────────────────── */}
      <Section title="REST API Reference">
        <h3 style={{ fontSize: 13, fontWeight: 600, color: "#94a3b8", margin: "0 0 10px" }}>Prices</h3>
        <Table
          headers={["Method", "Endpoint", "Description"]}
          rows={[
            ["GET", "/api/v1/prices/{zone}", "Actual + forecast prices for a bidding zone"],
          ]}
        />
        <p style={{ color: "#718096", fontSize: 12, margin: "8px 0 16px" }}>
          Query params: <Code>start</Code> <Code>end</Code> (ISO-8601). Response includes <Code>price_lower_eur_mwh</Code> and <Code>price_upper_eur_mwh</Code> for forecast rows.
        </p>
        <Block>{`
GET /api/v1/prices/FR?start=2026-03-11T00:00:00Z&end=2026-03-13T00:00:00Z

{
  "zone": "FR",
  "actuals": [
    { "timestamp": "2026-03-11T00:00:00Z", "price_eur_mwh": 88.34, ... }
  ],
  "forecasts": [
    {
      "timestamp": "2026-03-12T00:00:00Z",
      "price_eur_mwh": 97.86,
      "price_lower_eur_mwh": 70.49,
      "price_upper_eur_mwh": 115.05,
      "is_forecast": true
    }
  ]
}
        `}</Block>

        <h3 style={{ fontSize: 13, fontWeight: 600, color: "#94a3b8", margin: "20px 0 10px" }}>Load & Production</h3>
        <Table
          headers={["Method", "Endpoint", "Description"]}
          rows={[
            ["GET", "/api/v1/load/{zone}", "Actual + forecast load (MW)"],
            ["GET", "/api/v1/production/{zone}", "Generation mix by production type"],
          ]}
        />

        <h3 style={{ fontSize: 13, fontWeight: 600, color: "#94a3b8", margin: "20px 0 10px" }}>AI Chat</h3>
        <Table
          headers={["Method", "Endpoint", "Description"]}
          rows={[
            ["POST", "/api/v1/chat", "Claude-powered energy market assistant"],
          ]}
        />

        <h3 style={{ fontSize: 13, fontWeight: 600, color: "#94a3b8", margin: "20px 0 10px" }}>Supported bidding zones</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {["DE_LU", "FR", "ES", "PT", "NL", "BE"].map((z) => (
            <Badge key={z} color="#63b3ed">{z}</Badge>
          ))}
        </div>
      </Section>

      {/* ── Database ──────────────────────────────────────────────────── */}
      <Section title="Database Schema">
        <Table
          headers={["Table", "Key columns", "Notes"]}
          rows={[
            ["energy_prices", "timestamp, bidding_zone, is_forecast, price_eur_mwh, price_lower_eur_mwh, price_upper_eur_mwh", "TimescaleDB hypertable; confidence columns added in migration 002"],
            ["energy_loads", "timestamp, bidding_zone, is_forecast, load_mw", "TimescaleDB hypertable"],
            ["energy_productions", "timestamp, bidding_zone, production_type, is_forecast, value_mw", "TimescaleDB hypertable"],
            ["ml_model_registry", "domain, bidding_zone, s3_key, trained_at, is_active", "Tracks the active model per zone/domain"],
          ]}
        />
      </Section>

      {/* ── Runbook ───────────────────────────────────────────────────── */}
      <Section title="Operational Runbook">
        <h3 style={{ fontSize: 13, fontWeight: 600, color: "#94a3b8", margin: "0 0 10px" }}>Start all services</h3>
        <Block>{`docker compose up --build`}</Block>

        <h3 style={{ fontSize: 13, fontWeight: 600, color: "#94a3b8", margin: "16px 0 10px" }}>Run database migrations</h3>
        <Block>{`docker compose exec backend alembic upgrade head`}</Block>

        <h3 style={{ fontSize: 13, fontWeight: 600, color: "#94a3b8", margin: "16px 0 10px" }}>Manually trigger ML forecast</h3>
        <Block>{`docker compose exec celery_worker \\
  celery -A app.workers.celery_app call app.workers.ml_forecast.run_all_forecasts`}</Block>

        <h3 style={{ fontSize: 13, fontWeight: 600, color: "#94a3b8", margin: "16px 0 10px" }}>Manually trigger data ingestion</h3>
        <Block>{`docker compose exec celery_worker \\
  celery -A app.workers.celery_app call app.workers.ingestion.run_ingestion`}</Block>

        <h3 style={{ fontSize: 13, fontWeight: 600, color: "#94a3b8", margin: "16px 0 10px" }}>Check forecast accuracy (MAE)</h3>
        <p style={{ color: "#a0aec0", fontSize: 13 }}>
          The <strong style={{ color: "#e2e8f0" }}>Forecast Accuracy</strong> section on the Dashboard compares the last 48h of ML predictions
          against actual values and displays the Mean Absolute Error (MAE) badge per domain.
        </p>

        <h3 style={{ fontSize: 13, fontWeight: 600, color: "#94a3b8", margin: "16px 0 10px" }}>Environment variables</h3>
        <Table
          headers={["Variable", "Description"]}
          rows={[
            ["DATABASE_URL", "Async PostgreSQL DSN (asyncpg)"],
            ["DATABASE_SYNC_URL", "Sync PostgreSQL DSN (psycopg2, used by Celery)"],
            ["REDIS_URL", "Redis connection URL"],
            ["ENTSOE_API_KEY", "ENTSO-E Transparency Platform API key"],
            ["AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY", "S3 credentials for model persistence (optional in dev)"],
            ["S3_BUCKET", "S3 bucket name for storing trained models"],
            ["ANTHROPIC_API_KEY", "Anthropic API key for the AI Chat feature"],
            ["BIDDING_ZONES", "Comma-separated list of zones to ingest (default: DE_LU,FR,ES,PT,NL,BE)"],
            ["FORECAST_HORIZON_HOURS", "Number of hours to forecast ahead (default: 48)"],
          ]}
        />
      </Section>
    </div>
  );
}
