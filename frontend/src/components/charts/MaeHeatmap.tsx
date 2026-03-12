import { useMemo, useRef, useEffect, useState, useCallback } from "react";
import { format } from "date-fns";
import { ZONE_COLORS } from "../../constants/zones";

interface CellData {
  actual: number;
  predicted: number;
  mae: number;
}

interface TooltipState {
  screenX: number;
  screenY: number;
  zone: string;
  ts: string;
  cell: CellData;
}

type ZoneEntry = {
  actuals:   { timestamp: string }[];
  forecasts: { timestamp: string }[];
} | null;

interface Props {
  zoneData:    Record<string, ZoneEntry>;
  zones:       string[];
  loading?:    boolean;
  /** Field name to read from actuals/forecasts. Default: "price_eur_mwh" */
  valueField?: string;
  /** Unit label shown in legend and tooltip. Default: "€/MWh" */
  unit?:       string;
}

/** Perceptual 3-stop scale: teal → yellow → red */
function maeColor(t: number): [number, number, number] {
  if (t < 0.5) {
    const u = t * 2;
    return [
      Math.round(56  + (246 - 56)  * u),
      Math.round(178 + (224 - 178) * u),
      Math.round(172 + (94  - 172) * u),
    ];
  }
  const u = (t - 0.5) * 2;
  return [
    Math.round(246 + (252 - 246) * u),
    Math.round(224 + (82  - 224) * u),
    Math.round(94  + (82  - 94)  * u),
  ];
}

const nts = (ts: string) => new Date(ts).toISOString();

const CELL_H     = 36;
const LEFT_PAD   = 76;
const RIGHT_PAD  = 96;   // room for per-zone avg MAE label
const BOTTOM_PAD = 32;

