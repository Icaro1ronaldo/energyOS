import { useMemo, useState } from "react";
import { PieChart, Pie, Cell, Sector, Tooltip, ResponsiveContainer } from "recharts";
import { ProductionResponse } from "../../services/api";
import { format } from "date-fns";

// ── Colour palette ────────────────────────────────────────────────────────
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

// ── Category classification ────────────────────────────────────────────────
const RENEWABLE_TYPES = new Set([
  "solar", "wind_onshore", "wind_offshore",
  "hydro_run_of_river", "hydro_run_of_river_and_poundage", "hydro_water_reservoir",
  "hydro_pumped_storage", "biomass", "geothermal", "other_renewable", "waste",
]);
const LOW_CARBON_TYPES = new Set([...RENEWABLE_TYPES, "nuclear"]);
const FOSSIL_TYPES = new Set([
  "fossil_gas", "fossil_hard_coal", "fossil_brown_coal_lignite",
  "fossil_coal_derived_gas", "fossil_oil", "gas", "coal",
]);

// LCA median CO₂ intensity in g/kWh (IPCC AR6 values)
const CO2_G_PER_KWH: Record<string, number> = {
  solar: 20, wind_onshore: 11, wind_offshore: 11,
  hydro_run_of_river: 24, hydro_run_of_river_and_poundage: 24,
  hydro_water_reservoir: 24, hydro_pumped_storage: 24,
  nuclear: 12, biomass: 230, geothermal: 38,
  other_renewable: 50, waste: 300, other: 400,
  fossil_gas: 490, gas: 490,
  fossil_hard_coal: 820, coal: 820,
  fossil_brown_coal_lignite: 1000,
  fossil_coal_derived_gas: 700,
  fossil_oil: 650,
};

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
  category: "renewable" | "nuclear" | "fossil" | "other";
}

// ── Helpers ───────────────────────────────────────────────────────────────

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

function contiguousIntervals(sortedTs: string[], stepMs: number) {
  if (!sortedTs.length) return [] as { start: string; end: string }[];
  const out: { start: string; end: string }[] = [];
  let start = sortedTs[0];
  let prev = new Date(sortedTs[0]).getTime();
  for (let i = 1; i < sortedTs.length; i++) {
    const curr = new Date(sortedTs[i]).getTime();
    if (curr - prev > stepMs * 1.6) { out.push({ start, end: sortedTs[i - 1] }); start = sortedTs[i]; }
    prev = curr;
  }
  out.push({ start, end: sortedTs[sortedTs.length - 1] });
  return out;
}

function fmtTs(iso: string) { return format(new Date(iso), "d MMM HH:mm"); }

function categorise(name: string): PieDatum["category"] {
  if (RENEWABLE_TYPES.has(name)) return "renewable";
  if (name === "nuclear") return "nuclear";
  if (FOSSIL_TYPES.has(name)) return "fossil";
  return "other";
}

const CATEGORY_LABEL: Record<string, string> = {
  renewable: "Renewable", nuclear: "Nuclear", fossil: "Fossil", other: "Other",
};
const CATEGORY_COLOR: Record<string, string> = {
  renewable: "#30d158", nuclear: "#8B5CF6", fossil: "#FF6B35", other: "#6B7280",
};

// ── Active donut slice ────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ActiveSlice(props: any) {
  const { cx, cy, innerRadius, outerRadius, startAngle, endAngle, fill } = props;
  return (
    <Sector
      cx={cx} cy={cy}
      innerRadius={innerRadius - 3}
      outerRadius={outerRadius + 8}
      startAngle={startAngle}
      endAngle={endAngle}
      fill={fill}
      opacity={1}
    />
  );
}

