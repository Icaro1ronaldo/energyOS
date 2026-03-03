import {
  ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ReferenceLine,
} from "recharts";
import { LoadPoint } from "../../services/api";
import { format } from "date-fns";

interface Props {
  actuals: LoadPoint[];
  forecasts: LoadPoint[];
}

export default function LoadChart({ actuals, forecasts }: Props) {
  const now = new Date().toISOString();

  // Merge by timestamp so actuals and forecasts at the same point appear on one row
  const map = new Map<string, { ts: string; actual?: number; forecast?: number }>();
  for (const p of actuals) {
    if (p.load_mw != null) map.set(p.timestamp, { ts: p.timestamp, actual: Number(p.load_mw) });
  }
  for (const p of forecasts) {
    if (p.load_mw != null) {
      const existing = map.get(p.timestamp) ?? { ts: p.timestamp };
      map.set(p.timestamp, { ...existing, forecast: Number(p.load_mw) });
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
        <YAxis stroke="#4a5568" tick={{ fontSize: 11 }} unit=" MW" />
        <Tooltip
          contentStyle={{ background: "#1a1f2e", border: "1px solid #2d3748" }}
          labelFormatter={(v) => format(new Date(v), "dd MMM HH:mm")}
        />
        <Legend />
        <ReferenceLine x={now} stroke="#4a5568" strokeDasharray="4 4" />
        <Area dataKey="actual" stroke="#68d391" fill="#68d39122" strokeWidth={2} name="Actual" connectNulls />
        <Line dataKey="forecast" dot={false} stroke="#f6ad55" strokeWidth={2} strokeDasharray="6 3" name="Forecast" connectNulls />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
