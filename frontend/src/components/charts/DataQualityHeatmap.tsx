import { useMemo, useRef, useEffect, useState, useCallback } from "react";
import { format } from "date-fns";
import { ZONE_COLORS } from "../../constants/zones";

interface DayCell {
  present:  number;
  expected: number;
  coverage: number;   // 0–1
}

interface TooltipState {
  screenX: number;
  screenY: number;
  zone: string;
  day: string;
  cell: DayCell;
}

interface Props {
  /** zone → list of ISO timestamps where a value is present */
  zoneData: Record<string, string[] | null>;
  zones: string[];
  /** Local date strings "yyyy-MM-dd" */
  startDay: string;
  endDay: string;
  loading?: boolean;
  /** Override label colors (default: ZONE_COLORS) */
  zoneColors?: Record<string, string>;
}

/** Infer most-common interval (ms) from sorted timestamps. */
function inferStepMs(sortedTs: string[]): number {
  if (sortedTs.length < 2) return 3_600_000;
  const counts: Record<number, number> = {};
  for (let i = 1; i < Math.min(sortedTs.length, 96); i++) {
    const d = new Date(sortedTs[i]).getTime() - new Date(sortedTs[i - 1]).getTime();
    if (d > 0) counts[d] = (counts[d] ?? 0) + 1;
  }
  const entries = Object.entries(counts);
  if (!entries.length) return 3_600_000;
  return Number(entries.sort((a, b) => Number(b[1]) - Number(a[1]))[0][0]);
}

/** Coverage 0→1: vivid red → deep amber → vivid green */
function coverageColor(c: number): [number, number, number] {
  if (c < 0.5) {
    const u = c * 2;
    // #ff3b30 → #ff8c00 (vivid orange-amber — much better contrast on white than yellow)
    return [255, Math.round(59 + (140 - 59) * u), Math.round(48 + (0 - 48) * u)];
  }
  const u = (c - 0.5) * 2;
  // #ff8c00 → #34c759
  return [Math.round(255 + (52 - 255) * u), Math.round(140 + (199 - 140) * u), Math.round(0 + (89 - 0) * u)];
}

const CELL_H     = 40;
const LEFT_PAD   = 90;
const RIGHT_PAD  = 100;
const BOTTOM_PAD = 36;

