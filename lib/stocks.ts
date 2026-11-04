import { validSymbol, parseWeekly, parseOverview } from "@/lib/market.mjs";
import { forecast } from "@/lib/forecast.mjs";
import { HttpError } from "@/lib/server";
import { credentials, providerQuery } from "@/lib/provider";
import type { StockData } from "@/lib/stock-types";
import { publicPrices } from "@/lib/public-prices";
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
  if (creds.demo && symbol !== "IBM") {
    const { prices, overview, snapshot, fetchedAt } = await publicPrices(
      owner,
      symbol,
    );
    return {
      symbol,
      prices,
      overview,
      forecast: forecast(prices, new Date(), horizon),
      source: snapshot ? "Yahoo Finance · saved history" : "Yahoo Finance",
      demo: true,
      fetchedAt,
      warning:
        (snapshot
          ? "Showing saved price history through " + prices.at(-1)!.date + ". "
          : "") +
        "Connect Alpha Vantage in Settings for additional fundamentals, news, and earnings.",
    };
  }
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
