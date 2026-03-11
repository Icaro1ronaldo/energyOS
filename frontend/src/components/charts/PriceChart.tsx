import {
  ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ReferenceLine,
} from "recharts";
import { PricePoint } from "../../services/api";
import { format } from "date-fns";

interface Props {
  actuals: PricePoint[];
  forecasts: PricePoint[];
  mae?: string | null;
}

interface Row {
  ts: string;
  actual?: number;
  forecast?: number;
  p10?: number;
  p90?: number;
  band?: [number, number];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PriceTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const row: Row = payload[0]?.payload ?? {};
  return (
    <div style={{
      background: "#1a1f2e", border: "1px solid #2d3748",
      borderRadius: 6, padding: "10px 14px", fontSize: 12, minWidth: 180,
    }}>
      <div style={{ color: "#94a3b8", marginBottom: 8, fontWeight: 600 }}>
        {format(new Date(label), "dd MMM yyyy HH:mm")}
      </div>
      {row.actual != null && (
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, color: "#63b3ed", marginBottom: 4 }}>
          <span>Actual</span>
          <span style={{ fontWeight: 700 }}>{row.actual.toFixed(2)} €/MWh</span>
        </div>
      )}
      {row.forecast != null && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, color: "#f6ad55", marginBottom: 2 }}>
            <span>Forecast p50</span>
            <span style={{ fontWeight: 700 }}>{row.forecast.toFixed(2)} €/MWh</span>
          </div>
          {row.p10 != null && (
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16, color: "#a0aec0", marginBottom: 2 }}>
              <span>p10 (low)</span>
              <span>{row.p10.toFixed(2)} €/MWh</span>
            </div>
          )}
          {row.p90 != null && (
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16, color: "#a0aec0" }}>
              <span>p90 (high)</span>
              <span>{row.p90.toFixed(2)} €/MWh</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function PriceChart({ actuals, forecasts, mae }: Props) {
  const now = new Date().toISOString();

  const map = new Map<string, Row>();

  for (const p of actuals) {
    if (p.price_eur_mwh != null)
      map.set(p.timestamp, { ts: p.timestamp, actual: Number(p.price_eur_mwh) });
  }
  for (const p of forecasts) {
    if (p.price_eur_mwh != null) {
      const existing = map.get(p.timestamp) ?? { ts: p.timestamp };
      const p10 = p.price_lower_eur_mwh != null ? Number(p.price_lower_eur_mwh) : undefined;
      const p90 = p.price_upper_eur_mwh != null ? Number(p.price_upper_eur_mwh) : undefined;
      map.set(p.timestamp, {
        ...existing,
        forecast: Number(p.price_eur_mwh),
        p10,
        p90,
        band: p10 != null && p90 != null ? [p10, p90] : undefined,
      });
    }
  }

  const data = Array.from(map.values()).sort((a, b) => a.ts.localeCompare(b.ts));

  const hasForecast = forecasts.length > 0;
  const hasConfidence = forecasts.some((p) => p.price_lower_eur_mwh != null);

  return (
    <div>
      {/* Model info badge */}
      {hasForecast && (
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ background: "#2d3748", borderRadius: 4, padding: "3px 10px", fontSize: 11, color: "#f6ad55", fontWeight: 600, letterSpacing: "0.3px" }}>
            LightGBM
          </span>
          <span style={{ background: "#2d3748", borderRadius: 4, padding: "3px 10px", fontSize: 11, color: "#94a3b8" }}>
            Quantile regression
          </span>
          {hasConfidence && (
            <span style={{ background: "#2d3748", borderRadius: 4, padding: "3px 10px", fontSize: 11, color: "#94a3b8" }}>
              p10 · p50 · p90
            </span>
          )}
          <span style={{ background: "#2d3748", borderRadius: 4, padding: "3px 10px", fontSize: 11, color: "#94a3b8" }}>
            7-day hindcast + 48h forward
          </span>
          {mae != null && (
            <span style={{ background: "#2d3748", borderRadius: 4, padding: "3px 10px", fontSize: 11, color: "#f6ad55", fontWeight: 600 }}>
              MAE {mae} €/MWh
            </span>
          )}
        </div>
      )}

      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" />
          <XAxis
            dataKey="ts"
            tickFormatter={(v) => format(new Date(v), "dd/MM HH:mm")}
            stroke="#4a5568"
            tick={{ fontSize: 11 }}
          />
          <YAxis stroke="#4a5568" tick={{ fontSize: 11 }} unit=" €/MWh" />
          <Tooltip content={<PriceTooltip />} />
          <Legend />
          <ReferenceLine
            x={now}
            stroke="#4a5568"
            strokeDasharray="4 4"
            label={{ value: "now", fill: "#4a5568", fontSize: 11 }}
          />
          {/* p10–p90 confidence band */}
          <Area
            dataKey="band"
            stroke="none"
            fill="#f6ad55"
            fillOpacity={0.15}
            name="p10–p90"
            legendType="square"
            connectNulls
          />
          <Line dataKey="actual"   dot={false} stroke="#63b3ed" strokeWidth={2} name="Actual"         connectNulls />
          <Line dataKey="forecast" dot={false} stroke="#f6ad55" strokeWidth={2} strokeDasharray="6 3" name="Forecast (p50)" connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
