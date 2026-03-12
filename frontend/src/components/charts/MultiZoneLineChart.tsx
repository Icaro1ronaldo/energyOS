import {
  ResponsiveContainer, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceArea,
} from "recharts";
import { format } from "date-fns";
import { ZONE_COLORS } from "../../constants/zones";
import { collectGaps } from "../../utils/gapFill";

interface Props {
  data: Record<string, unknown>[];
  zones: string[];
  unit: string;
  loading?: boolean;
}

export default function MultiZoneLineChart({ data, zones, unit, loading }: Props) {
  if (loading) {
    return <div style={{ textAlign: "center", padding: 48, color: "#aeaeb2", fontSize: 13 }}>Loading…</div>;
  }
  if (!data.length) {
    return <div style={{ textAlign: "center", padding: 48, color: "#aeaeb2", fontSize: 13 }}>No data for selected range.</div>;
  }

  const gaps = collectGaps(data, "timestamp");

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={data} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
        <XAxis
          dataKey="timestamp"
          tickFormatter={ts => format(new Date(ts as string), "dd/MM HH:mm")}
          stroke="rgba(0,0,0,0.1)"
          tick={{ fill: "#636366", fontSize: 11 }}
          minTickGap={60}
        />
        <YAxis
          stroke="rgba(0,0,0,0.1)"
          tick={{ fill: "#636366", fontSize: 11 }}
          unit={` ${unit}`}
          width={78}
        />
        <Tooltip
          contentStyle={{ background: "#fff", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 10, fontSize: 12, boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}
          labelStyle={{ color: "#6e6e73" }}
          labelFormatter={ts => format(new Date(ts as string), "dd MMM yyyy HH:mm")}
          formatter={(val, name) => [
            typeof val === "number" ? `${val.toFixed(2)} ${unit}` : val,
            name,
          ]}
        />
        <Legend wrapperStyle={{ fontSize: 12, color: "#6e6e73" }} />
        {gaps.map(g => (
          <ReferenceArea key={g.x1} x1={g.x1} x2={g.x2} fill="rgba(120,120,128,0.1)" strokeOpacity={0} />
        ))}
        {zones.map(zone => (
          <Line
            key={zone}
            type="monotone"
            dataKey={zone}
            stroke={ZONE_COLORS[zone] ?? "#636366"}
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
