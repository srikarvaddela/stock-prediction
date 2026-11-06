export const INITIAL_CASH = 10_000_000;
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
  let realizedCents = 0;
  for (const trade of [...trades].sort(
    (a, b) => a.account_version - b.account_version,
  )) {
    const p = positions.get(trade.symbol) || {
      symbol: trade.symbol,
      units: 0,
      costCents: 0,
    };
    if (trade.side === "buy") {
      p.units += trade.quantity_units;
      p.costCents += trade.amount_cents;
    } else {
      if (trade.quantity_units > p.units)
        throw new Error("Invalid paper ledger: oversold position.");
      const cost =
        trade.quantity_units === p.units
          ? p.costCents
          : Math.round((p.costCents * trade.quantity_units) / p.units);
      p.units -= trade.quantity_units;
      p.costCents -= cost;
      realizedCents += trade.amount_cents - cost;
    }
    positions.set(trade.symbol, p);
  }
  return {
    positions: [...positions.values()].filter((p) => p.units > 0),
    realizedCents,
  };
}
