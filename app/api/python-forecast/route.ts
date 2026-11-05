import { identity, failure, privateJson, HttpError } from "@/lib/server";
import { stockSymbol } from "@/lib/company-search.mjs";
import { pythonForecast } from "@/lib/python-forecasts";
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
    const report = pythonForecast(symbol, horizon);
    if (!report)
      throw new HttpError(
        404,
        "No published Python model for this company yet. Choose one of the featured companies.",
      );
    return privateJson(report);
  } catch (e) {
    return failure(e);
  }
}