export default function DataQualityHeatmap({
  zoneData, zones, startDay, endDay, loading, zoneColors,
}: Props) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const cellWRef     = useRef<number>(30);

  const [containerW, setContainerW] = useState(900);
  const [tooltip, setTooltip]       = useState<TooltipState | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(e => setContainerW(e[0].contentRect.width));
    ro.observe(containerRef.current);
    setContainerW(containerRef.current.clientWidth || 900);
    return () => ro.disconnect();
  }, []);

  // ── Build daily grid ─────────────────────────────────────────────────────────
  const { dayGrid, days, zoneStats, stepMs } = useMemo(() => {
    const minDayMs = new Date(startDay + "T00:00:00.000Z").getTime();
    const maxDayMs = new Date(endDay   + "T00:00:00.000Z").getTime();

    if (maxDayMs < minDayMs) return { dayGrid: {}, days: [], zoneStats: {}, stepMs: 3_600_000 };

    const days: string[] = [];
    for (let ms = minDayMs; ms <= maxDayMs; ms += 86_400_000) {
      days.push(new Date(ms).toISOString().slice(0, 10));
    }

    if (!days.length) return { dayGrid: {}, days: [], zoneStats: {}, stepMs: 3_600_000 };

    // Infer step size from all available timestamps
    const allTs: string[] = [];
    for (const zone of zones) {
      const ts = zoneData[zone];
      if (ts) for (const t of ts) allTs.push(t);
    }
    const sortedAll = Array.from(new Set(allTs)).sort();
    const stepMs    = sortedAll.length >= 2 ? inferStepMs(sortedAll) : 3_600_000;

    type ZoneStats = Record<string, { totalPresent: number; totalExpected: number }>;
    const dayGrid:   Record<string, Map<string, DayCell>> = {};
    const zoneStats: ZoneStats = {};

    for (const zone of zones) {
      const tsList = zoneData[zone];

      if (!tsList || !tsList.length) {
        const m = new Map<string, DayCell>();
        for (const day of days) m.set(day, { present: 0, expected: 0, coverage: 0 });
        dayGrid[zone] = m;
        zoneStats[zone] = { totalPresent: 0, totalExpected: 0 };
        continue;
      }

      const tsSet = new Set(tsList.map(t => new Date(t).toISOString()));

      dayGrid[zone] = new Map();
      let totalPresent = 0, totalExpected = 0;

      for (const day of days) {
        const dayStart = new Date(day + "T00:00:00.000Z").getTime();
        const dayEnd   = dayStart + 86_400_000;

        let expected = 0, present = 0;
        for (let t = dayStart; t < dayEnd; t += stepMs) {
          expected++;
          const iso = new Date(t).toISOString();
          if (tsSet.has(iso)) present++;
        }

        const coverage = expected > 0 ? present / expected : 0;
        dayGrid[zone].set(day, { present, expected, coverage });
        totalPresent  += present;
        totalExpected += expected;
      }
      zoneStats[zone] = { totalPresent, totalExpected };
    }

    return { dayGrid, days, zoneStats, stepMs };
  }, [zoneData, zones, startDay, endDay]);

  // ── Draw canvas — runs whenever data OR date range changes ────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (!days.length) {
      canvas.width  = 300;
      canvas.height = 40;
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      return;
    }

    const cellW = Math.max(20, Math.floor((containerW - LEFT_PAD - RIGHT_PAD) / days.length));
    cellWRef.current = cellW;

    const cw = LEFT_PAD + days.length * cellW + RIGHT_PAD;
    const ch = CELL_H * zones.length + BOTTOM_PAD;
    canvas.width  = cw;
    canvas.height = ch;

    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, cw, ch);

    // ── Cells ────────────────────────────────────────────────────────────────
    zones.forEach((zone, zi) => {
      const zg = dayGrid[zone];
      days.forEach((day, di) => {
        const cell = zg?.get(day);
        const x = LEFT_PAD + di * cellW;
        const y = zi * CELL_H;

        if (!cell) {
          ctx.fillStyle = "#f5f5f7";
        } else {
          const [r, g, b] = coverageColor(cell.coverage);
          ctx.fillStyle = `rgb(${r},${g},${b})`;
        }
        ctx.fillRect(x, y, cellW - 2, CELL_H - 2);

        if (cell && cell.coverage < 1 && cellW >= 26) {
          ctx.font         = `bold ${Math.min(11, cellW / 3.5 | 0)}px -apple-system, system-ui, sans-serif`;
          ctx.textAlign    = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle    = "#fff";
          const pct = Math.round(cell.coverage * 100);
          ctx.fillText(`${pct}%`, x + (cellW - 2) / 2, y + CELL_H / 2 - 1);
        }
      });
    });

    // ── Zone labels (left) ────────────────────────────────────────────────────
    ctx.font         = "bold 11px -apple-system, system-ui, sans-serif";
    ctx.textAlign    = "right";
    ctx.textBaseline = "middle";
    zones.forEach((zone, zi) => {
      ctx.fillStyle = (zoneColors?.[zone] ?? ZONE_COLORS[zone]) ?? "#6e6e73";
      ctx.fillText(zone, LEFT_PAD - 8, zi * CELL_H + CELL_H / 2 - 1);
    });

    // ── Per-zone missing % (right) ─────────────────────────────────────────────
    const rightX = LEFT_PAD + days.length * cellW + 8;
    ctx.font         = "11px -apple-system, system-ui, sans-serif";
    ctx.textAlign    = "left";
    ctx.textBaseline = "middle";
    zones.forEach((zone, zi) => {
      const s = zoneStats[zone];
      if (!s || s.totalExpected === 0) return;
      const missPct = (1 - s.totalPresent / s.totalExpected) * 100;
      ctx.fillStyle = missPct < 1 ? "#28a745" : missPct < 10 ? "#c47d00" : "#e53030";
      ctx.fillText(
        missPct < 0.1 ? "100%" : `${missPct.toFixed(1)}% miss`,
        rightX, zi * CELL_H + CELL_H / 2 - 1,
      );
    });

    // ── X-axis day labels ──────────────────────────────────────────────────────
    ctx.font         = "10px -apple-system, system-ui, sans-serif";
    ctx.textAlign    = "center";
    ctx.textBaseline = "alphabetic";
    days.forEach((day, di) => {
      const dt  = new Date(day + "T00:00:00.000Z");
      const dow = dt.getUTCDay();
      const x   = LEFT_PAD + di * cellW + cellW / 2;

      if (dow === 0 || dow === 6) {
        ctx.fillStyle = "rgba(0,0,0,0.03)";
        ctx.fillRect(LEFT_PAD + di * cellW, 0, cellW - 2, zones.length * CELL_H);
      }

      const showLabel = days.length <= 14 || dow === 1 || dt.getUTCDate() === 1;
      if (showLabel) {
        ctx.fillStyle = "#6e6e73";
        ctx.fillText(format(dt, dt.getUTCDate() === 1 ? "dd/MM" : "dd"), x, zones.length * CELL_H + 22);
      }
    });
  // Canvas must redraw whenever data, dates, zones, or container width changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayGrid, days, zones, zoneStats, zoneColors, containerW]);

  // ── Hover → tooltip ───────────────────────────────────────────────────────────
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect   = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top)  * scaleY;

    const cellW = cellWRef.current;
    const di = Math.floor((mx - LEFT_PAD) / cellW);
    const zi = Math.floor(my / CELL_H);

    if (di < 0 || di >= days.length || zi < 0 || zi >= zones.length) {
      setTooltip(null); return;
    }

    const day  = days[di];
    const zone = zones[zi];
    const cell = dayGrid[zone]?.get(day);
    if (!cell) { setTooltip(null); return; }

    setTooltip({ screenX: e.clientX, screenY: e.clientY, zone, day, cell });
  }, [days, zones, dayGrid]);

  const slotsPerDay  = stepMs > 0 ? Math.round(86_400_000 / stepMs) : 24;
  const totalMissing = Object.values(zoneStats)
    .reduce((s, z) => s + (z.totalExpected - z.totalPresent), 0);

  return (
    <div style={{ position: "relative" }}>
      {/* Legend */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 10, flexWrap: "wrap", fontSize: 11 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 80, height: 8, borderRadius: 4,
            background: "linear-gradient(to right, #ff3b30, #ff8c00, #34c759)" }} />
          <span style={{ color: "#6e6e73" }}>0% → 100%</span>
        </div>
        <span style={{ color: "#8e8e93" }}>· {slotsPerDay} slots/day · 1 cell = 1 day</span>
        {!loading && (
          <span style={{ marginLeft: "auto", color: totalMissing > 0 ? "#e53030" : "#28a745", fontWeight: 600 }}>
            {totalMissing > 0 ? `${totalMissing} missing slots` : "All slots present"}
          </span>
        )}
      </div>

      {/* Canvas container — always mounted so the canvas element stays alive */}
      <div ref={containerRef} style={{ position: "relative", overflowX: "auto" }}>
        <canvas
          ref={canvasRef}
          style={{ display: "block", cursor: loading ? "default" : "crosshair" }}
          onMouseMove={loading ? undefined : handleMouseMove}
          onMouseLeave={() => setTooltip(null)}
        />

        {/* Loading overlay — sits on top of the canvas without unmounting it */}
        {loading && (
          <div style={{
            position: "absolute", inset: 0,
            background: "rgba(255,255,255,0.82)",
            display: "flex", alignItems: "center", justifyContent: "center",
            borderRadius: 4, backdropFilter: "blur(4px)",
          }}>
            <span style={{ color: "#aeaeb2", fontSize: 13 }}>Loading…</span>
          </div>
        )}
      </div>

      {tooltip && !loading && (
        <div style={{
          position: "fixed", left: tooltip.screenX + 14, top: tooltip.screenY - 10,
          zIndex: 2000, background: "#fff", border: "1px solid rgba(0,0,0,0.08)",
          borderRadius: 10, padding: "10px 14px", fontSize: 12, minWidth: 200,
          pointerEvents: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.12)",
        }}>
          <div style={{ color: "#6e6e73", marginBottom: 6, fontWeight: 600 }}>
            {format(new Date(tooltip.day + "T00:00:00.000Z"), "dd MMM yyyy")}
            <span style={{
              marginLeft: 8,
              color: (zoneColors?.[tooltip.zone] ?? ZONE_COLORS[tooltip.zone]) ?? "#6e6e73",
              fontWeight: 700,
            }}>
              {tooltip.zone}
            </span>
          </div>
          <div style={{
            display: "flex", justifyContent: "space-between", gap: 16, marginBottom: 3,
            color: tooltip.cell.coverage === 1 ? "#28a745" : tooltip.cell.coverage > 0.8 ? "#c47d00" : "#e53030",
          }}>
            <span>Couverture</span>
            <span style={{ fontWeight: 700 }}>{(tooltip.cell.coverage * 100).toFixed(1)}%</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 16, color: "#0071e3", marginBottom: 3 }}>
            <span>Slots present</span>
            <span>{tooltip.cell.present} / {tooltip.cell.expected}</span>
          </div>
          {tooltip.cell.expected - tooltip.cell.present > 0 && (
            <div style={{ display: "flex", justifyContent: "space-between", gap: 16, color: "#ff453a" }}>
              <span>Missing slots</span>
              <span style={{ fontWeight: 700 }}>{tooltip.cell.expected - tooltip.cell.present}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
