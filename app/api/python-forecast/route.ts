import { identity, failure, privateJson, HttpError } from "@/lib/server";
import { stockSymbol } from "@/lib/company-search.mjs";
import { latestPythonForecast } from "@/lib/python-forecasts";
import { evaluatePredictions } from "@/lib/evaluation.mjs";
import { feedFile } from "@/lib/data-feed";
export async function GET(request: Request) {
  try {
    await identity();
    const p = new URL(request.url).searchParams;
    const symbol = stockSymbol(p.get("symbol") || "");
    const horizon = Number(p.get("horizon") || 1);
    if (!symbol || ![1, 4].includes(horizon))
      throw new HttpError(
        400,
        "Choose a stock and a one- or four-week horizon.",
      );
    const report = await latestPythonForecast(symbol, horizon);
    if (!report)
      throw new HttpError(
        404,
        "No Python report is available yet. Models need at least 180 contiguous completed weeks; the scheduled job trains eligible histories.",
      );
    const registry=await feedFile<{symbol:string;horizon:number;records:{asOf:string;target:string;predictedReturn:number;actualReturn:number|null;createdAt:string}[]}>(`records/${symbol}-${horizon}.json`,d=>!!d && (d as {symbol:string}).symbol===symbol && (d as {horizon:number}).horizon===horizon && Array.isArray((d as {records:unknown[]}).records));
    return privateJson({...report,evaluation:evaluatePredictions(report.backtest,horizon),forwardEvaluation:evaluatePredictions(registry?.records??[],horizon),forwardRecords:registry?.records??[]});
  } catch (e) {
    return failure(e);
  }
}
