import { useMemo, useState } from "react";
import { addHours, subHours } from "date-fns";
import { usePrices, useLoad, useProduction } from "../hooks/useEnergyData";
import KpiCard from "../components/KpiCard";
import PriceChart from "../components/charts/PriceChart";
import LoadChart from "../components/charts/LoadChart";
import ProductionChart from "../components/charts/ProductionChart";
import { PricePoint } from "../services/api";

const ZONES = ["DE_LU", "FR", "ES", "PT", "NL", "BE"];

// ── helpers ──────────────────────────────────────────────────────────────────

function computeMAE(
  actuals: { timestamp: string }[],
  forecasts: { timestamp: string }[],
  field: string,
): string | null {
  if (!forecasts.length) return null;
  const map = new Map(actuals.map((a) => [a.timestamp, Number((a as Record<string, unknown>)[field])]));
  let sum = 0, count = 0;
  for (const f of forecasts) {
    const actual = map.get(f.timestamp);
    const fv = Number((f as Record<string, unknown>)[field]);
    if (actual != null && !isNaN(actual) && !isNaN(fv)) { sum += Math.abs(actual - fv); count++; }
  }
  return count > 0 ? (sum / count).toFixed(2) : null;
}

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 12, paddingLeft: 2 }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: "#1d1d1f", letterSpacing: "-0.3px" }}>{title}</h2>
        {sub && <span style={{ fontSize: 12, color: "#aeaeb2" }}>{sub}</span>}
      </div>
      <div style={{
        background: "#fff",
        border: "1px solid rgba(0,0,0,0.07)",
        borderRadius: 14,
        padding: "20px 16px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.05), 0 4px 14px rgba(0,0,0,0.03)",
      }}>
        {children}
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div style={{ textAlign: "center", padding: "48px 0", color: "#aeaeb2", fontSize: 13 }}>{text}</div>;
}

// ── component ─────────────────────────────────────────────────────────────────

interface Props {
  startDate: Date;
  endDate: Date;
}

export default function DashboardPage({ startDate, endDate }: Props) {
  const nowRef = useState(() => new Date())[0];
  const [zone, setZone] = useState("DE_LU");

  const ref = useMemo(() => ({
    now: nowRef,
    nowIso: nowRef.toISOString(),
    past2d: subHours(nowRef, 48).toISOString(),
    future48h: addHours(nowRef, 48).toISOString(),
  }), [nowRef]);

  const startIso = startDate.toISOString();
  const endIso = addHours(endDate, 24).toISOString();

  const { data: prices, status: pSt } = usePrices(zone, startIso, endIso);
  const { data: load, status: lSt } = useLoad(zone, startIso, endIso);
  const { data: production, status: prodSt } = useProduction(zone, startIso, endIso);

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

  // ── Price MAE: hindcast rows (past, is_forecast=true) vs actuals ──────────
  const pricePastFc = useMemo<PricePoint[]>(
    () => prices?.forecasts.filter((p) => p.timestamp <= ref.nowIso && p.timestamp >= ref.past2d) ?? [],
    [prices, ref],
  );
  const priceAccActuals = useMemo<PricePoint[]>(
    () => prices?.actuals.filter((p) => p.timestamp >= ref.past2d) ?? [],
    [prices, ref],
  );
  const priceMAE = useMemo(
    () => computeMAE(priceAccActuals, pricePastFc, "price_eur_mwh"),
    [priceAccActuals, pricePastFc],
  );

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: "32px 32px 24px", maxWidth: 1400, margin: "0 auto" }}>

      {/* Controls row */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28, flexWrap: "wrap" }}>
        <select
          value={zone}
          onChange={(e) => setZone(e.target.value)}
          style={{
            background: "#fff",
            color: "#1d1d1f",
            border: "1px solid rgba(0,0,0,0.12)",
            borderRadius: 8,
            padding: "7px 14px",
            fontSize: 13,
            cursor: "pointer",
            outline: "none",
            appearance: "none",
            WebkitAppearance: "none",
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
          }}
        >
          {ZONES.map((z) => <option key={z}>{z}</option>)}
        </select>
      </div>

      {/* KPI row */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 32 }}>
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

      {/* Electricity prices: actuals + hindcast + 48h forecast */}
      <Section title="Electricity Prices" sub={`${startDate.toLocaleDateString()} → ${endDate.toLocaleDateString()} · ${zone}`}>
        {pSt === "loading" && <Empty text="Loading…" />}
        {pSt === "error" && <Empty text="Failed to load price data." />}
        {prices && <PriceChart actuals={prices.actuals} forecasts={prices.forecasts} mae={priceMAE} startTs={startIso} endTs={endIso} />}
      </Section>

      {/* Load: actuals + forecast */}
      <Section title="Energy Load" sub={`${startDate.toLocaleDateString()} → ${endDate.toLocaleDateString()} · ${zone}`}>
        {lSt === "loading" && <Empty text="Loading…" />}
        {lSt === "error" && <Empty text="Failed to load load data." />}
        {load && <LoadChart actuals={load.actuals} forecasts={load.forecasts} startTs={startIso} endTs={endIso} />}
      </Section>

      {/* Generation mix */}
      <Section title="Generation Mix" sub={`${startDate.toLocaleDateString()} → ${endDate.toLocaleDateString()} · ${zone}`}>
        {prodSt === "loading" && <Empty text="Loading…" />}
        {prodSt === "error" && <Empty text="Failed to load production data." />}
        {production && production.length > 0 && <ProductionChart data={production} startTs={startIso} endTs={endIso} />}
        {production && production.length === 0 && <Empty text="No production data available." />}
      </Section>

    </div>
  );
}
