/// <reference types="vite/client" />
import { publishedForecast } from "./python-result.mjs";
const reports = import.meta.glob("../.python-forecasts/*-*.json", {
  eager: true,
  import: "default",
}) as unknown as Record<string, unknown>;
export function pythonForecast(symbol: string, horizon: number) {
  return publishedForecast(
    reports[`../.python-forecasts/${symbol}-${horizon}.json`],
    symbol,
    horizon,
  );
}
