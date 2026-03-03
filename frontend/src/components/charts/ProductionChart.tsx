import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from "recharts";
import { ProductionResponse } from "../../services/api";
import { format } from "date-fns";

interface Props {
  data: ProductionResponse[];
  showForecast?: boolean;
}

const COLORS: Record<string, string> = {
  solar: "#f6e05e",
  wind_onshore: "#68d391",
  wind_offshore: "#48bb78",
  nuclear: "#f687b3",
  hydro_run_of_river: "#63b3ed",
  hydro_reservoir: "#4299e1",
  hydro_pumped_storage: "#3182ce",
  fossil_gas: "#fc8181",
  fossil_coal: "#a0aec0",
  fossil_oil: "#9f7aea",
  biomass: "#b7791f",
  geothermal: "#ed8936",
  other_renewable: "#81e6d9",
  other: "#718096",
};

export default function ProductionChart({ data, showForecast = false }: Props) {
  // Merge all types into a single time-indexed dataset
  const timeMap: Record<string, Record<string, number>> = {};

  for (const series of data) {
    const points = showForecast ? series.forecasts : series.actuals;
    for (const p of points) {
      if (!timeMap[p.timestamp]) timeMap[p.timestamp] = {};
      timeMap[p.timestamp][series.production_type] = p.value_mw ?? 0;
    }
  }

  const chartData = Object.entries(timeMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ts, values]) => ({ ts, ...values }));

  const types = data.map((d) => d.production_type);

  return (
    <ResponsiveContainer width="100%" height={360}>
      <AreaChart data={chartData}>
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
        {types.map((type) => (
          <Area
            key={type}
            type="monotone"
            dataKey={type}
            stackId="1"
            stroke={COLORS[type] ?? "#94a3b8"}
            fill={COLORS[type] ?? "#94a3b8"}
            fillOpacity={showForecast ? 0.4 : 0.7}
            strokeDasharray={showForecast ? "5 3" : undefined}
            name={type.replace(/_/g, " ")}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}
