import { useMemo, useState } from "react";
import { addHours, subHours, subDays } from "date-fns";
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

const D7_MS = 7 * 24 * 60 * 60 * 1000;
const D2_MS = 2 * 24 * 60 * 60 * 1000;

/**
 * Return the [windowStart, windowEnd] to use for MAE computation.
 *
 * Strategy:
 * 1. Find lastActual = the most recent actual timestamp (not "now" — actuals
 *    may lag by hours or days behind wall-clock time).
 * 2. If actuals span ≥ 7 days ending at lastActual → the ML model had enough
 *    data to train. Use the last 48 h of actuals as the comparison window
 *    (i.e. [lastActual − 48 h, lastActual]).
 * 3. If actuals span < 7 days → not enough training data yet. Fall back to the
 *    calendar day (UTC) that has the most overlapping actual + forecast points,
 *    so the heatmap/MAE badge shows something rather than nothing.
 */
function accuracyWindow(
  actuals: { timestamp: string }[],
  forecasts: { timestamp: string }[],
  nowIso: string,
): { start: string; end: string } {
  // Past actuals only (exclude any future-stamped rows)
  const pastActualTs = actuals
    .map((p) => p.timestamp)
    .filter((ts) => ts <= nowIso)
    .sort();

  if (!pastActualTs.length) {
    // No actuals at all — fall back to best day in forecasts
    return bestDayWindow([], forecasts) ?? { start: nowIso, end: nowIso };
  }

  const lastActual = pastActualTs.at(-1)!;
  const lastActualMs = new Date(lastActual).getTime();
  const firstActualMs = new Date(pastActualTs[0]).getTime();

  if (lastActualMs - firstActualMs >= D7_MS) {
    // ≥ 7 days of actuals: anchor the 48 h window at lastActual
    const windowStart = new Date(lastActualMs - D2_MS).toISOString();
    return { start: windowStart, end: lastActual };
  }

  // < 7 days: find calendar day with most actual+forecast overlap
  return bestDayWindow(actuals, forecasts) ?? { start: pastActualTs[0], end: lastActual };
}

/** Calendar day (UTC) with the most combined actual + forecast data points. */
function bestDayWindow(
  actuals: { timestamp: string }[],
  forecasts: { timestamp: string }[],
): { start: string; end: string } | null {
  const counts = new Map<string, number>();
  for (const p of [...actuals, ...forecasts]) {
    const day = p.timestamp.slice(0, 10);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  if (!counts.size) return null;
  const bestDay = [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
  return { start: `${bestDay}T00:00:00.000Z`, end: `${bestDay}T23:59:59.999Z` };
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
    future48h: addHours(nowRef, 48).toISOString(),
  }), [nowRef]);

  const startIso = startDate.toISOString();
  const endIso = addHours(endDate, 24).toISOString();

  // Fetch actuals using at least a 14-day window ending now, so the last
  // real data point is always included even when the user's date picker
  // starts after the most recent actual (e.g. data ends Mar 5, default
  // picker starts Mar 9).  The API already returns ALL forecast rows
  // unconditionally, so this only widens the actuals window.
  const fetchStartIso = useMemo(
    () => {
      const floor = subDays(nowRef, 14).toISOString();
      return startIso < floor ? startIso : floor;
    },
    [startIso, nowRef],
  );

  const { data: prices, status: pSt } = usePrices(zone, fetchStartIso, endIso);
  const { data: load, status: lSt } = useLoad(zone, fetchStartIso, endIso);
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

  // ── Price MAE: hindcast rows vs actuals ───────────────────────────────────
  const priceAccWindow = useMemo(
    () => accuracyWindow(prices?.actuals ?? [], prices?.hindcasts ?? [], ref.nowIso),
    [prices, ref],
  );
  const pricePastFc = useMemo<PricePoint[]>(
    () =>
      prices?.hindcasts.filter(
        (p) => p.timestamp <= priceAccWindow.end && p.timestamp >= priceAccWindow.start,
      ) ?? [],
    [prices, priceAccWindow],
  );
  const priceAccActuals = useMemo<PricePoint[]>(
    () =>
      prices?.actuals.filter(
        (p) => p.timestamp >= priceAccWindow.start && p.timestamp <= priceAccWindow.end,
      ) ?? [],
    [prices, priceAccWindow],
  );
  const priceMAE = useMemo(
    () => computeMAE(priceAccActuals, pricePastFc, "price_eur_mwh"),
    [priceAccActuals, pricePastFc],
  );

  // ── Load MAE: hindcast rows vs actuals ────────────────────────────────────
  const loadAccWindow = useMemo(
    () => accuracyWindow(load?.actuals ?? [], load?.hindcasts ?? [], ref.nowIso),
    [load, ref],
  );
  const loadPastFc = useMemo(
    () =>
      load?.hindcasts.filter(
        (p) => p.timestamp <= loadAccWindow.end && p.timestamp >= loadAccWindow.start,
      ) ?? [],
    [load, loadAccWindow],
  );
  const loadAccActuals = useMemo(
    () =>
      load?.actuals.filter(
        (p) => p.timestamp >= loadAccWindow.start && p.timestamp <= loadAccWindow.end,
      ) ?? [],
    [load, loadAccWindow],
  );
  const loadMAE = useMemo(
    () => computeMAE(loadAccActuals, loadPastFc, "load_mw"),
    [loadAccActuals, loadPastFc],
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
        {prices && <PriceChart actuals={prices.actuals} hindcasts={prices.hindcasts} forecasts={prices.forecasts} mae={priceMAE} startTs={startIso} endTs={endIso} />}
      </Section>

      {/* Load: actuals + forecast */}
      <Section title="Energy Load" sub={`${startDate.toLocaleDateString()} → ${endDate.toLocaleDateString()} · ${zone}`}>
        {lSt === "loading" && <Empty text="Loading…" />}
        {lSt === "error" && <Empty text="Failed to load load data." />}
        {load && <LoadChart actuals={load.actuals} hindcasts={load.hindcasts} forecasts={load.forecasts} mae={loadMAE} startTs={startIso} endTs={endIso} />}
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