export default function MaeHeatmap({ zoneData, zones, loading, valueField = "price_eur_mwh", unit = "€/MWh" }: Props) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const cellWRef     = useRef<number>(3);

  const [containerW, setContainerW] = useState(900);
  const [tooltip, setTooltip]       = useState<TooltipState | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(e => setContainerW(e[0].contentRect.width));
    ro.observe(containerRef.current);
    setContainerW(containerRef.current.clientWidth || 900);
    return () => ro.disconnect();
  }, []);

  // ── Build grid with per-zone aggregates ───────────────────────────────────
  const { grid, timestamps, p95Mae, maxMae, zoneAvgMae } = useMemo(() => {
    const grid: Record<string, Map<string, CellData>> = {};
    const tsSet = new Set<string>();

    for (const zone of zones) {
      const d = zoneData[zone];
      if (!d) continue;

      const actualMap   = new Map<string, number>();
      const actualTsSet = new Set<string>();
      for (const p of d.actuals) {
        const rec = p as Record<string, unknown>;
        if (rec[valueField] == null) continue;
        const ts = nts(p.timestamp);
        actualMap.set(ts, Number(rec[valueField]));
        actualTsSet.add(ts);
      }

      const lastActualTs = Array.from(actualTsSet).sort().at(-1) ?? "";
      grid[zone] = new Map();

      for (const p of d.forecasts) {
        const rec = p as Record<string, unknown>;
        if (rec[valueField] == null) continue;
        const ts = nts(p.timestamp);
        if (ts > lastActualTs) continue;
        const actual = actualMap.get(ts);
        if (actual == null) continue;
        const predicted = Number(rec[valueField]);
        grid[zone].set(ts, { actual, predicted, mae: Math.abs(actual - predicted) });
        tsSet.add(ts);
      }
    }

    const timestamps = Array.from(tsSet).sort();

    // All MAE values for p95 normalization (avoids a single outlier washing out colors)
    const allMae: number[] = [];
    const zoneAvgMae: Record<string, number> = {};
    let maxMae = 0;

    for (const [zone, zMap] of Object.entries(grid)) {
      const vals: number[] = [];
      for (const c of zMap.values()) {
        allMae.push(c.mae);
        vals.push(c.mae);
        if (c.mae > maxMae) maxMae = c.mae;
      }
      if (vals.length)
        zoneAvgMae[zone] = vals.reduce((a, b) => a + b, 0) / vals.length;
    }

    allMae.sort((a, b) => a - b);
    const p95Mae = allMae[Math.floor(allMae.length * 0.95)] ?? maxMae;

    return { grid, timestamps, p95Mae, maxMae, zoneAvgMae };
  }, [zoneData, zones, valueField]);

  // ── Draw canvas ────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !timestamps.length) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cellW = Math.max(3, Math.floor((containerW - LEFT_PAD - RIGHT_PAD) / timestamps.length));
    cellWRef.current = cellW;

    const cw = LEFT_PAD + timestamps.length * cellW + RIGHT_PAD;
    const ch = CELL_H * zones.length + BOTTOM_PAD;
    canvas.width  = cw;
    canvas.height = ch;

    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, cw, ch);

    // ── Cells ────────────────────────────────────────────────────────────────
    zones.forEach((zone, zi) => {
      const zMap = grid[zone];
      timestamps.forEach((ts, ti) => {
        const cell = zMap?.get(ts);
        if (!cell) {
          ctx.fillStyle = "#f5f5f7";
        } else {
          const t = p95Mae > 0 ? Math.min(1, cell.mae / p95Mae) : 0;
          const [r, g, b] = maeColor(t);
          ctx.fillStyle = `rgb(${r},${g},${b})`;
        }
        ctx.fillRect(LEFT_PAD + ti * cellW, zi * CELL_H, cellW - 1, CELL_H - 2);
      });
    });

    // ── Zone labels (left) ───────────────────────────────────────────────────
    ctx.font         = "bold 11px -apple-system, system-ui, sans-serif";
    ctx.textAlign    = "right";
    ctx.textBaseline = "middle";
    zones.forEach((zone, zi) => {
      ctx.fillStyle = ZONE_COLORS[zone] ?? "#6e6e73";
      ctx.fillText(zone, LEFT_PAD - 8, zi * CELL_H + CELL_H / 2 - 1);
    });

    // ── Per-zone avg MAE (right) ─────────────────────────────────────────────
    const rightX = LEFT_PAD + timestamps.length * cellW + 8;
    ctx.font         = "11px -apple-system, system-ui, sans-serif";
    ctx.textAlign    = "left";
    ctx.textBaseline = "middle";
    zones.forEach((zone, zi) => {
      const avg = zoneAvgMae[zone];
      if (avg == null) return;
      const t = p95Mae > 0 ? Math.min(1, avg / p95Mae) : 0;
      const [r, g, b] = maeColor(t);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillText(`avg ${avg.toFixed(1)} ${unit}`, rightX, zi * CELL_H + CELL_H / 2 - 1);
    });

    // ── X-axis: day separators + 6h ticks + labels ───────────────────────────
    ctx.textBaseline = "alphabetic";
    timestamps.forEach((ts, ti) => {
      const dt = new Date(ts);
      const h  = dt.getUTCHours();
      const m  = dt.getUTCMinutes();
      if (m !== 0) return;

      const x = LEFT_PAD + ti * cellW;

      if (h === 0) {
        ctx.fillStyle = "rgba(0,0,0,0.12)";
        ctx.fillRect(x, 0, 1, zones.length * CELL_H);
        ctx.font      = "bold 10px -apple-system, system-ui, sans-serif";
        ctx.fillStyle = "#6e6e73";
        ctx.textAlign = "center";
        ctx.fillText(format(dt, "dd/MM"), x + cellW, zones.length * CELL_H + 20);
      } else if (h % 6 === 0) {
        ctx.fillStyle = "rgba(0,0,0,0.06)";
        ctx.fillRect(x, 0, 1, zones.length * CELL_H);
        ctx.font      = "9px -apple-system, system-ui, sans-serif";
        ctx.fillStyle = "#8e8e93";
        ctx.textAlign = "center";
        ctx.fillText(`${h}h`, x, zones.length * CELL_H + 20);
      }
    });
  }, [grid, timestamps, p95Mae, zones, zoneAvgMae, containerW, unit]);

  // ── Mouse → tooltip ────────────────────────────────────────────────────────
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect   = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top)  * scaleY;

    const cellW = cellWRef.current;
    const ti = Math.floor((mx - LEFT_PAD) / cellW);
    const zi = Math.floor(my / CELL_H);

    if (ti < 0 || ti >= timestamps.length || zi < 0 || zi >= zones.length) {
      setTooltip(null); return;
    }

    const ts   = timestamps[ti];
    const zone = zones[zi];
    const cell = grid[zone]?.get(ts);
    if (!cell) { setTooltip(null); return; }

    setTooltip({ screenX: e.clientX, screenY: e.clientY, zone, ts, cell });
  }, [timestamps, zones, grid]);

  if (loading) return (
    <div style={{ textAlign: "center", padding: "48px 0", color: "#8e8e93", fontSize: 13 }}>Loading…</div>
  );
  if (!timestamps.length) return (
    <div style={{ textAlign: "center", padding: "48px 0", color: "#8e8e93", fontSize: 13 }}>
      No hindcast data available for this date range.
    </div>
  );

  const errorColor = (mae: number) =>
    mae < 2 ? "#28a745" : mae < 8 ? "#c47d00" : "#e53030";

  const legendStops = [0, 0.25, 0.5, 0.75, 1].map(t => ({
    t, val: (t * p95Mae).toFixed(1),
    css: (() => { const [r, g, b] = maeColor(t); return `rgb(${r},${g},${b})`; })(),
  }));

  return (
    <div style={{ position: "relative" }}>
      {/* Legend */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "#6e6e73" }}>
          <span>MAE {unit}</span>
          <div style={{
            flex: 1, maxWidth: 220, height: 8, borderRadius: 4,
            background: "linear-gradient(to right, rgb(56,178,172), rgb(246,224,94), rgb(252,82,82))",
          }} />
          <span style={{ color: "#8e8e93", fontSize: 10 }}>clipped at p95 · max {maxMae.toFixed(1)}</span>
        </div>
        <div style={{ display: "flex", gap: 0, marginTop: 4, maxWidth: 228, marginLeft: 44 }}>
          {legendStops.map(({ val, css }) => (
            <div key={val} style={{ flex: 1, textAlign: "center" }}>
              <div style={{ width: 2, height: 4, background: "#8e8e93", margin: "0 auto" }} />
              <span style={{ fontSize: 9, color: css }}>{val}</span>
            </div>
          ))}
        </div>
      </div>

      <div ref={containerRef} style={{ overflowX: "auto" }}>
        <canvas
          ref={canvasRef}
          style={{ display: "block", cursor: "crosshair" }}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setTooltip(null)}
        />
      </div>

      {tooltip && (
        <div style={{
          position: "fixed",
          left: tooltip.screenX + 14,
          top:  tooltip.screenY - 10,
          zIndex: 2000,
          background: "#fff",
          border: "1px solid rgba(0,0,0,0.08)",
          borderRadius: 10,
          padding: "10px 14px",
          fontSize: 12,
          minWidth: 215,
          pointerEvents: "none",
          boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
        }}>
          <div style={{ color: "#6e6e73", marginBottom: 6, fontWeight: 600 }}>
            {format(new Date(tooltip.ts), "dd MMM yyyy HH:mm")}
            <span style={{ marginLeft: 8, color: ZONE_COLORS[tooltip.zone] ?? "#6e6e73", fontWeight: 700 }}>
              {tooltip.zone}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, color: "#0071e3", marginBottom: 3 }}>
            <span>Actual</span>
            <span style={{ fontWeight: 700 }}>{tooltip.cell.actual.toFixed(2)} {unit}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, color: "#28a745", marginBottom: 3 }}>
            <span>Predicted</span>
            <span style={{ fontWeight: 700 }}>{tooltip.cell.predicted.toFixed(2)} {unit}</span>
          </div>
          <div style={{
            display: "flex", justifyContent: "space-between", gap: 16,
            color: errorColor(tooltip.cell.mae),
            borderTop: "1px solid rgba(0,0,0,0.07)", paddingTop: 6, marginTop: 3, marginBottom: 3,
          }}>
            <span>|Error|</span>
            <span style={{ fontWeight: 700 }}>{tooltip.cell.mae.toFixed(2)} {unit}</span>
          </div>
          <div style={{
            display: "flex", justifyContent: "space-between", gap: 16,
            color: (tooltip.cell.predicted - tooltip.cell.actual) >= 0 ? "#e53030" : "#28a745",
          }}>
            <span>Δ pred − actual</span>
            <span>
              {(tooltip.cell.predicted - tooltip.cell.actual) >= 0 ? "+" : ""}
              {(tooltip.cell.predicted - tooltip.cell.actual).toFixed(2)} {unit}
            </span>
          </div>
          {/* % of avg for this zone */}
          {zoneAvgMae[tooltip.zone] != null && (
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16, color: "#8e8e93", marginTop: 3, fontSize: 11 }}>
              <span>vs zone avg</span>
              <span>{((tooltip.cell.mae / zoneAvgMae[tooltip.zone]) * 100).toFixed(0)}%</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
