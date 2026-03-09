export const ZONE_COLORS: Record<string, string> = {
  DE_LU:    "#63b3ed",
  FR:       "#68d391",
  ES:       "#f6ad55",
  PT:       "#fc8181",
  NL:       "#b794f4",
  BE:       "#76e4f7",
  AT:       "#f6e05e",
  IT_NORTH: "#fbb6ce",
  PL:       "#9ae6b4",
  FI:       "#bee3f8",
  DK_1:     "#faf089",
};

/** Zones that have a geographic mapping and appear on the map. */
export const MAP_ZONES = Object.keys(ZONE_COLORS);

/** ISO numeric country code → bidding zone */
export const ISO_TO_ZONE: Record<string, string> = {
  "276": "DE_LU",   // Germany
  "442": "DE_LU",   // Luxembourg
  "250": "FR",
  "724": "ES",
  "620": "PT",
  "528": "NL",
  "56":  "BE",
  "40":  "AT",
  "380": "IT_NORTH",
  "616": "PL",
  "208": "DK_1",
  "246": "FI",
};

/** Approximate [lon, lat] centroids for placing map markers. */
export const ZONE_CENTROIDS: Record<string, [number, number]> = {
  DE_LU:    [10.4,  51.1],
  FR:       [ 2.3,  46.2],
  ES:       [-3.7,  40.4],
  PT:       [-8.2,  39.5],
  NL:       [ 5.3,  52.3],
  BE:       [ 4.5,  50.5],
  AT:       [14.5,  47.5],
  IT_NORTH: [11.2,  44.5],
  PL:       [19.1,  52.0],
  FI:       [25.7,  61.9],
  DK_1:     [ 9.5,  56.0],
};

/**
 * Color per ENTSOE production type — keys are the snake_case strings
 * returned by the API (e.g. "wind_onshore", "fossil_gas").
 */
export const PROD_TYPE_COLOR: Record<string, string> = {
  solar:                          "#f6e05e",
  wind_onshore:                   "#63b3ed",
  wind_offshore:                  "#2b6cb0",
  nuclear:                        "#b794f4",
  hydro_run_of_river_and_poundage:"#4fc3f7",
  hydro_water_reservoir:          "#0288d1",
  hydro_pumped_storage:           "#01579b",
  biomass:                        "#48bb78",
  geothermal:                     "#ed64a6",
  other_renewable:                "#81e6d9",
  fossil_gas:                     "#ed8936",
  fossil_coal_derived_gas:        "#dd6b20",
  fossil_hard_coal:               "#718096",
  fossil_brown_coal_lignite:      "#975a16",
  fossil_oil:                     "#c05621",
  fossil_peat:                    "#744210",
  waste:                          "#9ae6b4",
  marine:                         "#bee3f8",
  other:                          "#a0aec0",
};

/** Human-readable label for a snake_case production type. */
export function prodTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    solar:                          "Solar",
    wind_onshore:                   "Wind Onshore",
    wind_offshore:                  "Wind Offshore",
    nuclear:                        "Nuclear",
    hydro_run_of_river_and_poundage:"Hydro (run-of-river)",
    hydro_water_reservoir:          "Hydro (reservoir)",
    hydro_pumped_storage:           "Hydro (pumped)",
    biomass:                        "Biomass",
    geothermal:                     "Geothermal",
    other_renewable:                "Other renewable",
    fossil_gas:                     "Fossil Gas",
    fossil_coal_derived_gas:        "Coal-derived Gas",
    fossil_hard_coal:               "Hard Coal",
    fossil_brown_coal_lignite:      "Lignite",
    fossil_oil:                     "Oil",
    fossil_peat:                    "Peat",
    waste:                          "Waste",
    marine:                         "Marine",
    other:                          "Other",
  };
  return labels[type] ?? type.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

/** ISO numeric codes of European countries to render on the map. */
export const EUROPE_ISO = new Set([
  "8","20","40","56","70","100","191","196","203","208",
  "233","246","250","276","300","348","352","372","380","428",
  "438","440","442","470","498","499","528","540","578","616",
  "620","642","643","688","703","705","724","752","756","792",
  "804","807","826","112",
]);
