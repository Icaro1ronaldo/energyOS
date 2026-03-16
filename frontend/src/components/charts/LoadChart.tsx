import {
  ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ReferenceLine, ReferenceArea,
} from "recharts";
import { LoadPoint } from "../../services/api";
import { format } from "date-fns";
import { fillAllSteps, collectGaps } from "../../utils/gapFill";

interface Props {
  actuals: LoadPoint[];
  hindcasts: LoadPoint[];
  forecasts: LoadPoint[];
  mae?: string | null;
  startTs?: string;
  endTs?: string;
}

interface Row extends Record<string, unknown> {
  ts: string;
  actual?: number;
  hindcast?: number;
  forecast?: number;
}

const nts = (ts: string) => new Date(ts).toISOString();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function LoadTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const row: Row = payload[0]?.payload ?? {};
  const diff =
    row.hindcast != null && row.actual != null
      ? row.hindcast - row.actual
      : null;
  return (
    <div style={{
      background: "#fff",
      border: "1px solid rgba(0,0,0,0.08)",
      borderRadius: 10,
      padding: "10px 14px",
      fontSize: 12,
      minWidth: 200,
      boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
    }}>
      <div style={{ color: "#6e6e73", marginBottom: 8, fontWeight: 600 }}>
        {format(new Date(row.ts), "dd MMM yyyy HH:mm")}
      </div>
      {row.actual != null && (
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, color: "#30d158", marginBottom: 3 }}>
          <span>Actual</span>
          <span style={{ fontWeight: 700 }}>{row.actual.toFixed(0)} MW</span>
        </div>
      )}
      {row.hindcast != null && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, color: "#0071e3", marginBottom: 3 }}>
            <span>Predicted (hindcast)</span>
            <span style={{ fontWeight: 700 }}>{row.hindcast.toFixed(0)} MW</span>
          </div>
          {diff != null && (
            <div style={{
              display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 3,
              color: Math.abs(diff) < 200 ? "#30d158" : Math.abs(diff) < 800 ? "#ffd60a" : "#ff453a",
            }}>
              <span>Error</span>
              <span>{diff > 0 ? "+" : ""}{diff.toFixed(0)} MW</span>
            </div>
          )}
        </>
      )}
      {row.forecast != null && (
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, color: "#ff9f0a", marginBottom: 3 }}>
          <span>Forecast</span>
          <span style={{ fontWeight: 700 }}>{row.forecast.toFixed(0)} MW</span>
        </div>
      )}
    </div>
  );
}

export default function LoadChart({ actuals, hindcasts, forecasts, mae, startTs, endTs }: Props) {
  const map = new Map<string, Row>();

  // Actuals
  for (const p of actuals) {
    if (p.load_mw == null) continue;
    const ts = nts(p.timestamp);
    map.set(ts, { ts, actual: Number(p.load_mw) });
  }

  // Hindcast rows (in-sample predictions ending at anchor date)
  for (const p of hindcasts) {
    if (p.load_mw == null) continue;
    const ts = nts(p.timestamp);
    const existing = map.get(ts) ?? { ts };
    map.set(ts, { ...existing, hindcast: Number(p.load_mw) });
  }

  // Forward forecast rows (after anchor date)
  const lastHindcastTs = hindcasts.length
    ? nts(hindcasts[hindcasts.length - 1].timestamp)
    : null;

  for (const p of forecasts) {
    if (p.load_mw == null) continue;
    const ts = nts(p.timestamp);
    const existing = map.get(ts) ?? { ts };
    map.set(ts, { ...existing, forecast: Number(p.load_mw) });
  }

  const rawSorted = Array.from(map.values()).sort((a, b) => a.ts.localeCompare(b.ts));

  if (startTs && (!rawSorted.length || rawSorted[0].ts > startTs)) {
    rawSorted.unshift({ ts: startTs });
  }
  if (endTs && (!rawSorted.length || rawSorted[rawSorted.length - 1].ts < endTs)) {
    rawSorted.push({ ts: endTs });
  }

  const data = fillAllSteps(rawSorted, "ts");
  const gaps = collectGaps(data, "ts");

  const hasHindcast = data.some(r => r.hindcast != null);
  const hasForecast = data.some(r => r.forecast != null);

  // "now" line = last hindcast ts (= anchor date, e.g. Mar 5)
  const nowLine = lastHindcastTs ?? new Date().toISOString();

  const badge: React.CSSProperties = {
    background: "rgba(0,0,0,0.04)",
    border: "1px solid rgba(0,0,0,0.07)",
    borderRadius: 20,
    padding: "3px 10px",
    fontSize: 11,
    color: "#6e6e73",
  };

  return (
    <div>
      {(hasHindcast || hasForecast) && (
        <div style={{ display: "flex", gap: 6, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ ...badge, color: "#ff9f0a", fontWeight: 600 }}>LightGBM</span>
          <span style={badge}>7-day hindcast + {hasForecast ? "48h forward" : "no forward forecast yet"}</span>
          {mae != null && (
            <span style={{ ...badge, color: "#ff9f0a", fontWeight: 600 }}>MAE {mae} MW</span>
          )}
        </div>
      )}

      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
          <XAxis
            dataKey="ts"
            tickFormatter={(v) => format(new Date(v), "dd/MM HH:mm")}
            stroke="rgba(0,0,0,0.1)"
            tick={{ fill: "#6e6e73", fontSize: 11 }}
          />
          <YAxis stroke="rgba(0,0,0,0.1)" tick={{ fill: "#6e6e73", fontSize: 11 }} unit=" MW" />
          <Tooltip content={<LoadTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12, color: "#6e6e73" }} />
          <ReferenceLine
            x={nowLine}
            stroke="rgba(0,0,0,0.2)"
            strokeDasharray="4 3"
            label={{ value: "now", fill: "#aeaeb2", fontSize: 10 }}
          />
          {gaps.map(g => (
            <ReferenceArea key={g.x1} x1={g.x1} x2={g.x2} fill="rgba(120,120,128,0.10)" strokeOpacity={0} />
          ))}
          <Area dataKey="actual" stroke="#30d158" fill="rgba(48,209,88,0.12)" strokeWidth={2} name="Actual" connectNulls />
          <Line dataKey="hindcast" dot={false} stroke="#0071e3" strokeWidth={1.5} strokeDasharray="4 2" name="Predicted (7d)" connectNulls />
          <Line dataKey="forecast" dot={false} stroke="#ff9f0a" strokeWidth={2} strokeDasharray="6 3" name="Forecast" connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
