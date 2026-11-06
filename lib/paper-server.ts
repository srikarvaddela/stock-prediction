import { database, HttpError } from "@/lib/server";
import { marketHistory } from "@/lib/data-feed";
import { validSymbol } from "@/lib/market.mjs";
import {
  INITIAL_CASH,
  positionsFromTrades,
  orderAmount,
  pendingActions,
  COST_MODEL,
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
  fee_cents: number;
  price_date: string;
  created_at: string;
};
export async function paperQuote(symbol: string) {
  symbol=symbol.replace(/^([A-Z]+)\.([AB])$/,"$1-$2");
  if (!validSymbol(symbol))
    throw new HttpError(400, "Enter a valid company ticker.");
  const snapshot = await marketHistory(symbol),
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
    costModel:COST_MODEL,
    actionsReady:!!snapshot?.actionsThrough && snapshot.actionsThrough>=point.date,
  };
}
export async function reconcilePaper(owner:string) {
  const db=database();
  // Version guards serialize accrual against concurrent orders and refreshes.
  for(let attempt=0;attempt<3;attempt++){
    const rows=await db.batch([db.prepare("SELECT * FROM paper_accounts WHERE owner_id=?").bind(owner),db.prepare("SELECT * FROM paper_trades WHERE owner_id=? ORDER BY account_version").bind(owner)]);
    const account=rows[0].results[0] as PaperAccount|undefined;
    if(!account)return;
    const trades=rows[1].results as PaperTrade[];
    const symbols=[...new Set(trades.filter(t=>t.side==="buy").map(t=>t.symbol))];
    const snapshots=[];
    for(const symbol of symbols) snapshots.push(await marketHistory(symbol));
    const pending=pendingActions(trades,snapshots);
    if(!pending.length)return;
    const operations=[];
    for(const [i,event] of pending.entries()){
      const version=account.version+i;
      operations.push(db.prepare("INSERT INTO paper_trades(id,owner_id,request_id,account_version,symbol,side,quantity_units,price_cents,amount_cents,price_date,created_at,fee_cents) SELECT ?,?,?,?,?,?,?,0,?,?,?,0 FROM paper_accounts WHERE owner_id=? AND version=? ON CONFLICT DO NOTHING").bind(crypto.randomUUID(),owner,event.request_id,version,event.symbol,event.side,event.quantity_units,event.amount_cents,event.price_date,new Date().toISOString(),owner,version));
      operations.push(db.prepare("UPDATE paper_accounts SET cash_cents=cash_cents+?,version=version+1 WHERE owner_id=? AND version=? AND EXISTS(SELECT 1 FROM paper_trades WHERE owner_id=? AND request_id=? AND account_version=?)").bind(event.amount_cents,owner,version,owner,event.request_id,version));
    }
    const result=await db.batch(operations);
    if(result[0].meta.changes===1)return;
  }
  throw new HttpError(409,"Your paper account is updating. Refresh before placing an order.");
}
export async function paperState(owner: string) {
  await reconcilePaper(owner);
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
  const positions = await Promise.all(ledger.positions.map(async (p) => {
    try {
      const q = await paperQuote(p.symbol);
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
  }));
  const cashCents = account?.cash_cents ?? INITIAL_CASH;
  const equityCents = positions.some((p) => p.valueCents === null)
    ? null
    : cashCents + positions.reduce((s, p) => s + (p.valueCents ?? 0), 0);
  let benchmark = null;
  try {
    const q = await paperQuote("SPY");
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
    dividendCents:ledger.dividendCents,
    feeCents:ledger.feeCents,
    positions,
    trades: trades.slice(-100).reverse(),
    tradeCount: trades.length,
    benchmark,
  };
}
