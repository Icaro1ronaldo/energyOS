import { useState, useEffect } from "react";
import { energyApi, PriceResponse, LoadResponse, ProductionResponse } from "../services/api";

export function useMultiZonePrices(zones: string[], start: string, end: string) {
  const [data, setData] = useState<Record<string, PriceResponse | null>>({});
  const [loading, setLoading] = useState(false);
  const key = [...zones].sort().join(",");

  useEffect(() => {
    if (!zones.length) { setData({}); return; }
    let mounted = true;
    setLoading(true);
    Promise.all(
      zones.map(z =>
        energyApi.getPrices(z, start, end)
          .then((d): [string, PriceResponse | null] => [z, d])
          .catch((): [string, null] => [z, null])
      )
    ).then(results => {
      if (!mounted) return;
      setData(Object.fromEntries(results));
      setLoading(false);
    });
    return () => { mounted = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, start, end]);

  return { data, loading };
}

export function useMultiZoneLoad(zones: string[], start: string, end: string) {
  const [data, setData] = useState<Record<string, LoadResponse | null>>({});
  const [loading, setLoading] = useState(false);
  const key = [...zones].sort().join(",");

  useEffect(() => {
    if (!zones.length) { setData({}); return; }
    let mounted = true;
    setLoading(true);
    Promise.all(
      zones.map(z =>
        energyApi.getLoad(z, start, end)
          .then((d): [string, LoadResponse | null] => [z, d])
          .catch((): [string, null] => [z, null])
      )
    ).then(results => {
      if (!mounted) return;
      setData(Object.fromEntries(results));
      setLoading(false);
    });
    return () => { mounted = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, start, end]);

  return { data, loading };
}

export function useMultiZoneProduction(zones: string[], start: string, end: string) {
  const [data, setData] = useState<Record<string, ProductionResponse[] | null>>({});
  const [loading, setLoading] = useState(false);
  const key = [...zones].sort().join(",");

  useEffect(() => {
    if (!zones.length) { setData({}); return; }
    let mounted = true;
    setLoading(true);
    Promise.all(
      zones.map(z =>
        energyApi.getProduction(z, start, end)
          .then((d): [string, ProductionResponse[] | null] => [z, d])
          .catch((): [string, null] => [z, null])
      )
    ).then(results => {
      if (!mounted) return;
      setData(Object.fromEntries(results));
      setLoading(false);
    });
    return () => { mounted = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, start, end]);

  return { data, loading };
}
