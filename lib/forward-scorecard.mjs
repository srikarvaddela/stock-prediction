import { evaluatePredictions } from "./evaluation.mjs";

const day = value => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
export function validRegistry(value, symbol, horizon) {
  return !!value && value.symbol === symbol && value.horizon === horizon && Array.isArray(value.records) && value.records.length <= 104;
}

// Never mix a historical backtest into the forward record. Reject unverifiable
// issuance/outcome dates and duplicate origins instead of inflating the sample.
export function forwardScorecard(records, horizon = 1, now = new Date()) {
  const today = now.toISOString().slice(0,10);
  const monday = new Date(today);
  monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
  const weekStart = monday.toISOString().slice(0,10);
  const seen = new Set(), accepted = [];
  let excluded = 0;
  for (const r of records) {
    const created = typeof r?.createdAt === "string" ? r.createdAt.slice(0,10) : "";
    if (!r || !day(r.asOf) || !day(r.target) || !day(created) || !Number.isFinite(Date.parse(r.createdAt)) ||
        Date.parse(r.createdAt) > now.getTime() || r.asOf > created || created >= r.target ||
        !Number.isFinite(r.predictedReturn) || seen.has(r.asOf)) { excluded++; continue; }
    const distance = (Date.parse(r.target) - Date.parse(r.asOf)) / 86400000;
    // Holiday weeks may end before Friday, but a 1w record cannot represent 4w.
    if (distance < horizon * 7 || distance > horizon * 7 + 4) { excluded++; continue; }
    if (r.actualReturn !== null && (!Number.isFinite(r.actualReturn) || !day(r.observedDate) || !day(r.settledAt) ||
        r.target >= weekStart || r.observedDate > r.target || r.observedDate < new Date(Date.parse(r.target) - 4 * 86400000).toISOString().slice(0,10) ||
        created >= r.observedDate || r.settledAt <= r.target || r.settledAt > today)) { excluded++; continue; }
    seen.add(r.asOf);
    accepted.push({asOf:r.asOf, target:r.target, createdAt:r.createdAt, predictedReturn:r.predictedReturn,
      actualReturn:r.actualReturn, observedDate:r.observedDate ?? null, settledAt:r.settledAt ?? null,
      modelId:typeof r.modelId === "string" ? r.modelId : "Unknown",
      status:r.actualReturn !== null ? "settled" : r.target < weekStart ? "overdue" : "pending"});
  }
  accepted.sort((a,b)=>a.asOf.localeCompare(b.asOf));
  const settled = accepted.filter(r=>r.status === "settled");
  return {
    evaluatedAt:now.toISOString(), horizon, excluded, total:accepted.length,
    pending:accepted.filter(r=>r.status === "pending").length,
    overdue:accepted.filter(r=>r.status === "overdue").length,
    firstSavedAt:accepted[0]?.createdAt ?? null,
    lastSavedAt:accepted.at(-1)?.createdAt ?? null,
    evaluation:evaluatePredictions(settled,horizon),
    wins:settled.filter(r=>Math.abs(r.predictedReturn-r.actualReturn) < Math.abs(r.actualReturn)).length,
    ties:settled.filter(r=>Math.abs(r.predictedReturn-r.actualReturn) === Math.abs(r.actualReturn)).length,
    records:accepted,
  };
}
