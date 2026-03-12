import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ReferenceArea,
} from "recharts";
import { ProductionResponse } from "../../services/api";
import { format } from "date-fns";
import { fillAllSteps, collectGaps } from "../../utils/gapFill";

interface Props {
  data: ProductionResponse[];
  showForecast?: boolean;
  startTs?: string;
  endTs?: string;
}

const COLORS: Record<string, string> = {
  solar: "#F59E0B",
  wind_onshore: "#10B981",
  wind_offshore: "#0D9488",
  nuclear: "#8B5CF6",
  hydro_run_of_river: "#06B6D4",
  hydro_reservoir: "#0284C7",
  hydro_pumped_storage: "#1D4ED8",
  fossil_gas: "#F97316",
  fossil_coal: "#57534E",
  fossil_oil: "#92400E",
  biomass: "#16A34A",
  geothermal: "#DC2626",
  other_renewable: "#0891B2",
  other: "#6B7280",
};

export default function ProductionChart({ data, showForecast = false, startTs, endTs }: Props) {
  const timeMap: Record<string, Record<string, number>> = {};

  for (const series of data) {
    const points = showForecast ? series.forecasts : series.actuals;
    for (const p of points) {
      if (!timeMap[p.timestamp]) timeMap[p.timestamp] = {};
      timeMap[p.timestamp][series.production_type] = p.value_mw ?? 0;
    }
  }

  const types = data.map((d) => d.production_type);

  let chartData: Record<string, unknown>[] = Object.entries(timeMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ts, values]) => ({ ts, ...values }));

  // Add boundary anchors so the axis spans the full selected range
  if (startTs && (!chartData.length || String(chartData[0].ts) > startTs)) {
    chartData.unshift({ ts: startTs });
  }
  if (endTs && (!chartData.length || String(chartData[chartData.length - 1].ts) < endTs)) {
    chartData.push({ ts: endTs });
  }

  chartData = fillAllSteps(chartData, "ts");
  const gaps = collectGaps(chartData, "ts");

  return (
    <ResponsiveContainer width="100%" height={360}>
      <AreaChart data={chartData}>
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
        {gaps.map(g => (
          <ReferenceArea key={g.x1} x1={g.x1} x2={g.x2} fill="rgba(120,120,128,0.10)" strokeOpacity={0} />
        ))}
        {types.map((type) => (
          <Area
            key={type}
            type="monotone"
            dataKey={type}
            stackId="1"
            stroke={COLORS[type] ?? "#636366"}
            fill={COLORS[type] ?? "#636366"}
            fillOpacity={showForecast ? 0.4 : 0.75}
            strokeDasharray={showForecast ? "5 3" : undefined}
            name={type.replace(/_/g, " ")}
            connectNulls={false}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
