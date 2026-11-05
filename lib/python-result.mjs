export function publishedForecast(report, symbol, horizon, now = new Date()) {
  if (
    !report ||
    report.symbol !== symbol ||
    report.horizon !== horizon ||
    report.modelVersion !== "python-research-1.0.0"
  )
    return null;
  const today = now.toISOString().slice(0, 10);
  if (
    report.asOf > today ||
    !/^[a-f0-9]{64}$/.test(report.dataset?.sha256 || "") ||
    !Array.isArray(report.backtest) ||
    report.backtest.length !== 52
  )
    return null;
  if (
    ["estimate", "low", "high", "mae", "baselineMae", "expectedReturn"].some(
      (k) => !Number.isFinite(report[k]),
    )
  )
    return null;
  const monday = new Date(today + "T12:00:00Z");
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7) - 7);
  const outdated = report.asOf < monday.toISOString().slice(0, 10);
  return { ...report, stale: report.targetWeekEnding < today, outdated };
}
