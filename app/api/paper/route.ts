import {
  identity,
  privateJson,
  failure,
  jsonBody,
  database,
  HttpError,
} from "@/lib/server";
import { stockSymbol } from "@/lib/company-search.mjs";
import {
  paperQuote,
  paperState,
  type PaperAccount,
  type PaperTrade,
} from "@/lib/paper-server";
import { quantityUnits, orderAmount, INITIAL_CASH } from "@/lib/paper.mjs";
export async function GET() {
  try {
    return privateJson(await paperState(await identity()));
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    const owner = await identity(request),
      body = await jsonBody(request),
      db = database();
    const symbol = stockSymbol(
      typeof body.symbol === "string" ? body.symbol : "",
    );
    if (
      typeof body.requestId !== "string" ||
      !/^[a-f0-9-]{36}$/i.test(body.requestId) ||
      !["buy", "sell"].includes(String(body.side))
    )
      throw new HttpError(400, "Invalid paper order.");
    if (typeof body.quantity !== "string" && typeof body.quantity !== "number")
      throw new HttpError(400, "Enter a share quantity.");
    let units;
    try {
      units = quantityUnits(body.quantity);
    } catch (e) {
      throw new HttpError(400, (e as Error).message);
    }
    const side = String(body.side),
      requestId = body.requestId;
    const existing = await db
      .prepare("SELECT * FROM paper_trades WHERE owner_id=? AND request_id=?")
      .bind(owner, requestId)
      .first<PaperTrade>();
    if (existing) {
      if (
        existing.symbol !== symbol ||
        existing.side !== side ||
        existing.quantity_units !== units
      )
        throw new HttpError(
          409,
          "This order ID was already used for a different order.",
        );
      return privateJson({
        message: "Order already recorded.",
        state: await paperState(owner),
      });
    }
    const quote = paperQuote(symbol);
    if (symbol === "SPY")
      throw new HttpError(
        400,
        "SPY is the comparison benchmark. Choose a featured company to trade.",
      );
    if (quote.stale)
      throw new HttpError(
        409,
        "The saved quote is more than seven days old. Trading is paused until price data is updated.",
      );
    if (body.priceDate !== quote.date || body.priceCents !== quote.priceCents)
      throw new HttpError(
        409,
        "The quote changed. Review the latest quote before confirming.",
      );
    let amount;
    try {
      amount = orderAmount(units, quote.priceCents);
    } catch (e) {
      throw new HttpError(400, (e as Error).message);
    }
    const benchmark = paperQuote("SPY");
    if (benchmark.stale)
      throw new HttpError(
        409,
        "Benchmark data needs an update before trading.",
      );
    await db
      .prepare(
        "INSERT OR IGNORE INTO paper_accounts(owner_id,cash_cents,version,benchmark_adjusted,benchmark_date,created_at) VALUES(?,?,0,?,?,?)",
      )
      .bind(
        owner,
        INITIAL_CASH,
        benchmark.adjusted,
        benchmark.date,
        new Date().toISOString(),
      )
      .run();
    const account = await db
      .prepare("SELECT * FROM paper_accounts WHERE owner_id=?")
      .bind(owner)
      .first<PaperAccount>();
    if (!account || body.version !== account.version)
      throw new HttpError(
        409,
        "Your paper account changed. Refresh and review the order.",
      );
    const delta = side === "buy" ? -amount : amount;
    if (!Number.isSafeInteger(account.cash_cents + delta))
      throw new HttpError(400, "This order exceeds the account limit.");
    // The insert and balance update share a D1 transaction. Version guards serialize
    // competing orders; the unique request key makes network retries idempotent.
    const result = await db.batch([
      db
        .prepare(
          `INSERT INTO paper_trades(id,owner_id,request_id,account_version,symbol,side,quantity_units,price_cents,amount_cents,price_date,created_at)
        SELECT ?,?,?,?,?,?,?,?,?,?,? FROM paper_accounts a WHERE a.owner_id=? AND a.version=?
        AND (?='sell' OR a.cash_cents>=?)
        AND (?='buy' OR COALESCE((SELECT SUM(CASE WHEN side='buy' THEN quantity_units ELSE -quantity_units END) FROM paper_trades WHERE owner_id=? AND symbol=?),0)>=?)
        ON CONFLICT DO NOTHING`,
        )
        .bind(
          crypto.randomUUID(),
          owner,
          requestId,
          account.version,
          symbol,
          side,
          units,
          quote.priceCents,
          amount,
          quote.date,
          new Date().toISOString(),
          owner,
          account.version,
          side,
          amount,
          side,
          owner,
          symbol,
          units,
        ),
      db
        .prepare(
          "UPDATE paper_accounts SET cash_cents=cash_cents+?,version=version+1 WHERE owner_id=? AND version=? AND EXISTS(SELECT 1 FROM paper_trades WHERE owner_id=? AND request_id=? AND account_version=?)",
        )
        .bind(delta, owner, account.version, owner, requestId, account.version),
    ]);
    if (result[0].meta.changes !== 1) {
      const recorded = await db
        .prepare("SELECT * FROM paper_trades WHERE owner_id=? AND request_id=?")
        .bind(owner, requestId)
        .first<PaperTrade>();
      if (!recorded)
        throw new HttpError(
          409,
          "Order not filled. Check available cash/shares and refresh the account.",
        );
      if (
        recorded.symbol !== symbol ||
        recorded.side !== side ||
        recorded.quantity_units !== units
      )
        throw new HttpError(
          409,
          "This order ID was already used for a different order.",
        );
    }
    return privateJson({
      message: "Simulated order filled at the displayed recorded close.",
      state: await paperState(owner),
    });
  } catch (e) {
    return failure(e);
  }
}
