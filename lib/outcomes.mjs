export function marketDay(time = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(time);
}
export function fridayOfWeek(day) {
  const d = new Date(day + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 4);
  return d.toISOString().slice(0, 10);
}
export function scoreForecast(record, prices, today) {
  if (fridayOfWeek(today) <= record.target) return { status: "pending" };
  const base = prices.find((p) => p.date === record.as_of);
  const outcome = prices.find((p) => fridayOfWeek(p.date) === record.target);
  if (!base || !outcome) return { status: "pending" };
  if (marketDay(new Date(record.created_at)) >= outcome.date)
    return { status: "excluded" };
  return { status: "settled", actual: outcome.adjusted / base.adjusted - 1 };
}
