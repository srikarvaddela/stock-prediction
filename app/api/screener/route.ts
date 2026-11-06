import {
  identity,
  privateJson,
  failure,
  HttpError,
  database,
  jsonBody,
} from "@/lib/server";
import catalog from "@/lib/stock-picker.json";
import sectors from "@/lib/stock-sectors.json";
import { savedHistory } from "@/lib/price-snapshots";
import { pythonForecast } from "@/lib/python-forecasts";
import { credentials, providerQuery } from "@/lib/provider";
import { parseOverview } from "@/lib/market.mjs";
import { stockSymbol } from "@/lib/company-search.mjs";
import { screenMetrics } from "@/lib/screener.mjs";
export async function GET() {
  try {
    const owner = await identity();
    const tickers = Object.keys(catalog);
    let canLoadFundamentals = false,
      connectionMessage = "";
    const overviews = new Map<
      string,
      NonNullable<ReturnType<typeof parseOverview>>
    >();
    try {
      const creds = await credentials(owner);
      canLoadFundamentals = !creds.demo;
      const cached = await database().batch(
        tickers.map((symbol) =>
          database()
            .prepare(
              "SELECT body FROM market_cache WHERE id=? AND owner_id=? AND expires_at>?",
            )
            .bind(
              `${owner}:${creds.fingerprint}:OVERVIEW:${new URLSearchParams({ symbol })}`,
              owner,
              Date.now(),
            ),
        ),
      );
      cached.forEach((result, i) => {
        const row = result.results[0] as { body: string } | undefined;
        if (row) {
          const overview = parseOverview(JSON.parse(row.body), tickers[i]);
          if (overview) overviews.set(tickers[i], overview);
        }
      });
    } catch {
      connectionMessage =
        "Cached fundamentals could not load. Price-based filters are still available.";
    }
    const rows = Object.entries(catalog).map(([symbol, name]) => {
      const snapshot = savedHistory(symbol),
        last = snapshot?.prices.at(-1),
        overview = overviews.get(symbol),
        python = pythonForecast(symbol, 1);
      return {
        symbol,
        name,
        sector: (sectors as Record<string, string>)[symbol],
        price: last?.close ?? null,
        priceDate: last?.date ?? null,
        priceStale:
          !last ||
          Date.now() - Date.parse(last.date + "T00:00:00Z") > 7 * 86400000,
        source: "Yahoo Finance · saved history",
        ...screenMetrics(snapshot?.prices ?? []),
        pe: overview?.pe ?? null,
        revenueGrowth: overview?.revenueGrowth ?? null,
        fiscalQuarter: overview?.latestQuarter ?? null,
        pythonMae: python?.mae ?? null,
        pythonAsOf: python?.asOf ?? null,
        pythonBeatsBaseline:
          !!python &&
          !python.outdated &&
          !python.stale &&
          python.mae < python.baselineMae,
      };
    });
    return privateJson({ rows, canLoadFundamentals, connectionMessage });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    const owner = await identity(request),
      body = await jsonBody(request),
      symbol = stockSymbol(typeof body.symbol === "string" ? body.symbol : "");
    if (!Object.hasOwn(catalog, symbol))
      throw new HttpError(400, "Choose a featured company.");
    const creds = await credentials(owner);
    if (creds.demo && symbol !== "IBM")
      throw new HttpError(
        409,
        "Connect Alpha Vantage in Settings to load company fundamentals.",
      );
    const overview = parseOverview(
      await providerQuery(owner, creds, "OVERVIEW", { symbol }, 86400000),
      symbol,
    );
    if (!overview)
      throw new HttpError(
        502,
        "The provider did not return matching company fundamentals.",
      );
    return privateJson({ symbol, message: "Reported fundamentals loaded." });
  } catch (e) {
    return failure(e);
  }
}
