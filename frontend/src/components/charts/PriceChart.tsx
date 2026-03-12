import {
  ResponsiveContainer, ComposedChart, Line, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ReferenceLine, ReferenceArea,
} from "recharts";
import { PricePoint } from "../../services/api";
import { format } from "date-fns";
import { fillAllSteps, collectGaps } from "../../utils/gapFill";

interface Props {
  actuals: PricePoint[];
  forecasts: PricePoint[];
  mae?: string | null;
  startTs?: string;
  endTs?: string;
}

interface Row {
  ts: string;
  actual?: number;
  hindcast?: number;
  forecast?: number;
  p10?: number;
  p90?: number;
  band?: [number, number];
}

const nts = (ts: string) => new Date(ts).toISOString();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PriceTooltip({ active, payload, label }: any) {
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
        {format(new Date(label), "dd MMM yyyy HH:mm")}
      </div>
      {row.actual != null && (
        <div style={{ display: "flex", justifyContent: "space-between", gap: 16, color: "#64acf5", marginBottom: 3 }}>
          <span>Actual</span>
          <span style={{ fontWeight: 700 }}>{row.actual.toFixed(2)} €/MWh</span>
        </div>
      )}
      {row.hindcast != null && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, color: "#30d158", marginBottom: 3 }}>
            <span>Predicted (hindcast)</span>
            <span style={{ fontWeight: 700 }}>{row.hindcast.toFixed(2)} €/MWh</span>
          </div>
          {diff != null && (
            <div style={{
              display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 3,
              color: Math.abs(diff) < 2 ? "#30d158" : Math.abs(diff) < 8 ? "#ffd60a" : "#ff453a",
            }}>
              <span>Error</span>
              <span>{diff > 0 ? "+" : ""}{diff.toFixed(2)} €/MWh</span>
            </div>
          )}
        </>
      )}
      {row.forecast != null && (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, color: "#ff9f0a", marginBottom: 3 }}>
            <span>Forecast p50</span>
            <span style={{ fontWeight: 700 }}>{row.forecast.toFixed(2)} €/MWh</span>
          </div>
          {row.p10 != null && (
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16, color: "#aeaeb2", marginBottom: 2 }}>
              <span>p10</span><span>{row.p10.toFixed(2)} €/MWh</span>
            </div>
          )}
          {row.p90 != null && (
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16, color: "#aeaeb2" }}>
              <span>p90</span><span>{row.p90.toFixed(2)} €/MWh</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default function PriceChart({ actuals, forecasts, mae, startTs, endTs }: Props) {
  const map = new Map<string, Row>();

  const actualTsSet = new Set<string>();
  for (const p of actuals) {
    if (p.price_eur_mwh == null) continue;
    const ts = nts(p.timestamp);
    actualTsSet.add(ts);
    map.set(ts, { ts, actual: Number(p.price_eur_mwh) });
  }

  const sortedActualTs = Array.from(actualTsSet).sort();
  const lastActualTs   = sortedActualTs.at(-1) ?? new Date().toISOString();

  for (const p of forecasts) {
    if (p.price_eur_mwh == null) continue;
    const ts       = nts(p.timestamp);
    const existing = map.get(ts) ?? { ts };
    const isHindcast = actualTsSet.has(ts) || ts <= lastActualTs;

    if (isHindcast) {
      map.set(ts, { ...existing, hindcast: Number(p.price_eur_mwh) });
    } else {
      const p10 = p.price_lower_eur_mwh != null ? Number(p.price_lower_eur_mwh) : undefined;
      const p90 = p.price_upper_eur_mwh != null ? Number(p.price_upper_eur_mwh) : undefined;
      map.set(ts, {
        ...existing,
        forecast: Number(p.price_eur_mwh),
        p10, p90,
        band: p10 != null && p90 != null ? [p10, p90] : undefined,
      });
    }
  }

  const rawSorted = Array.from(map.values()).sort((a, b) => a.ts.localeCompare(b.ts));
  if (startTs && (!rawSorted.length || rawSorted[0].ts > startTs)) {
    rawSorted.unshift({ ts: startTs });
  }
  if (endTs && (!rawSorted.length || rawSorted[rawSorted.length - 1].ts < endTs)) {
    rawSorted.push({ ts: endTs });
  }

  const data = fillAllSteps(rawSorted, "ts");

  const hasHindcast   = data.some(r => r.hindcast != null);
  const hasForecast   = data.some(r => r.forecast != null);
  const hasConfidence = data.some(r => r.band != null);

  const gaps = collectGaps(data, "ts");

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
          <span style={badge}>Quantile regression</span>
          {hasConfidence && <span style={badge}>p10 · p50 · p90</span>}
          <span style={badge}>7-day hindcast + 48h forward</span>
          {mae != null && (
            <span style={{ ...badge, color: "#ff9f0a", fontWeight: 600 }}>MAE {mae} €/MWh</span>
          )}
        </div>
      )}

      <ResponsiveContainer width="100%" height={340}>
        <ComposedChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
          <XAxis
            dataKey="ts"
            tickFormatter={(v) => format(new Date(v), "dd/MM HH:mm")}
            stroke="rgba(0,0,0,0.1)"
            tick={{ fill: "#6e6e73", fontSize: 11 }}
          />
          <YAxis stroke="rgba(0,0,0,0.1)" tick={{ fill: "#6e6e73", fontSize: 11 }} unit=" €" width={72} />
          <Tooltip content={<PriceTooltip />} />
          <Legend wrapperStyle={{ fontSize: 12, color: "#6e6e73" }} />
          <ReferenceLine
            x={lastActualTs}
            stroke="rgba(0,0,0,0.2)"
            strokeDasharray="4 3"
            label={{ value: "now", fill: "#aeaeb2", fontSize: 10 }}
          />
          {gaps.map(g => (
            <ReferenceArea key={g.x1} x1={g.x1} x2={g.x2} fill="rgba(120,120,128,0.10)" strokeOpacity={0} />
          ))}
          <Area
            dataKey="band"
            stroke="none"
            fill="#ff9f0a"
            fillOpacity={0.1}
            name="p10–p90 band"
            legendType="square"
          />
          <Line dataKey="actual"   dot={false} stroke="#0071e3" strokeWidth={2}                         name="Actual" />
          <Line dataKey="hindcast" dot={false} stroke="#30d158" strokeWidth={1.5} strokeDasharray="4 2" name="Predicted (7d)" />
          <Line dataKey="forecast" dot={false} stroke="#ff9f0a" strokeWidth={2}   strokeDasharray="6 3" name="Forecast p50" />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
