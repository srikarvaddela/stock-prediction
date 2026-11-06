/// <reference types="vite/client" />
import { publishedForecast } from "./python-result.mjs";
import { feedFile } from "./data-feed";
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
export async function latestPythonForecast(symbol:string,horizon:number) {
  const remote=await feedFile<unknown>(`models/${symbol}-${horizon}.json`,d=>!!publishedForecast(d,symbol,horizon));
  const report=publishedForecast(remote,symbol,horizon), bundled=pythonForecast(symbol,horizon);
  return report && (!bundled || report.asOf>=bundled.asOf) ? report : bundled;
}
