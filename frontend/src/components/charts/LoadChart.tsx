import {
  ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ReferenceLine, ReferenceArea,
} from "recharts";
import { LoadPoint } from "../../services/api";
import { format } from "date-fns";
import { fillAllSteps, collectGaps } from "../../utils/gapFill";

interface Props {
  actuals: LoadPoint[];
  forecasts: LoadPoint[];
  startTs?: string;
  endTs?: string;
}

export default function LoadChart({ actuals, forecasts, startTs, endTs }: Props) {
  const now = new Date().toISOString();

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

  const rawSorted = Array.from(map.values()).sort((a, b) => a.ts.localeCompare(b.ts));

  // Add boundary anchors so the x-axis spans the full selected range
  // and gaps at the edges are shaded like internal gaps.
  if (startTs && (!rawSorted.length || rawSorted[0].ts > startTs)) {
    rawSorted.unshift({ ts: startTs });
  }
  if (endTs && (!rawSorted.length || rawSorted[rawSorted.length - 1].ts < endTs)) {
    rawSorted.push({ ts: endTs });
  }

  const data = fillAllSteps(rawSorted, "ts");
  const gaps = collectGaps(data, "ts");

  return (
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
        <Tooltip
          contentStyle={{ background: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 10, boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}
          labelFormatter={(v) => format(new Date(v), "dd MMM HH:mm")}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: "#6e6e73" }} />
        <ReferenceLine x={now} stroke="rgba(0,0,0,0.15)" strokeDasharray="4 4" />
        {gaps.map(g => (
          <ReferenceArea key={g.x1} x1={g.x1} x2={g.x2} fill="rgba(120,120,128,0.10)" strokeOpacity={0} />
        ))}
        <Area dataKey="actual" stroke="#30d158" fill="rgba(48,209,88,0.12)" strokeWidth={2} name="Actual" connectNulls={false} />
        <Line dataKey="forecast" dot={false} stroke="#ff9f0a" strokeWidth={2} strokeDasharray="6 3" name="Forecast" connectNulls={false} />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
