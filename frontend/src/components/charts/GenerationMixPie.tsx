import { useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { ProductionResponse } from "../../services/api";
import { format } from "date-fns";

// ── Colour palette (mirrors ProductionChart) ──────────────────────────────
const COLORS: Record<string, string> = {
  solar:                          "#F59E0B",
  wind_onshore:                   "#10B981",
  wind_offshore:                  "#0D9488",
  nuclear:                        "#8B5CF6",
  hydro_run_of_river:             "#06B6D4",
  hydro_run_of_river_and_poundage:"#0EA5E9",
  hydro_water_reservoir:          "#0284C7",
  hydro_pumped_storage:           "#1D4ED8",
  fossil_gas:                     "#F97316",
  fossil_hard_coal:               "#57534E",
  fossil_brown_coal_lignite:      "#78716C",
  fossil_coal_derived_gas:        "#A8A29E",
  fossil_oil:                     "#92400E",
  biomass:                        "#16A34A",
  geothermal:                     "#DC2626",
  other_renewable:                "#0891B2",
  waste:                          "#CA8A04",
  other:                          "#6B7280",
  gas:                            "#FB923C",
  coal:                           "#44403C",
};

const FALLBACK_COLOR = "#94A3B8";
const STEP_MS = 15 * 60 * 1000; // 15-min resolution
const STEP_TOLERANCE = 1.5;      // gap > 1.5 × step = discontinuity

interface Props {
  data: ProductionResponse[];
  startTs?: string;
  endTs?: string;
}

interface PieDatum {
  name: string;
  label: string;
  mwh: number;
  percent: number;
  color: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────

/** Find contiguous intervals from a sorted list of ISO timestamps. */
function contiguousIntervals(sortedTs: string[]): { start: string; end: string }[] {
  if (!sortedTs.length) return [];
  const intervals: { start: string; end: string }[] = [];
  let start = sortedTs[0];
  let prev = new Date(sortedTs[0]).getTime();

  for (let i = 1; i < sortedTs.length; i++) {
    const curr = new Date(sortedTs[i]).getTime();
    if (curr - prev > STEP_MS * STEP_TOLERANCE) {
      intervals.push({ start, end: sortedTs[i - 1] });
      start = sortedTs[i];
    }
    prev = curr;
  }
  intervals.push({ start, end: sortedTs[sortedTs.length - 1] });
  return intervals;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d: PieDatum = payload[0].payload;
  return (
    <div style={{
      background: "#fff",
      border: "1px solid rgba(0,0,0,0.08)",
      borderRadius: 10,
      padding: "10px 14px",
      fontSize: 12,
      minWidth: 190,
      boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
    }}>
      <div style={{ fontWeight: 700, color: d.color, marginBottom: 6 }}>{d.label}</div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, color: "#1d1d1f" }}>
        <span>Share</span>
        <span style={{ fontWeight: 700 }}>{d.percent.toFixed(1)} %</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, color: "#6e6e73", marginTop: 2 }}>
        <span>Energy</span>
        <span>{(d.mwh / 1000).toFixed(0)} GWh</span>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomLegend({ payload }: any) {
  if (!payload?.length) return null;
  return (
    <div style={{
      display: "flex",
      flexWrap: "wrap",
      gap: "6px 16px",
      paddingTop: 10,
      justifyContent: "center",
    }}>
      {payload.map((entry: any) => (
        <div key={entry.value} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#6e6e73" }}>
          <div style={{ width: 10, height: 10, borderRadius: "50%", background: entry.color, flexShrink: 0 }} />
          <span>{entry.payload.label}</span>
          <span style={{ color: "#aeaeb2" }}>({entry.payload.percent.toFixed(1)}%)</span>
        </div>
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────

export default function GenerationMixPie({ data, startTs, endTs }: Props) {
  const { pieData, coverageIntervals, hasGaps, totalSlots, completeSlots } = useMemo(() => {
    if (!data.length) return { pieData: [], coverageIntervals: [], hasGaps: false, totalSlots: 0, completeSlots: 0 };

    // Build per-timestamp map: ts → { type: mw }
    const tsMap = new Map<string, Map<string, number>>();
    const allTypes = new Set<string>();

    for (const series of data) {
      for (const p of series.actuals) {
        if (p.value_mw == null) continue;
        // Filter to selected window
        if (startTs && p.timestamp < startTs) continue;
        if (endTs   && p.timestamp > endTs)   continue;
        allTypes.add(series.production_type);
        if (!tsMap.has(p.timestamp)) tsMap.set(p.timestamp, new Map());
        tsMap.get(p.timestamp)!.set(series.production_type, p.value_mw);
      }
    }

    if (!tsMap.size) return { pieData: [], coverageIntervals: [], hasGaps: false, totalSlots: 0, completeSlots: 0 };

    const requiredTypes = Array.from(allTypes);
    const allTs = Array.from(tsMap.keys()).sort();
    const totalSlots = allTs.length;

    // Complete = every required production type has a value at this timestamp
    const completeTs = allTs.filter(ts => {
      const vals = tsMap.get(ts)!;
      return requiredTypes.every(t => vals.has(t));
    });

    const completeSlots = completeTs.length;
    const hasGaps = completeSlots < totalSlots;

    // Sum MWh (value_mw × 0.25 h) per type for complete timestamps only
    const totals = new Map<string, number>();
    for (const ts of completeTs) {
      const vals = tsMap.get(ts)!;
      for (const [type, mw] of vals) {
        totals.set(type, (totals.get(type) ?? 0) + mw * 0.25);
      }
    }

    const totalMwh = Array.from(totals.values()).reduce((a, b) => a + b, 0);
    if (totalMwh === 0) return { pieData: [], coverageIntervals: [], hasGaps, totalSlots, completeSlots };

    // Build pie slices, drop types with < 0.1% to keep chart readable
    const pieData: PieDatum[] = Array.from(totals.entries())
      .map(([type, mwh]) => ({
        name: type,
        label: type.replace(/_/g, " "),
        mwh,
        percent: (mwh / totalMwh) * 100,
        color: COLORS[type] ?? FALLBACK_COLOR,
      }))
      .filter(d => d.percent >= 0.1)
      .sort((a, b) => b.mwh - a.mwh);

    // Find contiguous complete intervals for the coverage warning
    const coverageIntervals = hasGaps ? contiguousIntervals(completeTs) : [];

    return { pieData, coverageIntervals, hasGaps, totalSlots, completeSlots };
  }, [data, startTs, endTs]);

  if (!pieData.length) return null;

  const coveragePct = totalSlots > 0 ? ((completeSlots / totalSlots) * 100).toFixed(0) : "0";

  return (
    <div style={{ marginTop: 24 }}>
      {/* Coverage warning */}
      {hasGaps && (
        <div style={{
          marginBottom: 14,
          padding: "10px 14px",
          background: "rgba(255, 159, 10, 0.06)",
          border: "1px solid rgba(255, 159, 10, 0.25)",
          borderRadius: 10,
          fontSize: 12,
          color: "#6e6e73",
          lineHeight: 1.6,
        }}>
          <span style={{ fontWeight: 600, color: "#ff9f0a" }}>⚠ Incomplete data in selected period ({coveragePct}% coverage). </span>
          The pie chart only includes time slots where all generation sources have data.
          {coverageIntervals.length > 0 && (
            <>
              {" "}Covered period{coverageIntervals.length > 1 ? "s" : ""}:{" "}
              {coverageIntervals.map((iv, i) => (
                <span key={i}>
                  {i > 0 && ", "}
                  <span style={{ color: "#1d1d1f", fontWeight: 500 }}>
                    {format(new Date(iv.start), "d MMM HH:mm")} → {format(new Date(iv.end), "d MMM HH:mm")}
                  </span>
                </span>
              ))}
            </>
          )}
        </div>
      )}

      {/* Pie chart */}
      <ResponsiveContainer width="100%" height={340}>
        <PieChart>
          <Pie
            data={pieData}
            dataKey="mwh"
            nameKey="label"
            cx="50%"
            cy="50%"
            innerRadius="38%"
            outerRadius="62%"
            paddingAngle={1}
          >
            {pieData.map((entry) => (
              <Cell key={entry.name} fill={entry.color} stroke="none" />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
          <Legend content={<CustomLegend />} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
