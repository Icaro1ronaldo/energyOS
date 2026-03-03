import { useState, useEffect, useCallback } from "react";
import { energyApi, PriceResponse, LoadResponse, ProductionResponse } from "../services/api";

type Status = "idle" | "loading" | "success" | "error";

function useData<T>(fetcher: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [status, setStatus] = useState<Status>("idle");

  const load = useCallback(async () => {
    setStatus("loading");
    try {
      setData(await fetcher());
      setStatus("success");
    } catch {
      setStatus("error");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => { load(); }, [load]);

  return { data, status, reload: load };
}

export function usePrices(zone: string, start?: string, end?: string) {
  return useData<PriceResponse>(() => energyApi.getPrices(zone, start, end), [zone, start, end]);
}

export function useLoad(zone: string, start?: string, end?: string) {
  return useData<LoadResponse>(() => energyApi.getLoad(zone, start, end), [zone, start, end]);
}

export function useProduction(zone: string, start?: string, end?: string) {
  return useData<ProductionResponse[]>(() => energyApi.getProduction(zone, start, end), [zone, start, end]);
}
