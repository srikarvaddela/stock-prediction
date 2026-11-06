import { completeWeeks } from "./forecast.mjs";
export function screenMetrics(points, now = new Date()) {
  const p = completeWeeks(points, now);
  const last = p.at(-1);
  const valid = p.every(
    (r, i) =>
      Number.isFinite(r.adjusted) &&
      r.adjusted > 0 &&
      (!i || (Date.parse(r.date) - Date.parse(p[i - 1].date)) / 86400000 <= 10),
  );
  if (!last || !valid)
    return { indicatorDate: null, return4w: null, volatility: null };
  const return4w = p.length >= 5 ? last.adjusted / p.at(-5).adjusted - 1 : null;
  let volatility = null;
  if (p.length >= 53) {
    const recent = p.slice(-53);
    const r = recent
      .slice(1)
      .map((v, i) => Math.log(v.adjusted / recent[i].adjusted));
    const mean = r.reduce((a, b) => a + b, 0) / r.length;
    volatility =
      Math.sqrt(r.reduce((s, v) => s + (v - mean) ** 2, 0) / (r.length - 1)) *
      Math.sqrt(52);
  }
  return { indicatorDate: last.date, return4w, volatility };
}
export function filterStocks(rows, filters) {
  const query = (filters.query || "").trim().toLowerCase();
  const has = (value) => value !== "" && value !== undefined && value !== null;
  return rows.filter((r) => {
    if (query && !`${r.symbol} ${r.name}`.toLowerCase().includes(query))
      return false;
    if (filters.sector && r.sector !== filters.sector) return false;
    if (
      has(filters.minPrice) &&
      (r.price === null || r.price < Number(filters.minPrice))
    )
      return false;
    if (
      has(filters.maxPrice) &&
      (r.price === null || r.price > Number(filters.maxPrice))
    )
      return false;
    if (
      has(filters.minReturn) &&
      (r.return4w === null || r.return4w * 100 < Number(filters.minReturn))
    )
      return false;
    if (
      has(filters.maxVolatility) &&
      (r.volatility === null ||
        r.volatility * 100 > Number(filters.maxVolatility))
    )
      return false;
    if (
      has(filters.maxPe) &&
      (r.pe === null || r.pe <= 0 || r.pe > Number(filters.maxPe))
    )
      return false;
    if (
      has(filters.minGrowth) &&
      (r.revenueGrowth === null ||
        r.revenueGrowth * 100 < Number(filters.minGrowth))
    )
      return false;
    if (filters.beatsBaseline && !r.pythonBeatsBaseline) return false;
    return true;
  });
}
export function sortStocks(rows, key = "symbol", direction = "asc") {
  return [...rows].sort((a, b) => {
    const x = a[key],
      y = b[key];
    if (x == null) return y == null ? 0 : 1;
    if (y == null) return -1;
    const order = typeof x === "string" ? x.localeCompare(y) : x - y;
    return (
      order * (direction === "desc" ? -1 : 1) ||
      a.symbol.localeCompare(b.symbol)
    );
  });
}
