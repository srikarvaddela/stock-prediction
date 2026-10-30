import {
  database,
  identity,
  jsonBody,
  failure,
  privateJson,
  HttpError,
} from "@/lib/server";
import { validSymbol } from "@/lib/market.mjs";
export async function GET() {
  try {
    const owner = await identity();
    const row = await database()
      .prepare("SELECT watchlist FROM preferences WHERE user_id=?")
      .bind(owner)
      .first<{ watchlist: string }>();
    return privateJson({ watchlist: row ? JSON.parse(row.watchlist) : null });
  } catch (e) {
    return failure(e);
  }
}
export async function PUT(request: Request) {
  try {
    const owner = await identity(request),
      body = await jsonBody(request);
    if (
      !Array.isArray(body.watchlist) ||
      body.watchlist.length > 30 ||
      body.watchlist.some((v) => !validSymbol(v))
    )
      throw new HttpError(
        400,
        "Watchlists can contain up to 30 valid tickers.",
      );
    const watchlist = [...new Set(body.watchlist)];
    await database()
      .prepare(
        "INSERT INTO preferences(user_id,watchlist,updated_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET watchlist=excluded.watchlist,updated_at=excluded.updated_at",
      )
      .bind(owner, JSON.stringify(watchlist), new Date().toISOString())
      .run();
    return privateJson({ watchlist });
  } catch (e) {
    return failure(e);
  }
}
