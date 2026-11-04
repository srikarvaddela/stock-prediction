export function portfolioReport(holdings, stocks) {
  const rows = holdings.map((h) => {
    const stock = stocks[h.symbol],
      quote = stock?.prices.at(-1),
      currency = stock?.overview?.currency;
    const value = quote && currency === "USD" ? h.quantity * quote.close : null;
    return {
      ...h,
      asOf: quote?.date ?? null,
      value,
      sector: stock?.overview?.sector || "Unknown",
      cost: h.quantity * h.cost_basis,
      reason:
        value === null
          ? currency && currency !== "USD"
            ? "Currency " + currency + " is outside this USD report."
            : "USD price and currency metadata are required."
          : null,
    };
  });
  const priced = rows.filter((r) => r.value !== null),
    value = priced.reduce((sum, r) => sum + r.value, 0),
    cost = priced.reduce((sum, r) => sum + r.cost, 0);
  const weights = new Map(),
    sectors = new Map();
  for (const r of priced) {
    const weight = r.value / value;
    weights.set(r.symbol, (weights.get(r.symbol) || 0) + weight);
    sectors.set(r.sector, (sectors.get(r.sector) || 0) + weight);
  }
  // Use adjusted closes on shared dates, with current weights rebalanced each week.
  const symbols = [...weights.keys()],
    series = symbols.map(
      (s) => new Map(stocks[s].prices.map((p) => [p.date, p.adjusted])),
    );
  const dates = series.length
    ? [...series[0].keys()]
        .filter((d) => series.every((m) => m.has(d)))
        .sort()
        .slice(-53)
    : [];
  let risk = null;
  if (
    dates.length >= 27 &&
    dates
      .slice(1)
      .every((d, i) => Date.parse(d) - Date.parse(dates[i]) <= 10 * 86400000)
  ) {
    const returns = dates
      .slice(1)
      .map((d, i) =>
        symbols.reduce(
          (sum, s, j) =>
            sum +
            weights.get(s) * (series[j].get(d) / series[j].get(dates[i]) - 1),
          0,
        ),
      );
    const average = returns.reduce((s, r) => s + r, 0) / returns.length;
    let wealth = 1,
      peak = 1,
      drawdown = 0;
    for (const r of returns) {
      wealth *= 1 + r;
      peak = Math.max(peak, wealth);
      drawdown = Math.min(drawdown, wealth / peak - 1);
    }
    risk = {
      weeks: returns.length,
      from: dates[0],
      to: dates.at(-1),
      totalReturn: wealth - 1,
      drawdown,
      volatility: Math.sqrt(
        (52 * returns.reduce((s, r) => s + (r - average) ** 2, 0)) /
          (returns.length - 1),
      ),
    };
  }
  return {
    rows,
    pricedCount: priced.length,
    value,
    cost,
    pnl: value - cost,
    sectors: Object.fromEntries(sectors),
    largestWeight: weights.size ? Math.max(...weights.values()) : null,
    risk,
  };
}
