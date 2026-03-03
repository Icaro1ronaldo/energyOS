import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:8000",
});

export interface PricePoint {
  timestamp: string;
  bidding_zone: string;
  price_eur_mwh: number | null;
  is_forecast: boolean;
}

export interface LoadPoint {
  timestamp: string;
  bidding_zone: string;
  load_mw: number | null;
  is_forecast: boolean;
}

export interface ProductionPoint {
  timestamp: string;
  bidding_zone: string;
  production_type: string;
  value_mw: number | null;
  is_forecast: boolean;
}

export interface PriceResponse {
  zone: string;
  actuals: PricePoint[];
  forecasts: PricePoint[];
}

export interface LoadResponse {
  zone: string;
  actuals: LoadPoint[];
  forecasts: LoadPoint[];
}

export interface ProductionResponse {
  zone: string;
  production_type: string;
  actuals: ProductionPoint[];
  forecasts: ProductionPoint[];
}

export const energyApi = {
  getPrices: (zone: string, start?: string, end?: string) =>
    api.get<PriceResponse>(`/api/v1/prices/${zone}`, { params: { start, end } }).then((r) => r.data),

  getLoad: (zone: string, start?: string, end?: string) =>
    api.get<LoadResponse>(`/api/v1/load/${zone}`, { params: { start, end } }).then((r) => r.data),

  getProduction: (zone: string, start?: string, end?: string) =>
    api
      .get<ProductionResponse[]>(`/api/v1/production/${zone}`, { params: { start, end } })
      .then((r) => r.data),

  health: () => api.get("/health").then((r) => r.data),
};