// ── Tooltip ───────────────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SliceTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const d: PieDatum = payload[0].payload;
  return (
    <div style={{
      background: "#fff", border: "1px solid rgba(0,0,0,0.08)",
      borderRadius: 10, padding: "10px 14px", fontSize: 12,
      minWidth: 180, boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
        <div style={{ width: 10, height: 10, borderRadius: "50%", background: d.color, flexShrink: 0 }} />
        <span style={{ fontWeight: 700, color: "#1d1d1f" }}>{d.label}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 20, color: "#1d1d1f" }}>
        <span style={{ color: "#6e6e73" }}>Share</span>
        <span style={{ fontWeight: 700 }}>{d.percent.toFixed(1)}%</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 20, marginTop: 3 }}>
        <span style={{ color: "#6e6e73" }}>Energy</span>
        <span style={{ color: "#1d1d1f" }}>
          {d.mwh >= 1000 ? `${(d.mwh / 1000).toFixed(2)} GWh` : `${d.mwh.toFixed(0)} MWh`}
        </span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 20, marginTop: 3 }}>
        <span style={{ color: "#6e6e73" }}>Type</span>
        <span style={{ color: CATEGORY_COLOR[d.category], fontWeight: 600, fontSize: 11 }}>
          {CATEGORY_LABEL[d.category]}
        </span>
      </div>
    </div>
  );
}

