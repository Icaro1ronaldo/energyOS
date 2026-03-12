import { useState } from "react";
import { ComposableMap, Geographies, Geography, Marker } from "react-simple-maps";
import { ISO_TO_ZONE, ZONE_COLORS, EUROPE_ISO, ZONE_CENTROIDS, PROD_TYPE_COLOR, prodTypeLabel } from "../constants/zones";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

interface Props {
  zoneValues: Record<string, number | null>;
  selectedZones: string[];
  onZoneClick: (zone: string) => void;
  colorScale: (value: number) => string;
  unit: string;
  /** zone → { productionType → total MW } — when provided, mini pie charts are shown */
  productionMix?: Record<string, Record<string, number>> | null;
}

interface Tooltip { x: number; y: number; text: string }

// ── mini donut chart ───────────────────────────────────────────────────────────

interface Slice { type: string; value: number; color: string }

function MiniPie({ slices, r = 13 }: { slices: Slice[]; r?: number }) {
  const positive = slices.filter(s => s.value > 0);
  const total    = positive.reduce((s, d) => s + d.value, 0);
  if (!total) return <circle r={r} fill="#e2e8f0" opacity={0.8} />;

  // Single source → plain donut (arc from a point to itself is invalid SVG)
  if (positive.length === 1) {
    return (
      <>
        <circle r={r} fill={positive[0].color} />
        <circle r={r * 0.42} fill="#fff" />
      </>
    );
  }

  const paths: React.ReactNode[] = [];
  let angle = -Math.PI / 2;

  for (const { value, color } of positive) {
    const sweep    = (value / total) * 2 * Math.PI;
    const x1       = r * Math.cos(angle);
    const y1       = r * Math.sin(angle);
    const x2       = r * Math.cos(angle + sweep);
    const y2       = r * Math.sin(angle + sweep);
    const largeArc = sweep > Math.PI ? 1 : 0;
    paths.push(
      <path
        key={color + angle}
        d={`M0,0 L${x1.toFixed(2)},${y1.toFixed(2)} A${r},${r} 0 ${largeArc},1 ${x2.toFixed(2)},${y2.toFixed(2)} Z`}
        fill={color}
      />,
    );
    angle += sweep;
  }

  return (
    <>
      {paths}
      <circle r={r * 0.42} fill="#fff" />
    </>
  );
}

// ── component ──────────────────────────────────────────────────────────────────

export default function EuropeMap({ zoneValues, selectedZones, onZoneClick, colorScale, unit, productionMix }: Props) {
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);

  return (
    <div style={{ position: "relative" }}>
      {tooltip && (
        <div style={{
          position: "fixed", left: tooltip.x + 14, top: tooltip.y - 32,
          background: "#fff", border: "1px solid rgba(0,0,0,0.08)",
          borderRadius: 8, padding: "4px 10px", fontSize: 12,
          color: "#1d1d1f", pointerEvents: "none", zIndex: 200, whiteSpace: "nowrap",
          boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
        }}>
          {tooltip.text}
        </div>
      )}

      <ComposableMap
        projection="geoAzimuthalEqualArea"
        projectionConfig={{ rotate: [-10, -52, 0], scale: 900 }}
        style={{ width: "100%", height: 360 }}
      >
        <Geographies geography={GEO_URL}>
          {({ geographies }) =>
            geographies
              .filter(geo => EUROPE_ISO.has(String(geo.id)))
              .map(geo => {
                const isoId   = String(geo.id);
                const zone    = ISO_TO_ZONE[isoId];
                const value   = zone != null ? zoneValues[zone] : null;
                const selected = zone != null && selectedZones.includes(zone);
                const fill    = value != null
                  ? colorScale(value)
                  : zone != null ? "#c8daea" : "#e8edf2";
                const borderColor = (selected && zone != null)
                  ? (ZONE_COLORS[zone] ?? "#0071e3")
                  : "rgba(255,255,255,0.8)";

                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    onClick={() => zone != null && onZoneClick(zone)}
                    onMouseEnter={evt => {
                      const name  = (geo.properties as { name?: string }).name ?? "";
                      const label = zone != null
                        ? `${zone}${value != null ? ` · ${value.toFixed(1)} ${unit}` : " · no data"}`
                        : name;
                      setTooltip({ x: evt.clientX, y: evt.clientY, text: label });
                    }}
                    onMouseMove={evt =>
                      setTooltip(t => t ? { ...t, x: evt.clientX, y: evt.clientY } : null)
                    }
                    onMouseLeave={() => setTooltip(null)}
                    style={{
                      default: {
                        fill,
                        stroke: borderColor,
                        strokeWidth: selected ? 2.5 : 0.5,
                        outline: "none",
                        cursor: zone != null ? "pointer" : "default",
                        transition: "fill 0.25s",
                      },
                      hover:   { fill: zone != null ? "#a8c8e8" : fill, stroke: "#0071e3", strokeWidth: 1.5, outline: "none" },
                      pressed: { fill: "#7ab8e0", outline: "none" },
                    }}
                  />
                );
              })
          }
        </Geographies>

        {/* Production-mix mini donut charts — shown when productionMix is provided */}
        {productionMix && Object.entries(ZONE_CENTROIDS).map(([zone, coords]) => {
          const mix = productionMix[zone];
          if (!mix) return null;
          const slices: Slice[] = Object.entries(mix)
            .filter(([, v]) => v > 0)
            .map(([type, value]) => ({ type, value, color: PROD_TYPE_COLOR[type] ?? "#a0aec0" }))
            .sort((a, b) => b.value - a.value);
          if (!slices.length) return null;

          const total = slices.reduce((s, sl) => s + sl.value, 0);

          const topLabel = slices.slice(0, 3)
            .map(sl => `${prodTypeLabel(sl.type)}: ${(sl.value / total * 100).toFixed(0)}%`)
            .join(" · ");

          return (
            <Marker key={zone} coordinates={coords}>
              <g
                style={{ cursor: "default", pointerEvents: "all" }}
                onMouseEnter={evt =>
                  setTooltip({ x: evt.clientX, y: evt.clientY, text: `${zone} · ${topLabel}` })
                }
                onMouseMove={evt =>
                  setTooltip(t => t ? { ...t, x: evt.clientX, y: evt.clientY } : null)
                }
                onMouseLeave={() => setTooltip(null)}
              >
                {/* Light halo so the pie is visible over any country color */}
                <circle r={15} fill="#fff" opacity={0.85} />
                <MiniPie slices={slices} r={14} />
              </g>
            </Marker>
          );
        })}
      </ComposableMap>
    </div>
  );
}
