import {
  database,
  identity,
  jsonBody,
  privateJson,
  failure,
  HttpError,
} from "@/lib/server";
import { loadStock } from "@/lib/stocks";
import { marketDay, scoreForecast } from "@/lib/outcomes.mjs";
import type { Forecast } from "@/lib/stock-types";
type Row = {
  id: string;
  symbol: string;
  horizon: number;
  as_of: string;
  target: string;
  created_at: string;
  forecast_json: string;
  settled_at: string | null;
  actual_return: number | null;
};
export async function GET() {
  try {
    const owner = await identity();
    const { results } = await database()
      .prepare(
        "SELECT id,symbol,horizon,as_of,target,created_at,forecast_json,actual_return,settled_at FROM forecast_records WHERE owner_id=? ORDER BY created_at DESC LIMIT 200",
      )
      .bind(owner)
      .all<Row>();
    return privateJson({
      records: results.map((r) => {
        const f = JSON.parse(r.forecast_json) as Forecast;
        return {
          id: r.id,
          symbol: r.symbol,
          horizon: r.horizon,
          asOf: r.as_of,
          target: r.target,
          issued: r.created_at,
          model: f.model,
          version: f.modelVersion,
          predicted: f.expectedReturn,
          estimate: f.estimate,
          actual: r.actual_return,
          status: r.settled_at
            ? r.actual_return === null
              ? "Excluded"
              : "Scored"
            : "Pending",
        };
      }),
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    const owner = await identity(request),
      body = await jsonBody(request),
      db = database(),
      today = marketDay();
    if (body.action === "refresh") {
      const { results } = await db
        .prepare(
          "SELECT id,symbol,as_of,target,created_at FROM forecast_records WHERE owner_id=? AND settled_at IS NULL AND target<? ORDER BY target LIMIT 200",
        )
        .bind(owner, today)
        .all<Row>();
      let scored = 0,
        excluded = 0;
      const warnings: string[] = [];
      for (const symbol of [...new Set(results.map((r) => r.symbol))].slice(
        0,
        10,
      )) {
        try {
          const data = await loadStock(owner, symbol);
          for (const row of results.filter((r) => r.symbol === symbol)) {
            const outcome = scoreForecast(row, data.prices, today);
            if (outcome.status === "pending") continue;
            const applied = await db
              .prepare(
                "UPDATE forecast_records SET actual_return=?,settled_at=? WHERE id=? AND owner_id=? AND settled_at IS NULL",
              )
              .bind(
                outcome.actual ?? null,
                new Date().toISOString(),
                row.id,
                owner,
              )
              .run();
            if (applied.meta.changes) {
              if (outcome.status === "settled") scored++;
              else excluded++;
            }
          }
        } catch (e) {
          warnings.push(
            symbol +
              " · " +
              (e instanceof HttpError
                ? e.message
                : "Price history unavailable."),
          );
        }
      }
      return privateJson({
        message:
          scored + " scored, " + excluded + " excluded. " + warnings.join(" "),
      });
    }
    if (body.action !== "record")
      throw new HttpError(400, "Choose record or refresh.");
    const symbol = String(body.symbol || "")
        .trim()
        .toUpperCase(),
      horizon = Number(body.horizon || 1);
    const data = await loadStock(owner, symbol, horizon),
      f = data.forecast,
      now = new Date();
    if (!f || f.targetWeekEnding <= marketDay(now))
      throw new HttpError(
        409,
        "This estimate cannot be recorded before its target day. Select a later forecast horizon.",
      );
    const snapshot = {
      model: f.model,
      modelVersion: f.modelVersion,
      modelId: f.modelId,
      expectedReturn: f.expectedReturn,
      basePrice: f.basePrice,
      estimate: f.estimate,
      low: f.low,
      high: f.high,
    };
    const inserted = await db
      .prepare(
        "INSERT INTO forecast_records(id,owner_id,symbol,horizon,model_version,as_of,target,created_at,forecast_json) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(owner_id,symbol,horizon,model_version,as_of) DO NOTHING",
      )
      .bind(
        crypto.randomUUID(),
        owner,
        symbol,
        horizon,
        f.modelVersion,
        f.asOf,
        f.targetWeekEnding,
        now.toISOString(),
        JSON.stringify(snapshot),
      )
      .run();
    return privateJson({
      message: inserted.meta.changes
        ? "Forecast recorded before its target day."
        : "This forecast was already recorded. Its original estimate was preserved.",
    });
  } catch (e) {
    return failure(e);
  }
}
