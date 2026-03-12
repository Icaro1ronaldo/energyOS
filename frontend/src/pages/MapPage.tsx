import { useState, useMemo } from "react";
import { format } from "date-fns";
import { useMultiZonePrices, useMultiZoneLoad, useMultiZoneProduction } from "../hooks/useMultiZoneData";
import EuropeMap from "../components/EuropeMap";
import MultiZoneLineChart from "../components/charts/MultiZoneLineChart";
import MaeHeatmap from "../components/charts/MaeHeatmap";
import DataQualityHeatmap from "../components/charts/DataQualityHeatmap";

import { MAP_ZONES, ZONE_COLORS, PROD_TYPE_COLOR, prodTypeLabel } from "../constants/zones";
import { PriceResponse, LoadResponse, ProductionResponse } from "../services/api";
import { fillAllSteps } from "../utils/gapFill";

type Metric = "prices" | "load" | "production";

/** Zones that have real data ingested. */
const DATA_ZONES = ["DE_LU", "FR", "ES", "PT", "NL", "BE"];

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
  return fillAllSteps(
    Array.from(byTs.values()).sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp))),
    "timestamp",
  );
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
  return fillAllSteps(
    Array.from(byTs.values()).sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp))),
    "timestamp",
  );
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
  return fillAllSteps(
    Array.from(byTs.values()).sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp))),
    "timestamp",
  );
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
  background: "transparent",
  color: "#6e6e73",
  border: "none",
  borderRadius: 20,
  padding: "6px 16px",
  fontSize: 13,
  cursor: "pointer",
  fontFamily: "inherit",
  transition: "color 0.15s, background 0.15s",
};
const BTN_ON: React.CSSProperties = {
  ...BTN,
  background: "#fff",
  color: "#1d1d1f",
  boxShadow: "0 1px 3px rgba(0,0,0,0.1), 0 1px 1px rgba(0,0,0,0.06)",
};

// ── component ──────────────────────────────────────────────────────────────────

interface Props {
  startDate: Date;
  endDate: Date;
}

