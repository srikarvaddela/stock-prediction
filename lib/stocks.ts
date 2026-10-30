import { validSymbol, parseWeekly, parseOverview } from "@/lib/market.mjs";
import { forecast } from "@/lib/forecast.mjs";
import { HttpError } from "@/lib/server";
import { credentials, providerQuery } from "@/lib/provider";
import type { StockData } from "@/lib/stock-types";
export async function loadStock(
  owner: string,
  symbol: string,
  horizon = 1,
): Promise<StockData> {
  if (!validSymbol(symbol))
    throw new HttpError(400, "Enter a valid stock ticker.");
  if (![1, 4].includes(horizon))
    throw new HttpError(400, "Choose a one- or four-week horizon.");
  const creds = await credentials(owner);
  if (creds.demo && symbol !== "IBM")
    throw new HttpError(
      503,
      "Connect your free Alpha Vantage key in Settings to research this stock. IBM is available without a key.",
    );
  const prices = parseWeekly(
    await providerQuery(owner, creds, "TIME_SERIES_WEEKLY_ADJUSTED", {
      symbol,
    }),
  );
  let overview = null,
    warning = "";
  try {
    overview = parseOverview(
      await providerQuery(owner, creds, "OVERVIEW", { symbol }, 86400000),
      symbol,
    );
  } catch (e) {
    warning =
      e instanceof HttpError
        ? e.message
        : "Company fundamentals are currently unavailable.";
  }
  let model = null;
  try {
    model = forecast(prices, new Date(), horizon);
  } catch {
    warning += " The model could not safely process this price history.";
  }
  return {
    symbol,
    prices,
    overview,
    forecast: model,
    source: "Alpha Vantage",
    demo: creds.demo,
    fetchedAt: new Date().toISOString(),
    warning: warning || null,
  };
}
