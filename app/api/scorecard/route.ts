import { identity, privateJson, failure, HttpError } from "@/lib/server";
import { stockSymbol } from "@/lib/company-search.mjs";
import { feedFile } from "@/lib/data-feed";
import { validRegistry, forwardScorecard } from "@/lib/forward-scorecard.mjs";

export async function GET(request: Request) {
  try {
    await identity();
    const params = new URL(request.url).searchParams;
    const symbol = stockSymbol(params.get("symbol") || "");
    const horizon = Number(params.get("horizon") || 1);
    if (!symbol || ![1,4].includes(horizon)) throw new HttpError(400,"Choose a valid ticker and a one- or four-week horizon.");
    const registry = await feedFile<{records:unknown[]}>(`records/${symbol}-${horizon}.json`, d=>validRegistry(d,symbol,horizon));
    if (!registry) throw new HttpError(404,"No forward record is available for this stock and horizon. The feed may be unavailable, or the model may not have enough history yet.");
    return privateJson({symbol, ...forwardScorecard(registry.records,horizon)});
  } catch (e) { return failure(e); }
}
