import { identity, failure, privateJson, HttpError } from "@/lib/server";
import { validSymbol } from "@/lib/market.mjs";
import { credentials, providerQuery } from "@/lib/provider";
import { articles, earnings, calendar } from "@/lib/research.mjs";
export async function GET(request: Request) {
  try {
    const owner = await identity(),
      q = new URL(request.url).searchParams,
      symbol = (q.get("symbol") || "").toUpperCase(),
      kind = q.get("kind");
    if (
      !validSymbol(symbol) ||
      !["news", "earnings", "calendar"].includes(kind || "")
    )
      throw new HttpError(400, "Choose a valid ticker and research dataset.");
    const creds = await credentials(owner);
    if (creds.demo && (symbol !== "IBM" || kind !== "earnings"))
      throw new HttpError(
        503,
        "Connect your market-data key in Settings to load this dataset.",
      );
    const fn =
      kind === "news"
        ? "NEWS_SENTIMENT"
        : kind === "earnings"
          ? "EARNINGS"
          : "EARNINGS_CALENDAR";
    const params: Record<string, string> =
      kind === "news"
        ? { tickers: symbol, sort: "LATEST", limit: "10" }
        : kind === "calendar"
          ? { symbol, horizon: "3month" }
          : { symbol };
    const payload = await providerQuery(
      owner,
      creds,
      fn,
      params,
      kind === "news" ? 3600000 : 86400000,
    );
    try {
      return privateJson({
        symbol,
        kind,
        source: "Alpha Vantage",
        items:
          kind === "news"
            ? articles(payload, symbol)
            : kind === "earnings"
              ? earnings(payload, symbol)
              : calendar(payload.csv, symbol),
      });
    } catch {
      throw new HttpError(
        502,
        "The provider returned an incomplete dataset. Try again later.",
      );
    }
  } catch (e) {
    return failure(e);
  }
}
