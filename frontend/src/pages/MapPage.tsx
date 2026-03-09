import { useState, useMemo } from "react";
import { subDays, format } from "date-fns";
import { useMultiZonePrices, useMultiZoneLoad, useMultiZoneProduction } from "../hooks/useMultiZoneData";
import EuropeMap from "../components/EuropeMap";
import MultiZoneLineChart from "../components/charts/MultiZoneLineChart";
import DateRangePicker from "../components/DateRangePicker";
import { MAP_ZONES, ZONE_COLORS, PROD_TYPE_COLOR, prodTypeLabel } from "../constants/zones";
import { PriceResponse, LoadResponse, ProductionResponse } from "../services/api";

type Metric = "prices" | "load" | "production";

// 15-min resolution → each sample covers 0.25 h
const H_PER_SAMPLE = 0.25;

// ── color scale: green (low) → yellow → red (high) ────────────────────────────

function lerp(a: number, b: number, t: number) { return Math.round(a + (b - a) * t); }

function makeColorScale(min: number, max: number): (v: number) => string {
  return (v: number) => {
    if (min === max) return "#68d391";
    const t = Math.max(0, Math.min(1, (v - min) / (max - min)));
    const [r1, g1, b1] = t < 0.5 ? [104, 211, 145] : [246, 224, 94];
    const [r2, g2, b2] = t < 0.5 ? [246, 224, 94]  : [252, 129, 129];
    const tt = t < 0.5 ? t * 2 : (t - 0.5) * 2;
    return `rgb(${lerp(r1, r2, tt)},${lerp(g1, g2, tt)},${lerp(b1, b2, tt)})`;
  };
}

// ── aggregate helpers ──────────────────────────────────────────────────────────

/** Average price €/MWh over the period. */
function avgPrice(d: PriceResponse | null): number | null {
  const pts = d?.actuals ?? [];
  if (!pts.length) return null;
  const sum = pts.reduce((acc, p) => acc + (Number(p.price_eur_mwh) || 0), 0);
  return sum / pts.length;
}

/** Total energy GWh over the period (MW × 0.25 h per 15-min sample → MWh → /1000 → GWh). */
function totalGWh(mwValues: number[]): number | null {
  if (!mwValues.length) return null;
  return mwValues.reduce((acc, v) => acc + v, 0) * H_PER_SAMPLE / 1000;
}

// ── time-series merging for comparison chart ───────────────────────────────────

function mergePriceSeries(zoneData: Record<string, PriceResponse | null>): Record<string, unknown>[] {
  const byTs = new Map<string, Record<string, unknown>>();
  for (const [zone, d] of Object.entries(zoneData)) {
    if (!d) continue;
    for (const p of d.actuals) {
      if (!byTs.has(p.timestamp)) byTs.set(p.timestamp, { timestamp: p.timestamp });
      byTs.get(p.timestamp)![zone] = Number(p.price_eur_mwh);
    }
  }
  return Array.from(byTs.values()).sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
}

function mergeLoadSeries(zoneData: Record<string, LoadResponse | null>): Record<string, unknown>[] {
  const byTs = new Map<string, Record<string, unknown>>();
  for (const [zone, d] of Object.entries(zoneData)) {
    if (!d) continue;
    for (const p of d.actuals) {
      if (!byTs.has(p.timestamp)) byTs.set(p.timestamp, { timestamp: p.timestamp });
      byTs.get(p.timestamp)![zone] = Number(p.load_mw);
    }
  }
  return Array.from(byTs.values()).sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
}

function mergeProdSeries(zoneData: Record<string, ProductionResponse[] | null>): Record<string, unknown>[] {
  const byTs = new Map<string, Record<string, unknown>>();
  for (const [zone, types] of Object.entries(zoneData)) {
    if (!types) continue;
    const totals = new Map<string, number>();
    for (const t of types) {
      for (const p of t.actuals) {
        totals.set(p.timestamp, (totals.get(p.timestamp) ?? 0) + (Number(p.value_mw) || 0));
      }
    }
    for (const [ts, val] of totals) {
      if (!byTs.has(ts)) byTs.set(ts, { timestamp: ts });
      byTs.get(ts)![zone] = val;
    }
  }
  return Array.from(byTs.values()).sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
}

