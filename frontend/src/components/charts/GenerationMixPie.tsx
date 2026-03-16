import { useMemo } from "react";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { ProductionResponse } from "../../services/api";
import { format } from "date-fns";

// ── Colour palette (mirrors ProductionChart) ──────────────────────────────
const COLORS: Record<string, string> = {
  solar:                           "#F59E0B",
  wind_onshore:                    "#10B981",
  wind_offshore:                   "#0D9488",
  nuclear:                         "#8B5CF6",
  hydro_run_of_river:              "#06B6D4",
  hydro_run_of_river_and_poundage: "#0EA5E9",
  hydro_water_reservoir:           "#0284C7",
  hydro_pumped_storage:            "#1D4ED8",
  fossil_gas:                      "#F97316",
  fossil_hard_coal:                "#57534E",
  fossil_brown_coal_lignite:       "#78716C",
  fossil_coal_derived_gas:         "#A8A29E",
  fossil_oil:                      "#92400E",
  biomass:                         "#16A34A",
  geothermal:                      "#DC2626",
  other_renewable:                 "#0891B2",
  waste:                           "#CA8A04",
  other:                           "#6B7280",
  gas:                             "#FB923C",
  coal:                            "#44403C",
};

const FALLBACK_COLOR = "#94A3B8";
const MAX_INTERVALS_SHOWN = 3;

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

/** Mode of consecutive gaps — the dominant sampling interval in ms. */
function inferStepMs(sortedTs: string[]): number {
  if (sortedTs.length < 2) return 15 * 60 * 1000;
  const counts: Record<number, number> = {};
  for (let i = 1; i < Math.min(sortedTs.length, 200); i++) {
    const d = new Date(sortedTs[i]).getTime() - new Date(sortedTs[i - 1]).getTime();
    if (d > 0) counts[d] = (counts[d] ?? 0) + 1;
  }
  const entries = Object.entries(counts);
  if (!entries.length) return 15 * 60 * 1000;
  return Number(entries.sort((a, b) => Number(b[1]) - Number(a[1]))[0][0]);
}

/**
 * Split a sorted timestamp list into contiguous runs using the detected step.
 * Two timestamps belong to the same run when their gap ≤ stepMs × 1.6.
 */
function contiguousIntervals(sortedTs: string[], stepMs: number): { start: string; end: string }[] {
  if (!sortedTs.length) return [];
  const out: { start: string; end: string }[] = [];
  let start = sortedTs[0];
  let prev = new Date(sortedTs[0]).getTime();

  for (let i = 1; i < sortedTs.length; i++) {
    const curr = new Date(sortedTs[i]).getTime();
    if (curr - prev > stepMs * 1.6) {
      out.push({ start, end: sortedTs[i - 1] });
      start = sortedTs[i];
    }
    prev = curr;
  }
  out.push({ start, end: sortedTs[sortedTs.length - 1] });
  return out;
}

function fmtTs(iso: string): string {
  return format(new Date(iso), "d MMM HH:mm");
}

