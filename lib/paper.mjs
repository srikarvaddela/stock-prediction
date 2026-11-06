export const INITIAL_CASH = 10_000_000;
export const COST_MODEL = "paper-costs-v2";
export function executionTerms(units, closeCents, side) {
  if(!["buy","sell"].includes(side))throw Error("Invalid order side.");
  const feeCents=100, slippageBps=5;
  const fillCents=Math.max(1,Math.round(closeCents*(1+(side==="buy"?1:-1)*slippageBps/10000)));
  const grossCents=orderAmount(units,fillCents);
  if(side==="sell" && grossCents<=feeCents)throw Error("Sale proceeds must exceed the $1 simulated fee.");
  return {fillCents,grossCents,feeCents,slippageBps,cashCents:side==="buy"?grossCents+feeCents:grossCents-feeCents,costModel:COST_MODEL};
}
export function quantityUnits(value) {
  const text = String(value);
  if (!/^\d{1,7}(\.\d{1,6})?$/.test(text))
    throw new Error(
      "Use a positive share quantity with up to six decimal places.",
    );
  const [whole, decimals = ""] = text.split(".");
  const units = Number(whole) * 1_000_000 + Number(decimals.padEnd(6, "0"));
  if (!Number.isSafeInteger(units) || units <= 0 || units > 1_000_000_000_000)
    throw new Error("Share quantity is outside the supported range.");
  return units;
}
export function orderAmount(units, priceCents, allowZero = false) {
  if (![units, priceCents].every((v) => Number.isSafeInteger(v) && v > 0))
    throw new Error("Invalid order quantity or price.");
  const amount = Number(
    (BigInt(units) * BigInt(priceCents) + 500_000n) / 1_000_000n,
  );
  if (!Number.isSafeInteger(amount) || (!allowZero && amount < 1))
    throw new Error(
      "Order value must be at least one cent and within the supported range.",
    );
  return amount;
}
export function positionsFromTrades(trades) {
  const positions = new Map();
  let realizedCents = 0, dividendCents=0, feeCents=0;
  for (const trade of [...trades].sort(
    (a, b) => a.account_version - b.account_version,
  )) {
    const p = positions.get(trade.symbol) || {
      symbol: trade.symbol,
      units: 0,
      costCents: 0,
    };
    feeCents+=trade.fee_cents||0;
    if(trade.side==="split") {
      p.units+=trade.quantity_units;
      if(p.units<0)throw Error("Invalid split adjustment.");
    } else if(trade.side==="dividend") {
      dividendCents+=trade.amount_cents;
    } else if (trade.side === "buy") {
      p.units += trade.quantity_units;
      p.costCents += trade.amount_cents+(trade.fee_cents||0);
    } else {
      if (trade.quantity_units > p.units)
        throw new Error("Invalid paper ledger: oversold position.");
      const cost =
        trade.quantity_units === p.units
          ? p.costCents
          : Math.round((p.costCents * trade.quantity_units) / p.units);
      p.units -= trade.quantity_units;
      p.costCents -= cost;
      realizedCents += trade.amount_cents - (trade.fee_cents||0) - cost;
    }
    positions.set(trade.symbol, p);
  }
  return {
    positions: [...positions.values()].filter((p) => p.units > 0),
    realizedCents,
    dividendCents,feeCents,
  };
}

export function pendingActions(trades, snapshots) {
  const applied=new Set(trades.map(t=>t.request_id));
  const planned=[];
  for(const snapshot of snapshots) {
    if(!snapshot?.actions || !snapshot.actionsThrough)continue;
    const symbol=snapshot.symbol;
    for(const action of [...snapshot.actions].sort((a,b)=>a.date.localeCompare(b.date) || (a.type==="split"?-1:1))) {
      const key=`action:${symbol}:${action.type}:${action.date}`;
      if(applied.has(key) || action.date>snapshot.actionsThrough)continue;
      const relevant=[...trades,...planned].filter(t=>t.symbol===symbol && (t.price_date<action.date || (t.price_date===action.date && t.side==="split" && action.type==="dividend")));
      const units=relevant.reduce((s,t)=>s+(t.side==="buy"||t.side==="split"?t.quantity_units:t.side==="sell"?-t.quantity_units:0),0);
      if(units<=0)continue;
      if(action.type==="split" && Number.isFinite(action.ratio)&&action.ratio>0){
        const delta=Math.round(units*action.ratio)-units;
        if(!Number.isSafeInteger(delta))throw Error("Split is outside supported account precision.");
        planned.push({request_id:key,symbol,side:"split",quantity_units:delta,amount_cents:0,price_date:action.date});
      } else if(action.type==="dividend" && Number.isFinite(action.amount)&&action.amount>0) {
        // Round the total distribution once, retaining sub-cent per-share dividends.
        const amount=Math.round(units/1e6*action.amount*100);
        if(!Number.isSafeInteger(amount))throw Error("Dividend is outside supported account precision.");
        planned.push({request_id:key,symbol,side:"dividend",quantity_units:0,amount_cents:amount,price_date:action.date});
      }
    }
  }
  return planned.sort((a,b)=>a.price_date.localeCompare(b.price_date) || (a.side===b.side?0:a.side==="split"?-1:1));
}
