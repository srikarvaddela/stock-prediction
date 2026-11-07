import { identity, failure, privateJson, HttpError } from "@/lib/server";
import { validSymbol } from "@/lib/market.mjs";
import { credentials, providerQuery } from "@/lib/provider";
import { articles, earnings, calendar, financialSummary } from "@/lib/research.mjs";
import { publicNews } from "@/lib/public-news";
export async function GET(request: Request) {
  try {
    const owner = await identity(),
      q = new URL(request.url).searchParams,
      symbol = (q.get("symbol") || "").toUpperCase(),
      kind = q.get("kind");
    if (
      !validSymbol(symbol) ||
      !["news", "earnings", "calendar", "financials"].includes(kind || "")
    )
      throw new HttpError(400, "Choose a valid ticker and research dataset.");
    const creds = await credentials(owner);
    if(kind==="news" && creds.demo)return privateJson(await publicNews(symbol));
    if (creds.demo && (symbol !== "IBM" || !["earnings","financials"].includes(kind || "")))
      throw new HttpError(
        503,
        "Connect your market-data key in Settings to load this dataset.",
      );
    if(kind==="financials"){
      const statements=await Promise.allSettled(["INCOME_STATEMENT","BALANCE_SHEET","CASH_FLOW"].map(fn=>providerQuery(owner,creds,fn,{symbol},86400000)));
      if(statements[0].status==="rejected")throw statements[0].reason;
      try{return privateJson({symbol,kind,source:"Alpha Vantage · quarterly company reports",fetchedAt:new Date().toISOString(),financials:financialSummary(statements[0].value,statements[1].status==="fulfilled"?statements[1].value:null,statements[2].status==="fulfilled"?statements[2].value:null,symbol)});}catch{throw new HttpError(502,"The provider did not return usable matching financial statements.");}
    }
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
        fetchedAt:new Date().toISOString(),
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
