import { database, HttpError } from "@/lib/server";
import { weeklyHistory } from "@/lib/public-history.mjs";
import { parseOverview } from "@/lib/market.mjs";
import { marketHistory } from "@/lib/data-feed";
export async function publicPrices(owner: string, symbol: string) {
  const canonical = symbol.replace(/^([A-Z]+)\.([AB])$/, "$1-$2");
  const id = owner + ":public-weekly-v2:" + canonical;
  const db = database();
  const cached = await db
    .prepare("SELECT body,expires_at FROM market_cache WHERE id=?")
    .bind(id)
    .first<{ body: string; expires_at: number }>();
  const previous = cached
    ? (JSON.parse(cached.body) as ReturnType<typeof normalize>)
    : null;
  if (cached && previous && cached.expires_at > Date.now()) return previous;
  function normalize(
    { prices, name, exchange }: ReturnType<typeof weeklyHistory>,
    snapshot = false,
    fetchedAt = new Date().toISOString(),
  ) {
    return {
      prices,
      snapshot,
      fetchedAt,
      overview: parseOverview(
        { Symbol: symbol, Name: name, Exchange: exchange, Currency: "USD" },
        symbol,
      ),
    };
  }
  const url = new URL(
    "https://query1.finance.yahoo.com/v8/finance/chart/" +
      encodeURIComponent(canonical),
  );
  url.search = new URLSearchParams({
    range: "10y",
    interval: "1d",
    includeAdjustedClose: "true",
  }).toString();
  let result;
  const saved = await marketHistory(canonical);
  if (saved && Date.now()-Date.parse(saved.fetchedAt)<24*3600000) {
    return normalize(saved, true, saved.fetchedAt);
  }
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (response.status === 404)
      throw new HttpError(
        404,
        "No US stock history was found for " + symbol + ". Check the ticker.",
      );
    if (!response.ok)
      throw new HttpError(
        response.status === 429 ? 429 : 502,
        "The public price feed is temporarily unavailable for " +
          symbol +
          ". Try again later.",
      );
    try {
      result = normalize(weeklyHistory(await response.json(), canonical));
    } catch {
      throw new HttpError(
        422,
        "This ticker does not have usable USD equity history on the public feed.",
      );
    }
  } catch (e) {
    if (
      previous &&
      (!saved || previous.prices.at(-1)!.date >= saved.prices.at(-1)!.date)
    )
      result = { ...previous, snapshot: true };
    else if (saved) result = normalize(saved, true, saved.fetchedAt);
    else if (e instanceof HttpError && (e.status === 429 || e.status === 502))
      throw new HttpError(e.status, "No price history is currently available for " + symbol + ". The daily data job retries available listings; you can also connect Alpha Vantage in Settings.");
    else if (e instanceof HttpError) throw e;
    else throw new HttpError(502, "The public price feed did not respond.");
  }
  await db
    .prepare(
      "INSERT INTO market_cache(id,owner_id,body,expires_at) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body,expires_at=excluded.expires_at",
    )
    .bind(
      id,
      owner,
      JSON.stringify(result),
      Date.now() + (result.snapshot ? 15 * 60000 : 6 * 3600000),
    )
    .run();
  return result;
}