// ── KPI tile ──────────────────────────────────────────────────────────────
function KpiTile({ label, value, unit, accent }: { label: string; value: string; unit: string; accent?: string }) {
  return (
    <div style={{
      flex: "1 1 120px",
      background: "#fff",
      border: "1px solid rgba(0,0,0,0.07)",
      borderRadius: 12,
      padding: "12px 16px",
      boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
    }}>
      <div style={{ fontSize: 10, color: "#aeaeb2", letterSpacing: "0.4px", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
        <span style={{ fontSize: 20, fontWeight: 700, color: accent ?? "#1d1d1f", lineHeight: 1 }}>{value}</span>
        <span style={{ fontSize: 11, color: "#6e6e73" }}>{unit}</span>
      </div>
    </div>
  );
}

// ── Source row (ranked breakdown) ─────────────────────────────────────────
function SourceRow({ d, maxPct, active, onEnter, onLeave }: {
  d: PieDatum; maxPct: number;
  active: boolean;
  onEnter: () => void; onLeave: () => void;
}) {
  return (
    <div
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={{
        display: "grid",
        gridTemplateColumns: "10px 1fr auto auto",
        alignItems: "center",
        gap: 8,
        padding: "5px 6px",
        borderRadius: 8,
        background: active ? "rgba(0,0,0,0.03)" : "transparent",
        cursor: "default",
        transition: "background 0.15s",
      }}
    >
      {/* colour dot */}
      <div style={{ width: 8, height: 8, borderRadius: "50%", background: d.color, flexShrink: 0 }} />

      {/* label + bar */}
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 11, color: "#1d1d1f", marginBottom: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {d.label}
        </div>
        <div style={{ height: 4, borderRadius: 2, background: "rgba(0,0,0,0.06)", overflow: "hidden" }}>
          <div style={{
            height: "100%",
            width: `${(d.percent / maxPct) * 100}%`,
            background: d.color,
            borderRadius: 2,
            transition: "width 0.4s ease",
          }} />
        </div>
      </div>

      {/* % */}
      <div style={{ fontSize: 11, fontWeight: 600, color: "#1d1d1f", textAlign: "right", whiteSpace: "nowrap" }}>
        {d.percent.toFixed(1)}%
      </div>

      {/* GWh */}
      <div style={{ fontSize: 10, color: "#aeaeb2", textAlign: "right", whiteSpace: "nowrap", minWidth: 48 }}>
        {d.mwh >= 1000 ? `${(d.mwh / 1000).toFixed(1)} GWh` : `${d.mwh.toFixed(0)} MWh`}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────

export default function GenerationMixPie({ data, startTs, endTs }: Props) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);

  const { pieData, coverageIntervals, hasGaps, totalSlots, completeSlots, stepHours, totalMwh } = useMemo(() => {
    const empty = {
      pieData: [] as PieDatum[], coverageIntervals: [] as { start: string; end: string }[],
      hasGaps: false, totalSlots: 0, completeSlots: 0, stepHours: 0.25, totalMwh: 0,
    };
    if (!data.length) return empty;

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
    const completeTs = allTs.filter(ts => requiredTypes.every(t => tsMap.get(ts)!.has(t)));
    const completeSlots = completeTs.length;
    const hasGaps = completeSlots < totalSlots;

    const stepMs = inferStepMs(completeTs.length >= 2 ? completeTs : allTs);
    const stepHours = stepMs / 3_600_000;

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
        category: categorise(type),
      }))
      .filter(d => d.percent >= 0.05)
      .sort((a, b) => b.mwh - a.mwh);

    const coverageIntervals = hasGaps ? contiguousIntervals(completeTs, stepMs) : [];
    return { pieData, coverageIntervals, hasGaps, totalSlots, completeSlots, stepHours, totalMwh };
  }, [data, startTs, endTs]);

  if (!pieData.length) return null;

  // ── Derived KPIs ──────────────────────────────────────────────────────
  const totalGwh = totalMwh / 1000;
  const renewableMwh = pieData.filter(d => RENEWABLE_TYPES.has(d.name)).reduce((s, d) => s + d.mwh, 0);
  const carbonFreeMwh = pieData.filter(d => LOW_CARBON_TYPES.has(d.name)).reduce((s, d) => s + d.mwh, 0);
  const renewablePct = totalMwh > 0 ? (renewableMwh / totalMwh) * 100 : 0;
  const carbonFreePct = totalMwh > 0 ? (carbonFreeMwh / totalMwh) * 100 : 0;
  const co2Intensity = totalMwh > 0
    ? pieData.reduce((s, d) => s + d.mwh * (CO2_G_PER_KWH[d.name] ?? 400), 0) / totalMwh
    : 0;

  const maxPct = pieData[0]?.percent ?? 1;
  const coveragePct = totalSlots > 0 ? Math.round((completeSlots / totalSlots) * 100) : 0;
  const visibleIntervals = coverageIntervals.slice(0, MAX_INTERVALS_SHOWN);
  const hiddenCount = coverageIntervals.length - visibleIntervals.length;
  const stepLabel = stepHours >= 1 ? `${stepHours.toFixed(0)}-hour` : `${Math.round(stepHours * 60)}-min`;

  // Group sources for ranked list: renewable → nuclear → fossil → other
  const grouped = (["renewable", "nuclear", "fossil", "other"] as const).flatMap(cat =>
    pieData.filter(d => d.category === cat)
  );

  return (
    <div>
      {/* ── KPI row ─────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <KpiTile label="Total Generation"  value={totalGwh >= 1000 ? (totalGwh / 1000).toFixed(2) : totalGwh.toFixed(1)} unit={totalGwh >= 1000 ? "TWh" : "GWh"} />
        <KpiTile label="Renewable Share"   value={renewablePct.toFixed(1)}  unit="%" accent="#30d158" />
        <KpiTile label="Carbon-free"       value={carbonFreePct.toFixed(1)} unit="%" accent="#0071e3" />
        <KpiTile label="CO₂ Intensity"     value={co2Intensity.toFixed(0)}  unit="g/kWh" accent={co2Intensity < 200 ? "#30d158" : co2Intensity < 400 ? "#ffd60a" : "#ff453a"} />
      </div>

      {/* ── Chart area ──────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>

        {/* Donut */}
        <div style={{ position: "relative", flex: "0 0 260px" }}>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="mwh"
                nameKey="label"
                cx="50%" cy="50%"
                innerRadius="44%" outerRadius="66%"
                paddingAngle={1}
                activeIndex={activeIdx ?? undefined}
                activeShape={<ActiveSlice />}
                onMouseEnter={(_, i) => setActiveIdx(i)}
                onMouseLeave={() => setActiveIdx(null)}
              >
                {pieData.map((entry, i) => (
                  <Cell
                    key={entry.name}
                    fill={entry.color}
                    stroke="none"
                    opacity={activeIdx === null || activeIdx === i ? 1 : 0.45}
                  />
                ))}
              </Pie>
              <Tooltip content={<SliceTooltip />} />
            </PieChart>
          </ResponsiveContainer>

          {/* Centre label */}
          <div style={{
            position: "absolute", top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            textAlign: "center", pointerEvents: "none",
          }}>
            <div style={{ fontSize: 19, fontWeight: 700, color: "#1d1d1f", lineHeight: 1.1 }}>
              {totalGwh >= 1000 ? `${(totalGwh / 1000).toFixed(1)}` : totalGwh.toFixed(1)}
            </div>
            <div style={{ fontSize: 10, color: "#aeaeb2", marginBottom: 4 }}>
              {totalGwh >= 1000 ? "TWh" : "GWh"}
            </div>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 3,
              background: "rgba(48,209,88,0.1)", borderRadius: 10,
              padding: "2px 7px",
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#30d158" }}>
                ♻ {renewablePct.toFixed(0)}%
              </span>
            </div>
          </div>
        </div>

        {/* Ranked breakdown */}
        <div style={{ flex: "1 1 220px", minWidth: 0 }}>
          {/* Category legend pills */}
          <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
            {(["renewable", "nuclear", "fossil", "other"] as const).map(cat => {
              const catMwh = pieData.filter(d => d.category === cat).reduce((s, d) => s + d.mwh, 0);
              if (catMwh === 0) return null;
              const catPct = ((catMwh / totalMwh) * 100).toFixed(1);
              return (
                <div key={cat} style={{
                  display: "flex", alignItems: "center", gap: 4,
                  background: "rgba(0,0,0,0.04)", borderRadius: 20,
                  padding: "3px 9px", fontSize: 11,
                }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: CATEGORY_COLOR[cat] }} />
                  <span style={{ color: "#6e6e73" }}>{CATEGORY_LABEL[cat]}</span>
                  <span style={{ color: "#1d1d1f", fontWeight: 600 }}>{catPct}%</span>
                </div>
              );
            })}
          </div>

          {/* Source rows */}
          <div>
            {grouped.map((d) => (
              <SourceRow
                key={d.name}
                d={d}
                maxPct={maxPct}
                active={activeIdx === pieData.indexOf(d)}
                onEnter={() => setActiveIdx(pieData.indexOf(d))}
                onLeave={() => setActiveIdx(null)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── Coverage warning ────────────────────────────────────────── */}
      {hasGaps && (
        <div style={{
          marginTop: 16,
          padding: "9px 13px",
          background: "rgba(255,159,10,0.05)",
          border: "1px solid rgba(255,159,10,0.22)",
          borderRadius: 10, fontSize: 11, color: "#6e6e73", lineHeight: 1.6,
        }}>
          <span style={{ fontWeight: 600, color: "#ff9f0a" }}>⚠ Partial coverage ({coveragePct}%)</span>
          {" "}— some sources have gaps at {stepLabel} resolution. Pie reflects only complete slots.
          {visibleIntervals.length > 0 && (
            <span>
              {" "}Included:{" "}
              {visibleIntervals.map((iv, i) => (
                <span key={i}>
                  {i > 0 && <span style={{ color: "#aeaeb2" }}> · </span>}
                  <span style={{ color: "#1d1d1f", fontWeight: 500 }}>
                    {iv.start === iv.end ? fmtTs(iv.start) : `${fmtTs(iv.start)} – ${fmtTs(iv.end)}`}
                  </span>
                </span>
              ))}
              {hiddenCount > 0 && <span style={{ color: "#aeaeb2" }}> · +{hiddenCount} more</span>}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
