import { identity, failure, privateJson, HttpError } from "@/lib/server";
import { stockSymbol } from "@/lib/company-search.mjs";
import { latestPythonForecast } from "@/lib/python-forecasts";
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
    return privateJson(report);
  } catch (e) {
    return failure(e);
  }
}
