import {
  database,
  identity,
  jsonBody,
  failure,
  privateJson,
  HttpError,
} from "@/lib/server";
import { validSymbol } from "@/lib/market.mjs";
import { stockSymbol } from "@/lib/company-search.mjs";
type Holding = {
  id: string;
  symbol: string;
  quantity: number;
  cost_basis: number;
};
export async function GET() {
  try {
    const owner = await identity();
    const rows = await database()
      .prepare(
        "SELECT id,symbol,quantity,cost_basis FROM holdings WHERE owner_id=? ORDER BY symbol,created_at",
      )
      .bind(owner)
      .all<Holding>();
    return privateJson({
      holdings: rows.results.map((row) => ({
        ...row,
        symbol: stockSymbol(row.symbol) || row.symbol,
      })),
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    const owner = await identity(request),
      body = await jsonBody(request),
      db = database(),
      id = String(body.id || "");
    if (body.action === "remove") {
      const result = await db
        .prepare("DELETE FROM holdings WHERE owner_id=? AND id=?")
        .bind(owner, id)
        .run();
      if (!result.meta.changes)
        throw new HttpError(404, "Holding was not found.");
      return privateJson({ saved: true });
    }
    const symbol = stockSymbol(body.symbol),
      quantity = body.quantity,
      cost = body.costBasis;
    if (
      !validSymbol(symbol) ||
      typeof quantity !== "number" ||
      !Number.isFinite(quantity) ||
      quantity <= 0 ||
      quantity > 1e10 ||
      typeof cost !== "number" ||
      !Number.isFinite(cost) ||
      cost < 0 ||
      cost > 1e8
    )
      throw new HttpError(
        400,
        "Enter a valid ticker, positive share count, and nonnegative USD cost per share.",
      );
    if (body.action === "edit") {
      const result = await db
        .prepare(
          "UPDATE holdings SET symbol=?,quantity=?,cost_basis=? WHERE owner_id=? AND id=?",
        )
        .bind(symbol, quantity, cost, owner, id)
        .run();
      if (!result.meta.changes)
        throw new HttpError(404, "Holding was not found.");
    } else if (body.action === "add") {
      if (!/^[a-f0-9-]{36}$/i.test(id))
        throw new HttpError(400, "Missing holding identifier.");
      const result = await db
        .prepare(
          "INSERT INTO holdings(id,owner_id,symbol,quantity,cost_basis,created_at) SELECT ?,?,?,?,?,? WHERE (SELECT count(*) FROM holdings WHERE owner_id=?)<30 ON CONFLICT(id) DO NOTHING",
        )
        .bind(
          id,
          owner,
          symbol,
          quantity,
          cost,
          new Date().toISOString(),
          owner,
        )
        .run();
      if (
        !result.meta.changes &&
        !(await db
          .prepare("SELECT id FROM holdings WHERE id=? AND owner_id=?")
          .bind(id, owner)
          .first())
      )
        throw new HttpError(409, "Portfolio limit reached (30 lots).");
    } else throw new HttpError(400, "Unknown holding action.");
    return privateJson({ saved: true });
  } catch (e) {
    return failure(e);
  }
}
