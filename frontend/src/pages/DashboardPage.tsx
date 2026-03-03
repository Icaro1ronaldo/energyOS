import { useMemo, useState } from "react";
import { subDays, addHours, subHours } from "date-fns";
import { usePrices, useLoad, useProduction } from "../hooks/useEnergyData";
import KpiCard from "../components/KpiCard";
import PriceChart from "../components/charts/PriceChart";
import LoadChart from "../components/charts/LoadChart";
import ProductionChart from "../components/charts/ProductionChart";
import { PricePoint, LoadPoint } from "../services/api";

interface Props { zone: string; }

// ── helpers ──────────────────────────────────────────────────────────────────

function computeMAE(
  actuals: Array<{ timestamp: string; [k: string]: unknown }>,
  forecasts: Array<{ timestamp: string; [k: string]: unknown }>,
  field: string,
): string | null {
  if (!forecasts.length) return null;
  const map = new Map(actuals.map((a) => [a.timestamp, Number(a[field])]));
  let sum = 0, count = 0;
  for (const f of forecasts) {
    const actual = map.get(f.timestamp);
    const fv = Number(f[field]);
    if (actual != null && !isNaN(actual) && !isNaN(fv)) { sum += Math.abs(actual - fv); count++; }
  }
  return count > 0 ? (sum / count).toFixed(2) : null;
}

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 40 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 12 }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#e2e8f0" }}>{title}</h2>
        {sub && <span style={{ fontSize: 12, color: "#4a5568" }}>{sub}</span>}
      </div>
      <div style={{ background: "#1a1f2e", border: "1px solid #2d3748", borderRadius: 8, padding: "20px 12px" }}>
        {children}
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div style={{ textAlign: "center", padding: "48px 0", color: "#4a5568", fontSize: 13 }}>{text}</div>;
}

function MaeBadge({ mae, unit }: { mae: string | null; unit: string }) {
  if (!mae) return null;
  return (
    <span style={{ fontSize: 11, background: "#2d3748", padding: "2px 8px", borderRadius: 4, color: "#f6ad55" }}>
      MAE {mae} {unit}
    </span>
  );
}

// ── component ─────────────────────────────────────────────────────────────────

