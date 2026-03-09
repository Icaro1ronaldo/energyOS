import {
  ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { format } from "date-fns";
import { ZONE_COLORS } from "../../constants/zones";

interface Props {
  data: Record<string, unknown>[];
  zones: string[];
  unit: string;
  loading?: boolean;
}

export default function MultiZoneLineChart({ data, zones, unit, loading }: Props) {
  if (loading) {
    return <div style={{ textAlign: "center", padding: 48, color: "#94a3b8", fontSize: 13 }}>Loading…</div>;
  }
  if (!data.length) {
    return <div style={{ textAlign: "center", padding: 48, color: "#4a5568", fontSize: 13 }}>No data for selected range.</div>;
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={data} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2d3748" />
        <XAxis
          dataKey="timestamp"
          tickFormatter={ts => format(new Date(ts as string), "dd/MM HH:mm")}
          stroke="#4a5568"
          tick={{ fill: "#94a3b8", fontSize: 11 }}
          minTickGap={60}
        />
        <YAxis
          stroke="#4a5568"
          tick={{ fill: "#94a3b8", fontSize: 11 }}
          unit={` ${unit}`}
          width={78}
        />
        <Tooltip
          contentStyle={{ background: "#1a1f2e", border: "1px solid #2d3748", fontSize: 12 }}
          labelStyle={{ color: "#94a3b8" }}
          labelFormatter={ts => format(new Date(ts as string), "dd MMM yyyy HH:mm")}
          formatter={(val, name) => [
            typeof val === "number" ? `${val.toFixed(2)} ${unit}` : val,
            name,
          ]}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: "#94a3b8" }} />
        {zones.map(zone => (
          <Line
            key={zone}
            type="monotone"
            dataKey={zone}
            stroke={ZONE_COLORS[zone] ?? "#888"}
            dot={false}
            strokeWidth={2}
            connectNulls={false}
            name={zone}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
