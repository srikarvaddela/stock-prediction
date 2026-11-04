import { fridayOfWeek } from "./outcomes.mjs";
const dateFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
export function weeklyHistory(payload, expectedSymbol) {
  const series = payload?.chart?.result?.[0];
  if (
    series?.meta?.symbol !== expectedSymbol ||
    series.meta.currency !== "USD" ||
    series.meta.instrumentType !== "EQUITY"
  )
    throw new Error("No matching USD equity history.");
  const quote = series.indicators?.quote?.[0],
    adjusted = series.indicators?.adjclose?.[0]?.adjclose;
  const weeks = new Map();
  for (const [index, timestamp] of (series.timestamp ?? []).entries()) {
    const close = quote?.close?.[index],
      adj = adjusted?.[index],
      volume = quote?.volume?.[index];
    if (
      !Number.isFinite(timestamp) ||
      !Number.isFinite(close) ||
      close <= 0 ||
      !Number.isFinite(adj) ||
      adj <= 0 ||
      !Number.isFinite(volume) ||
      volume < 0
    )
      continue;
    const day = dateFormat.format(new Date(timestamp * 1000)),
      week = fridayOfWeek(day),
      previous = weeks.get(week);
    weeks.set(week, {
      date: day,
      close,
      adjusted: adj,
      volume: volume + (previous?.volume ?? 0),
    });
  }
  const prices = [...weeks.values()]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-520);
  if (prices.length < 2) throw new Error("Insufficient price history.");
  return {
    prices,
    name: series.meta.longName || series.meta.shortName || expectedSymbol,
    exchange: series.meta.fullExchangeName || series.meta.exchangeName || "",
  };
}