export default function DashboardPage({ zone }: Props) {
  // Time windows computed once at mount — stable string refs prevent spurious refetches
  const [ref] = useState(() => {
    const now = new Date();
    return {
      now,
      nowIso: now.toISOString(),
      past5d: subDays(now, 5).toISOString(),
      past2d: subHours(now, 48).toISOString(),
      future48h: addHours(now, 48).toISOString(),
    };
  });

  const { data: prices, status: pSt } = usePrices(zone, ref.past5d, ref.future48h);
  const { data: load, status: lSt } = useLoad(zone, ref.past5d, ref.future48h);
  const { data: production, status: prodSt } = useProduction(zone, ref.past5d, ref.nowIso);

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const latestPrice = prices?.actuals.at(-1)?.price_eur_mwh ?? null;
  const latestLoad = load?.actuals.at(-1)?.load_mw ?? null;

  const avg48hForecast = useMemo(() => {
    const fcs = prices?.forecasts.filter((p) => p.timestamp > ref.nowIso) ?? [];
    if (!fcs.length) return null;
    return (fcs.reduce((s, p) => s + Number(p.price_eur_mwh), 0) / fcs.length).toFixed(2);
  }, [prices, ref.nowIso]);

  const totalProd = useMemo(
    () => production?.reduce((s, p) => s + (Number(p.actuals.at(-1)?.value_mw) || 0), 0) ?? null,
    [production],
  );

  const renewableMw = useMemo(() => {
    const REN = ["solar", "wind_onshore", "wind_offshore", "hydro_run_of_river", "hydro_reservoir"];
    return production
      ?.filter((p) => REN.includes(p.production_type))
      .reduce((s, p) => s + (Number(p.actuals.at(-1)?.value_mw) || 0), 0) ?? null;
  }, [production]);

  const renewableShare =
    totalProd && renewableMw != null ? ((renewableMw / totalProd) * 100).toFixed(1) : null;

  const priceTrend = useMemo((): "up" | "down" | "flat" | undefined => {
    if (latestPrice == null || !prices?.actuals.length) return undefined;
    const cutoff = subHours(ref.now, 24).toISOString();
    const old = prices.actuals.find((p) => p.timestamp >= cutoff);
    if (!old) return undefined;
    const diff = Number(latestPrice) - Number(old.price_eur_mwh);
    return Math.abs(diff) < 1 ? "flat" : diff > 0 ? "up" : "down";
  }, [latestPrice, prices, ref.now]);

  // ── Forecast accuracy: past 48h forecasts vs actuals ──────────────────────
  const pricePastFc = useMemo<PricePoint[]>(
    () => prices?.forecasts.filter((p) => p.timestamp <= ref.nowIso && p.timestamp >= ref.past2d) ?? [],
    [prices, ref],
  );
  const priceAccActuals = useMemo<PricePoint[]>(
    () => prices?.actuals.filter((p) => p.timestamp >= ref.past2d) ?? [],
    [prices, ref],
  );
  const loadPastFc = useMemo<LoadPoint[]>(
    () => load?.forecasts.filter((p) => p.timestamp <= ref.nowIso && p.timestamp >= ref.past2d) ?? [],
    [load, ref],
  );
  const loadAccActuals = useMemo<LoadPoint[]>(
    () => load?.actuals.filter((p) => p.timestamp >= ref.past2d) ?? [],
    [load, ref],
  );

  const priceMAE = useMemo(
    () => computeMAE(priceAccActuals, pricePastFc, "price_eur_mwh"),
    [priceAccActuals, pricePastFc],
  );
  const loadMAE = useMemo(
    () => computeMAE(loadAccActuals, loadPastFc, "load_mw"),
    [loadAccActuals, loadPastFc],
  );

  const hasAccuracyData = pricePastFc.length > 0 || loadPastFc.length > 0;

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: "24px 32px", maxWidth: 1400, margin: "0 auto" }}>

      {/* KPI row */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 36 }}>
        <KpiCard
          label="Current Price"
          value={latestPrice != null ? Number(latestPrice).toFixed(2) : "—"}
          unit="€/MWh"
          trend={priceTrend}
        />
        <KpiCard
          label="48h Avg Forecast"
          value={avg48hForecast ?? "—"}
          unit="€/MWh"
        />
        <KpiCard
          label="Current Load"
          value={latestLoad != null ? (Number(latestLoad) / 1000).toFixed(1) : "—"}
          unit="GW"
        />
        <KpiCard
          label="Total Generation"
          value={totalProd != null ? (totalProd / 1000).toFixed(1) : "—"}
          unit="GW"
        />
        <KpiCard
          label="Renewable Share"
          value={renewableShare ?? "—"}
          unit="%"
        />
      </div>

      {/* Electricity prices: 5d actuals + 48h forecast */}
      <Section title="Electricity Prices" sub={`Last 5 days actuals · 48h ML forecast · ${zone}`}>
        {pSt === "loading" && <Empty text="Loading…" />}
        {pSt === "error" && <Empty text="Failed to load price data." />}
        {prices && <PriceChart actuals={prices.actuals} forecasts={prices.forecasts} />}
      </Section>

      {/* Load: 5d actuals + 48h forecast */}
      <Section title="Energy Load" sub={`Last 5 days actuals · 48h ML forecast · ${zone}`}>
        {lSt === "loading" && <Empty text="Loading…" />}
        {lSt === "error" && <Empty text="Failed to load load data." />}
        {load && <LoadChart actuals={load.actuals} forecasts={load.forecasts} />}
      </Section>

      {/* Generation mix */}
      <Section title="Generation Mix" sub={`Last 5 days actuals by production type · ${zone}`}>
        {prodSt === "loading" && <Empty text="Loading…" />}
        {prodSt === "error" && <Empty text="Failed to load production data." />}
        {production && production.length > 0 && <ProductionChart data={production} />}
        {production && production.length === 0 && <Empty text="No production data available." />}
      </Section>

      {/* Forecast accuracy: last 48h */}
      <Section
        title="Forecast Accuracy · last 48h"
        sub="ML model predictions vs actual values for completed hours"
      >
        {!hasAccuracyData ? (
          <Empty text="No forecasts generated yet — run the ML worker to enable accuracy tracking." />
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 32 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 13, color: "#94a3b8", fontWeight: 500 }}>Price forecast</span>
                <MaeBadge mae={priceMAE} unit="€/MWh" />
              </div>
              {pricePastFc.length > 0
                ? <PriceChart actuals={priceAccActuals} forecasts={pricePastFc} />
                : <Empty text="No price forecasts in this window." />}
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <span style={{ fontSize: 13, color: "#94a3b8", fontWeight: 500 }}>Load forecast</span>
                <MaeBadge mae={loadMAE} unit="MW" />
              </div>
              {loadPastFc.length > 0
                ? <LoadChart actuals={loadAccActuals} forecasts={loadPastFc} />
                : <Empty text="No load forecasts in this window." />}
            </div>
          </div>
        )}
      </Section>

    </div>
  );
}