export default function MapPage({ startDate, endDate }: Props) {
  const [metric, setMetric]           = useState<Metric>("prices");
  const [selectedZones, setSelectedZones] = useState<string[]>(["DE_LU", "FR"]);

  const startIso = startDate.toISOString();
  const endIso   = endDate.toISOString();

  // ── Data quality fetches: always fetch all three metrics for DATA_ZONES ─────
  const { data: dqPrices, loading: dqLoadingP } = useMultiZonePrices(DATA_ZONES, startIso, endIso);
  const { data: dqLoad,   loading: dqLoadingL } = useMultiZoneLoad(DATA_ZONES, startIso, endIso);
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

  // ── Normalized timestamps for data quality heatmap (all 3 metrics) ──────────
  // Local date strings — compared by value, no timezone drift, reliable memo deps
  const startDay = format(startDate, "yyyy-MM-dd");
  const endDay   = format(endDate,   "yyyy-MM-dd");

  const dqZones = useMemo(
    () => selectedZones.length ? selectedZones.filter(z => DATA_ZONES.includes(z)) : DATA_ZONES,
    [selectedZones],
  );
  const dqZonesKey = dqZones.join(",");

  const dqPriceTs = useMemo(() => {
    const out: Record<string, string[] | null> = {};
    for (const z of dqZones) {
      const d = dqPrices[z];
      out[z] = d ? d.actuals.filter(p => p.price_eur_mwh != null).map(p => p.timestamp) : null;
    }
    return out;
  }, [dqPrices, dqZonesKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const dqLoadTs = useMemo(() => {
    const out: Record<string, string[] | null> = {};
    for (const z of dqZones) {
      const d = dqLoad[z];
      out[z] = d ? d.actuals.filter(p => p.load_mw != null).map(p => p.timestamp) : null;
    }
    return out;
  }, [dqLoad, dqZonesKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const dqProdTs = useMemo(() => {
    const out: Record<string, string[] | null> = {};
    for (const z of dqZones) {
      const types = allProd[z];
      if (!types) { out[z] = null; continue; }
      const tsSet = new Set<string>();
      for (const t of types) for (const p of t.actuals) if (p.value_mw != null) tsSet.add(p.timestamp);
      out[z] = Array.from(tsSet).sort();
    }
    return out;
  }, [allProd, dqZonesKey]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const CARD: React.CSSProperties = {
    background: "#fff",
    border: "1px solid rgba(0,0,0,0.07)",
    borderRadius: 14,
    padding: "18px 16px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.05), 0 4px 14px rgba(0,0,0,0.03)",
  };
  const SECTION_TITLE: React.CSSProperties = {
    margin: 0, fontSize: 15, fontWeight: 600, color: "#1d1d1f", letterSpacing: "-0.3px",
  };
  const SECTION_SUB: React.CSSProperties = {
    fontSize: 12, color: "#aeaeb2",
  };

  return (
    <div style={{ padding: "32px 32px 24px", maxWidth: 1400, margin: "0 auto" }}>

      {/* Header + controls */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, color: "#1d1d1f", letterSpacing: "-0.5px" }}>Market Analytics</h1>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{
            display: "flex", gap: 2,
            background: "rgba(0,0,0,0.06)",
            borderRadius: 22, padding: 3,
          }}>
            {(["prices", "load", "production"] as Metric[]).map(m => (
              <button key={m} style={metric === m ? BTN_ON : BTN} onClick={() => setMetric(m)}>
                {m[0].toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
          <button
            style={{
              ...BTN,
              background: "#fff",
              border: "1px solid rgba(0,0,0,0.1)",
              borderRadius: 20,
              opacity: anyLoading ? 0.4 : 1,
              cursor: anyLoading ? "not-allowed" : "pointer",
              boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
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
      <div style={{ display: "grid", gridTemplateColumns: "1fr 220px", gap: 16, marginBottom: 24 }}>

        {/* Choropleth map */}
        <div style={{ ...CARD }}>
          <p style={{ margin: "0 0 8px", fontSize: 12, color: "#aeaeb2" }}>
            {metric === "prices"
              ? `Average price over the period · ${mapUnit}`
              : `Total energy over the period · ${mapUnit}`}
            {anyLoading && <span style={{ marginLeft: 8 }}>· loading…</span>}
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
          <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "10px 4px 2px" }}>
            <span style={{ fontSize: 11, color: "#aeaeb2", minWidth: 40, textAlign: "right" }}>
              {minVal.toFixed(1)}
            </span>
            <div style={{
              flex: 1, height: 6, borderRadius: 3,
              background: "linear-gradient(to right, #34c759, #ffcc00, #ff3b30)",
            }} />
            <span style={{ fontSize: 11, color: "#aeaeb2", minWidth: 70 }}>
              {maxVal.toFixed(1)} {metric === "prices" ? "€/MWh" : "GWh"}
            </span>
          </div>
          {/* Production-mix legend */}
          {metric === "production" && activeProdTypes.length > 0 && (
            <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: "4px 12px" }}>
              <span style={{ fontSize: 10, color: "#aeaeb2", width: "100%", marginBottom: 2 }}>
                Production mix (donut charts)
                {lProd && <span style={{ marginLeft: 6 }}>· loading…</span>}
              </span>
              {activeProdTypes.map(type => (
                <div key={type} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <div style={{
                    width: 7, height: 7, borderRadius: "50%",
                    background: PROD_TYPE_COLOR[type] ?? "#aeaeb2", flexShrink: 0,
                  }} />
                  <span style={{ fontSize: 10, color: "#6e6e73" }}>{prodTypeLabel(type)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Zone list */}
        <div style={{ ...CARD, padding: 14 }}>
          <p style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 500, color: "#aeaeb2", textTransform: "uppercase", letterSpacing: "0.5px" }}>Zones</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {MAP_ZONES.map(zone => {
              const on  = selectedZones.includes(zone);
              const val = zoneValues[zone];
              const label = val != null
                ? metric === "prices" ? `${val.toFixed(1)} €` : `${val.toFixed(0)} GWh`
                : "—";
              return (
                <button
                  key={zone}
                  onClick={() => toggleZone(zone)}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    background: on ? `${ZONE_COLORS[zone] ?? "#0071e3"}18` : "transparent",
                    border: `1px solid ${on ? ((ZONE_COLORS[zone] ?? "#0071e3") + "44") : "rgba(0,0,0,0.06)"}`,
                    borderRadius: 8, padding: "6px 10px",
                    cursor: "pointer", color: on ? "#1d1d1f" : "#6e6e73", fontSize: 12, textAlign: "left",
                    fontFamily: "inherit", transition: "all 0.15s",
                  }}
                >
                  <div style={{
                    width: 8, height: 8, borderRadius: 2,
                    background: ZONE_COLORS[zone] ?? "#aeaeb2", flexShrink: 0,
                  }} />
                  <span style={{ flex: 1 }}>{zone}</span>
                  <span style={{ fontSize: 11, color: "#aeaeb2" }}>{label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Comparison chart (time series) */}
      {selectedZones.length > 0 ? (
        <div style={{ ...CARD, marginBottom: 24 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 16, paddingLeft: 4 }}>
            <h2 style={SECTION_TITLE}>
              {metric === "prices" ? "Price" : metric === "load" ? "Load" : "Production"} · time series
            </h2>
            <span style={SECTION_SUB}>
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
        <div style={{ textAlign: "center", padding: "48px 0", color: "#aeaeb2", fontSize: 13, marginBottom: 24 }}>
          Select at least one zone from the map or the list above.
        </div>
      )}

      {/* Data quality heatmap */}
      <div style={{ ...CARD, marginBottom: 24 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 12, paddingLeft: 4 }}>
          <h2 style={SECTION_TITLE}>Data Quality</h2>
          <span style={SECTION_SUB}>
            daily coverage · {startDay} → {endDay} · {dqZones.join(" · ")}
          </span>
        </div>
        <DataQualityHeatmap
          zoneData={metric === "prices" ? dqPriceTs : metric === "load" ? dqLoadTs : dqProdTs}
          zones={dqZones}
          startDay={startDay}
          endDay={endDay}
          loading={metric === "prices" ? dqLoadingP : metric === "load" ? dqLoadingL : lProd}
        />
      </div>

      {/* Forecast accuracy heatmap */}
      <div style={{ ...CARD }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 16, paddingLeft: 4 }}>
          <h2 style={SECTION_TITLE}>Forecast Accuracy · MAE</h2>
          <span style={SECTION_SUB}>
            |actual − predicted| per slot ·{" "}
            {selectedZones.length ? selectedZones.join(" · ") : "select zones above"}
          </span>
        </div>
        {metric !== "production" ? (
          <MaeHeatmap
            zoneData={metric === "prices" ? dqPrices : dqLoad}
            zones={selectedZones.length ? selectedZones : DATA_ZONES}
            loading={metric === "prices" ? dqLoadingP : dqLoadingL}
            valueField={metric === "prices" ? "price_eur_mwh" : "load_mw"}
            unit={metric === "prices" ? "€/MWh" : "MW"}
          />
        ) : (
          <div style={{ textAlign: "center", padding: "36px 0", color: "#aeaeb2", fontSize: 13 }}>
            Forecast accuracy available for prices and load only.
          </div>
        )}
      </div>

    </div>
  );
}
