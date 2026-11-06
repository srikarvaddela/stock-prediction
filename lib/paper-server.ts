import { database, HttpError } from "@/lib/server";
import { savedHistory } from "@/lib/price-snapshots";
import catalog from "@/lib/stock-picker.json";
import {
  INITIAL_CASH,
  positionsFromTrades,
  orderAmount,
} from "@/lib/paper.mjs";
export type PaperAccount = {
  owner_id: string;
  cash_cents: number;
  version: number;
  benchmark_adjusted: number;
  benchmark_date: string;
  created_at: string;
};
export type PaperTrade = {
  id: string;
  owner_id: string;
  request_id: string;
  account_version: number;
  symbol: string;
  side: string;
  quantity_units: number;
  price_cents: number;
  amount_cents: number;
  price_date: string;
  created_at: string;
};
export function paperQuote(symbol: string) {
  if (!(symbol in catalog) && symbol !== "SPY")
    throw new HttpError(400, "Choose a featured company.");
  const snapshot = savedHistory(symbol),
    point = snapshot?.prices.at(-1);
  if (!point)
    throw new HttpError(503, "No saved price is available for this company.");
  const priceCents = Math.round(point.close * 100);
  const ageDays =
    (Date.now() - Date.parse(point.date + "T00:00:00Z")) / 86400000;
  return {
    symbol,
    priceCents,
    adjusted: point.adjusted,
    date: point.date,
    stale: ageDays > 7 || ageDays < 0,
    source: "Yahoo Finance · saved closing price",
  };
}
export async function paperState(owner: string) {
  const db = database();
  const rows = await db.batch([
    db.prepare("SELECT * FROM paper_accounts WHERE owner_id=?").bind(owner),
    db
      .prepare(
        "SELECT * FROM paper_trades WHERE owner_id=? ORDER BY account_version",
      )
      .bind(owner),
  ]);
  const account = (rows[0].results[0] as PaperAccount | undefined) ?? null;
  const trades = rows[1].results as PaperTrade[];
  const ledger = positionsFromTrades(trades);
  const positions = ledger.positions.map((p) => {
    try {
      const q = paperQuote(p.symbol);
      const valueCents = orderAmount(p.units, q.priceCents, true);
      return {
        ...p,
        quantity: p.units / 1e6,
        valueCents,
        unrealizedCents: valueCents - p.costCents,
        quote: q,
      };
    } catch {
      return {
        ...p,
        quantity: p.units / 1e6,
        valueCents: null,
        unrealizedCents: null,
        quote: null,
      };
    }
  });
  const cashCents = account?.cash_cents ?? INITIAL_CASH;
  const equityCents = positions.some((p) => p.valueCents === null)
    ? null
    : cashCents + positions.reduce((s, p) => s + (p.valueCents ?? 0), 0);
  let benchmark = null;
  try {
    const q = paperQuote("SPY");
    if (account && q.date >= account.benchmark_date)
      benchmark = {
        symbol: "SPY",
        from: account.benchmark_date,
        through: q.date,
        return: q.adjusted / account.benchmark_adjusted - 1,
        stale: q.stale,
      };
  } catch {}
  return {
    cashCents,
    initialCashCents: INITIAL_CASH,
    version: account?.version ?? 0,
    equityCents,
    totalReturn: equityCents === null ? null : equityCents / INITIAL_CASH - 1,
    realizedCents: ledger.realizedCents,
    positions,
    trades: trades.slice(-100).reverse(),
    tradeCount: trades.length,
    benchmark,
  };
}
