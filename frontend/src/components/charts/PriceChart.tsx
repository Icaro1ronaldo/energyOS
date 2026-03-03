import {
  ResponsiveContainer, ComposedChart, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ReferenceLine,
} from "recharts";
import { PricePoint } from "../../services/api";
import { format } from "date-fns";

interface Props {
  actuals: PricePoint[];
  forecasts: PricePoint[];
}

export default function PriceChart({ actuals, forecasts }: Props) {
  const now = new Date().toISOString();

  // Merge by timestamp so actuals and forecasts at the same point appear on one row
  const map = new Map<string, { ts: string; actual?: number; forecast?: number }>();
  for (const p of actuals) {
    if (p.price_eur_mwh != null) map.set(p.timestamp, { ts: p.timestamp, actual: Number(p.price_eur_mwh) });
  }
  for (const p of forecasts) {
    if (p.price_eur_mwh != null) {
      const existing = map.get(p.timestamp) ?? { ts: p.timestamp };
      map.set(p.timestamp, { ...existing, forecast: Number(p.price_eur_mwh) });
    }
  }
  const data = Array.from(map.values()).sort((a, b) => a.ts.localeCompare(b.ts));

  return (
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
        <Tooltip
          contentStyle={{ background: "#1a1f2e", border: "1px solid #2d3748" }}
          labelFormatter={(v) => format(new Date(v), "dd MMM HH:mm")}
        />
        <Legend />
        <ReferenceLine x={now} stroke="#4a5568" strokeDasharray="4 4" label={{ value: "now", fill: "#4a5568", fontSize: 11 }} />
        <Line dataKey="actual" dot={false} stroke="#63b3ed" strokeWidth={2} name="Actual" connectNulls />
        <Line dataKey="forecast" dot={false} stroke="#f6ad55" strokeWidth={2} strokeDasharray="6 3" name="Forecast" connectNulls />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
