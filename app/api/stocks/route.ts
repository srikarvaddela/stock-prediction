import { env } from "cloudflare:workers";
import { validSymbol, parseWeekly, parseOverview } from "@/lib/market.mjs";
import type { StockData } from "@/lib/stock-types";
import { forecast } from "@/lib/forecast.mjs";

const cache = new Map<string, { expires: number; data: StockData }>();
const pending = new Map<string, Promise<StockData>>();
let queue: Promise<unknown> = Promise.resolve();

function query(
  fn: string,
  symbol: string,
  key: string,
): Promise<Record<string, unknown>> {
  const task = queue
    .catch(() => {})
    .then(async () => {
      const url = new URL("https://www.alphavantage.co/query");
      url.search = new URLSearchParams({
        function: fn,
        symbol,
        apikey: key,
      }).toString();
      try {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(15000),
        });
        if (!response.ok)
          throw new Error("Market-data provider is temporarily unavailable.");
        return (await response.json()) as Record<string, unknown>;
      } finally {
        // Space calls to the shared demo API; also helps protect personal quotas.
        await new Promise((resolve) => setTimeout(resolve, 650));
      }
    });
  queue = task;
  return task;
}

export async function GET(request: Request) {
  const symbol = (new URL(request.url).searchParams.get("symbol") || "IBM")
    .trim()
    .toUpperCase();
  if (!validSymbol(symbol))
    return Response.json(
      { error: "Enter a valid stock ticker, such as IBM or AAPL." },
      { status: 400 },
    );
  const key =
    (env as { ALPHA_VANTAGE_API_KEY?: string }).ALPHA_VANTAGE_API_KEY || "demo";
  const demo = key === "demo";
  if (demo && symbol !== "IBM")
    return Response.json(
      {
        error:
          "This preview supports IBM. Configure ALPHA_VANTAGE_API_KEY on the server to research other stocks.",
        code: "API_KEY_REQUIRED",
      },
      { status: 503 },
    );
  const cacheKey = `${demo ? "demo" : "configured"}:${symbol}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return Response.json(cached.data);
  if (!pending.has(cacheKey)) {
    const task = (async (): Promise<StockData> => {
      const pricePayload = await query(
        "TIME_SERIES_WEEKLY_ADJUSTED",
        symbol,
        key,
      );
      const prices = parseWeekly(pricePayload);
      let overview = null;
      try {
        overview = parseOverview(await query("OVERVIEW", symbol, key), symbol);
      } catch {
        /* Prices remain useful if company data fails. */
      }
      let model = null;
      let modelWarning = "";
      try {
        model = forecast(prices);
      } catch {
        modelWarning =
          "The forecast could not be computed safely from this history.";
      }
      const data: StockData = {
        symbol,
        prices,
        overview,
        forecast: model,
        source: "Alpha Vantage",
        demo,
        fetchedAt: new Date().toISOString(),
        warning:
          [
            overview
              ? ""
              : "Company fundamentals are unavailable. Price history is still available.",
            modelWarning,
          ]
            .filter(Boolean)
            .join(" ") || null,
      };
      if (cache.size >= 50) cache.delete(cache.keys().next().value!);
      cache.set(cacheKey, { expires: Date.now() + 6 * 60 * 60 * 1000, data });
      return data;
    })();
    pending.set(cacheKey, task);
  }
  try {
    return Response.json(await pending.get(cacheKey));
  } catch {
    return Response.json(
      {
        error:
          "Market data could not be loaded. The provider may be unavailable or rate limited. Try again later.",
      },
      { status: 502 },
    );
  } finally {
    pending.delete(cacheKey);
  }
}