// ── Tooltip / Legend ──────────────────────────────────────────────────────

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
        <span>{d.mwh >= 1000 ? `${(d.mwh / 1000).toFixed(1)} GWh` : `${d.mwh.toFixed(0)} MWh`}</span>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function CustomLegend({ payload }: any) {
  if (!payload?.length) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", paddingTop: 10, justifyContent: "center" }}>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
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
  const { pieData, coverageIntervals, hasGaps, totalSlots, completeSlots, stepHours } = useMemo(() => {
    const empty = { pieData: [] as PieDatum[], coverageIntervals: [] as { start: string; end: string }[], hasGaps: false, totalSlots: 0, completeSlots: 0, stepHours: 0.25 };
    if (!data.length) return empty;

    // Build per-timestamp map: ts → { type: mw }
    const tsMap = new Map<string, Map<string, number>>();
    const allTypes = new Set<string>();

    for (const series of data) {
      for (const p of series.actuals) {
        if (p.value_mw == null) continue;
        if (startTs && p.timestamp < startTs) continue;
        if (endTs   && p.timestamp > endTs)   continue;
        allTypes.add(series.production_type);
        if (!tsMap.has(p.timestamp)) tsMap.set(p.timestamp, new Map());
        tsMap.get(p.timestamp)!.set(series.production_type, p.value_mw);
      }
    }

    if (!tsMap.size) return empty;

    const requiredTypes = Array.from(allTypes);
    const allTs = Array.from(tsMap.keys()).sort();
    const totalSlots = allTs.length;

    // Complete = every production type present at this timestamp
    const completeTs = allTs.filter(ts =>
      requiredTypes.every(t => tsMap.get(ts)!.has(t))
    );
    const completeSlots = completeTs.length;
    const hasGaps = completeSlots < totalSlots;

    // Infer the actual sampling step from complete timestamps
    const stepMs = inferStepMs(completeTs.length >= 2 ? completeTs : allTs);
    const stepHours = stepMs / 3_600_000;

    // Sum energy per type using the inferred step
    const totals = new Map<string, number>();
    for (const ts of completeTs) {
      for (const [type, mw] of tsMap.get(ts)!) {
        totals.set(type, (totals.get(type) ?? 0) + mw * stepHours);
      }
    }

    const totalMwh = Array.from(totals.values()).reduce((a, b) => a + b, 0);
    if (totalMwh === 0) return { ...empty, hasGaps, totalSlots, completeSlots, stepHours };

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

    const coverageIntervals = hasGaps ? contiguousIntervals(completeTs, stepMs) : [];

    return { pieData, coverageIntervals, hasGaps, totalSlots, completeSlots, stepHours };
  }, [data, startTs, endTs]);

  if (!pieData.length) return null;

  const coveragePct = totalSlots > 0 ? Math.round((completeSlots / totalSlots) * 100) : 0;
  const stepLabel = stepHours >= 1
    ? `${stepHours.toFixed(0)}-hour`
    : `${Math.round(stepHours * 60)}-min`;

  // Build compact interval description (max MAX_INTERVALS_SHOWN shown)
  const visibleIntervals = coverageIntervals.slice(0, MAX_INTERVALS_SHOWN);
  const hiddenCount = coverageIntervals.length - visibleIntervals.length;

  return (
    <div style={{ marginTop: 24 }}>
      {hasGaps && (
        <div style={{
          marginBottom: 14,
          padding: "10px 14px",
          background: "rgba(255, 159, 10, 0.06)",
          border: "1px solid rgba(255, 159, 10, 0.25)",
          borderRadius: 10,
          fontSize: 12,
          color: "#6e6e73",
          lineHeight: 1.7,
        }}>
          <div>
            <span style={{ fontWeight: 600, color: "#ff9f0a" }}>⚠ Partial data coverage ({coveragePct}%)</span>
            {" "}— not all generation sources report at every {stepLabel} slot in this period. The pie only counts slots where every source has a value.
          </div>
          {coverageIntervals.length > 0 && (
            <div style={{ marginTop: 4 }}>
              <span style={{ color: "#aeaeb2" }}>Included: </span>
              {visibleIntervals.map((iv, i) => (
                <span key={i}>
                  {i > 0 && <span style={{ color: "#aeaeb2" }}> · </span>}
                  <span style={{ color: "#1d1d1f", fontWeight: 500 }}>
                    {iv.start === iv.end
                      ? fmtTs(iv.start)
                      : `${fmtTs(iv.start)} – ${fmtTs(iv.end)}`}
                  </span>
                </span>
              ))}
              {hiddenCount > 0 && (
                <span style={{ color: "#aeaeb2" }}> · and {hiddenCount} more period{hiddenCount > 1 ? "s" : ""}</span>
              )}
            </div>
          )}
        </div>
      )}

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