// ── CSV export ─────────────────────────────────────────────────────────────────

function downloadCSV(
  metric: Metric,
  allPrices: Record<string, PriceResponse | null>,
  allLoad: Record<string, LoadResponse | null>,
  allProd: Record<string, ProductionResponse[] | null>,
  startDate: Date,
  endDate: Date,
) {
  const dateTag = `${format(startDate, "yyyy-MM-dd")}_${format(endDate, "yyyy-MM-dd")}`;
  let header: string;
  const rows: string[] = [];

  if (metric === "prices") {
    header = "timestamp,zone,price_eur_mwh";
    for (const [zone, d] of Object.entries(allPrices)) {
      if (!d) continue;
      for (const p of d.actuals) {
        rows.push(`${p.timestamp},${zone},${p.price_eur_mwh}`);
      }
    }
  } else if (metric === "load") {
    header = "timestamp,zone,load_mw";
    for (const [zone, d] of Object.entries(allLoad)) {
      if (!d) continue;
      for (const p of d.actuals) {
        rows.push(`${p.timestamp},${zone},${p.load_mw}`);
      }
    }
  } else {
    header = "timestamp,zone,production_type,value_mw";
    for (const [zone, types] of Object.entries(allProd)) {
      if (!types) continue;
      for (const t of types) {
        for (const p of t.actuals) {
          rows.push(`${p.timestamp},${zone},${t.production_type},${p.value_mw}`);
        }
      }
    }
  }

  rows.sort();
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `energyOS_${metric}_${dateTag}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── styles ─────────────────────────────────────────────────────────────────────

const BTN: React.CSSProperties = {
  background: "transparent", color: "#94a3b8", border: "1px solid #2d3748",
  borderRadius: 6, padding: "6px 14px", fontSize: 13, cursor: "pointer",
};
const BTN_ON: React.CSSProperties = { ...BTN, background: "#2d3748", color: "#e2e8f0" };

// ── component ──────────────────────────────────────────────────────────────────

export default function MapPage() {
  const [metric, setMetric]           = useState<Metric>("prices");
  const [selectedZones, setSelectedZones] = useState<string[]>(["DE_LU", "FR"]);
  const [startDate, setStartDate]     = useState(() => subDays(new Date(), 7));
  const [endDate, setEndDate]         = useState(() => new Date());

  const startIso = startDate.toISOString();
  const endIso   = endDate.toISOString();

  // Fetch ALL map zones for the selected period → used for both map coloring and chart
  const { data: allPrices, loading: lPrice } = useMultiZonePrices(
    metric === "prices"     ? MAP_ZONES : [], startIso, endIso,
  );
  const { data: allLoad, loading: lLoad } = useMultiZoneLoad(
    metric === "load"       ? MAP_ZONES : [], startIso, endIso,
  );
  // Always fetch production — used for both the choropleth and the mini pie overlays
  const { data: allProd, loading: lProd } = useMultiZoneProduction(MAP_ZONES, startIso, endIso);

  // lProd only blocks the metric-specific UI when production is the active metric
  const anyLoading = lPrice || lLoad || (metric === "production" && lProd);

  // ── zone aggregate values for map coloring ────────────────────────────────
  const zoneValues = useMemo<Record<string, number | null>>(() => {
    const v: Record<string, number | null> = {};

    if (metric === "prices") {
      for (const [zone, d] of Object.entries(allPrices)) {
        v[zone] = avgPrice(d);
      }
    } else if (metric === "load") {
      for (const [zone, d] of Object.entries(allLoad)) {
        const mw = d?.actuals.map(p => Number(p.load_mw) || 0) ?? [];
        v[zone] = totalGWh(mw);
      }
    } else {
      for (const [zone, types] of Object.entries(allProd)) {
        if (!types) { v[zone] = null; continue; }
        // Sum all production types across all timestamps
        const mw: number[] = [];
        const byTs = new Map<string, number>();
        for (const t of types) {
          for (const p of t.actuals) {
            byTs.set(p.timestamp, (byTs.get(p.timestamp) ?? 0) + (Number(p.value_mw) || 0));
          }
        }
        byTs.forEach(val => mw.push(val));
        v[zone] = totalGWh(mw);
      }
    }
    return v;
  }, [metric, allPrices, allLoad, allProd]);

  // ── production mix per zone (always derived from allProd) ─────────────────
  const productionMix = useMemo(() => {
    const mix: Record<string, Record<string, number>> = {};
    for (const [zone, types] of Object.entries(allProd)) {
      if (!types) continue;
      mix[zone] = {};
      for (const t of types) {
        const total = t.actuals.reduce((s, p) => s + (Number(p.value_mw) || 0), 0);
        mix[zone][t.production_type] = (mix[zone][t.production_type] ?? 0) + total;
      }
    }
    return Object.keys(mix).length ? mix : null;
  }, [allProd]);

  // Production types that appear in the data, sorted by total output (for the legend)
  const activeProdTypes = useMemo(() => {
    if (!productionMix) return [];
    const totals: Record<string, number> = {};
    for (const mix of Object.values(productionMix)) {
      for (const [type, val] of Object.entries(mix)) {
        totals[type] = (totals[type] ?? 0) + val;
      }
    }
    return Object.entries(totals)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([type]) => type);
  }, [productionMix]);

  // Color scale across all zone values
  const nums   = Object.values(zoneValues).filter((v): v is number => v != null);
  const minVal = nums.length ? Math.min(...nums) : 0;
  const maxVal = nums.length ? Math.max(...nums) : 1;
  const colorFn = useMemo(() => makeColorScale(minVal, maxVal), [minVal, maxVal]);

  // Map unit label
  const mapUnit   = metric === "prices" ? "€/MWh (avg)" : "GWh (total)";
  const chartUnit = metric === "prices" ? "€/MWh" : "MW";

  // ── comparison chart data (filtered to selectedZones) ─────────────────────
  const chartData = useMemo(() => {
    if (metric === "prices") {
      const sel: Record<string, PriceResponse | null> = {};
      for (const z of selectedZones) sel[z] = allPrices[z] ?? null;
      return mergePriceSeries(sel);
    }
    if (metric === "load") {
      const sel: Record<string, LoadResponse | null> = {};
      for (const z of selectedZones) sel[z] = allLoad[z] ?? null;
      return mergeLoadSeries(sel);
    }
    const sel: Record<string, ProductionResponse[] | null> = {};
    for (const z of selectedZones) sel[z] = allProd[z] ?? null;
    return mergeProdSeries(sel);
  }, [metric, selectedZones, allPrices, allLoad, allProd]);

  const toggleZone = (zone: string) =>
    setSelectedZones(prev =>
      prev.includes(zone) ? prev.filter(z => z !== zone) : [...prev, zone]
    );

  return (
    <div style={{ padding: "24px 32px", maxWidth: 1400, margin: "0 auto" }}>

      {/* Header + controls */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 20, fontWeight: 600, color: "#e2e8f0" }}>Zone Comparison</h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ display: "flex", gap: 4 }}>
            {(["prices", "load", "production"] as Metric[]).map(m => (
              <button key={m} style={metric === m ? BTN_ON : BTN} onClick={() => setMetric(m)}>
                {m[0].toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
          <DateRangePicker
            start={startDate}
            end={endDate}
            onChange={(s, e) => { setStartDate(s); setEndDate(e); }}
          />
          <button
            style={{
              ...BTN,
              opacity: anyLoading ? 0.5 : 1,
              cursor: anyLoading ? "not-allowed" : "pointer",
            }}
            disabled={anyLoading}
            onClick={() => downloadCSV(metric, allPrices, allLoad, allProd, startDate, endDate)}
            title="Download all zones as CSV"
          >
            ↓ CSV
          </button>
        </div>
      </div>

      {/* Map + zone selector */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 220px", gap: 20, marginBottom: 28 }}>

        {/* Choropleth map */}
        <div style={{ background: "#1a1f2e", border: "1px solid #2d3748", borderRadius: 8, padding: "14px 16px 10px" }}>
          <p style={{ margin: "0 0 6px", fontSize: 12, color: "#94a3b8" }}>
            {metric === "prices"
              ? `Average price over the period · ${mapUnit}`
              : `Total energy over the period · ${mapUnit}`}
            {anyLoading && <span style={{ marginLeft: 8, color: "#4a5568" }}>· loading…</span>}
            {" · "}click a zone to compare
          </p>
          <EuropeMap
            zoneValues={zoneValues}
            selectedZones={selectedZones}
            onZoneClick={toggleZone}
            colorScale={colorFn}
            unit={mapUnit}
            productionMix={metric === "production" ? productionMix : null}
          />
          {/* Choropleth color legend */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "8px 4px 2px" }}>
            <span style={{ fontSize: 11, color: "#94a3b8", minWidth: 40, textAlign: "right" }}>
              {minVal.toFixed(1)}
            </span>
            <div style={{
              flex: 1, height: 7, borderRadius: 4,
              background: "linear-gradient(to right, #68d391, #f6e05e, #fc8181)",
            }} />
            <span style={{ fontSize: 11, color: "#94a3b8", minWidth: 70 }}>
              {maxVal.toFixed(1)} {metric === "prices" ? "€/MWh" : "GWh"}
            </span>
          </div>
          {/* Production-mix legend (shown only in Production mode) */}
          {metric === "production" && activeProdTypes.length > 0 && (
            <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: "4px 12px" }}>
              <span style={{ fontSize: 10, color: "#4a5568", width: "100%", marginBottom: 2 }}>
                Production mix (donut charts)
                {lProd && <span style={{ marginLeft: 6, color: "#4a5568" }}>· loading…</span>}
              </span>
              {activeProdTypes.map(type => (
                <div key={type} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: "50%",
                    background: PROD_TYPE_COLOR[type] ?? "#a0aec0", flexShrink: 0,
                  }} />
                  <span style={{ fontSize: 10, color: "#94a3b8" }}>{prodTypeLabel(type)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Zone list */}
        <div style={{ background: "#1a1f2e", border: "1px solid #2d3748", borderRadius: 8, padding: 14 }}>
          <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 600, color: "#e2e8f0" }}>Zones</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {MAP_ZONES.map(zone => {
              const on  = selectedZones.includes(zone);
              const val = zoneValues[zone];
              const label = val != null
                ? metric === "prices" ? `${val.toFixed(1)} €/MWh` : `${val.toFixed(0)} GWh`
                : "—";
              return (
                <button
                  key={zone}
                  onClick={() => toggleZone(zone)}
                  style={{
                    display: "flex", alignItems: "center", gap: 7,
                    background: on ? "#2d3748" : "transparent",
                    border: `1px solid ${on ? (ZONE_COLORS[zone] ?? "#63b3ed") : "#2d3748"}`,
                    borderRadius: 6, padding: "5px 9px",
                    cursor: "pointer", color: "#e2e8f0", fontSize: 12, textAlign: "left",
                  }}
                >
                  <div style={{
                    width: 9, height: 9, borderRadius: 2,
                    background: ZONE_COLORS[zone] ?? "#888", flexShrink: 0,
                  }} />
                  <span style={{ flex: 1 }}>{zone}</span>
                  <span style={{ fontSize: 11, color: "#94a3b8" }}>{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Comparison chart */}
      {selectedZones.length > 0 ? (
        <div style={{ background: "#1a1f2e", border: "1px solid #2d3748", borderRadius: 8, padding: "20px 12px" }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 16, paddingLeft: 8 }}>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#e2e8f0" }}>
              {metric === "prices" ? "Price" : metric === "load" ? "Load" : "Production"} · time series
            </h2>
            <span style={{ fontSize: 12, color: "#4a5568" }}>
              {selectedZones.join(" · ")} · {startDate.toLocaleDateString()} → {endDate.toLocaleDateString()}
            </span>
          </div>
          <MultiZoneLineChart
            data={chartData}
            zones={selectedZones}
            unit={chartUnit}
            loading={anyLoading}
          />
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "48px 0", color: "#4a5568", fontSize: 13 }}>
          Select at least one zone from the map or the list above.
        </div>
      )}

    </div>
  );
}
