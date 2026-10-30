/** Experimental ridge regression. Features, scaling, and labels use only data known at each forecast origin. */
const LOOKBACK = 12;
const ALPHA = 10;
const mean = (values) =>
  values.reduce((sum, value) => sum + value, 0) / values.length;
const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0);

export function completeWeeks(points, now = new Date()) {
  const monday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));
  const cutoff = monday.toISOString().slice(0, 10);
  return points.filter((point) => point.date < cutoff);
}

export function featuresAt(points, index) {
  if (index < LOOKBACK)
    throw new Error("Not enough history to compute features.");
  const current = points[index].adjusted;
  const returns = Array.from({ length: LOOKBACK }, (_, offset) => {
    const i = index - offset;
    return Math.log(points[i].adjusted / points[i - 1].adjusted);
  });
  const average = mean(returns);
  return [
    returns[0],
    Math.log(current / points[index - 4].adjusted),
    Math.log(current / points[index - 12].adjusted),
    Math.log(
      current /
        mean(points.slice(index - 11, index + 1).map((p) => p.adjusted)),
    ),
    Math.sqrt(mean(returns.map((r) => (r - average) ** 2))),
  ];
}

function solve(matrix, vector) {
  const n = vector.length;
  const augmented = matrix.map((row, i) => [...row, vector[i]]);
  for (let column = 0; column < n; column++) {
    let pivot = column;
    for (let row = column + 1; row < n; row++)
      if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivot][column]))
        pivot = row;
    [augmented[column], augmented[pivot]] = [
      augmented[pivot],
      augmented[column],
    ];
    const divisor = augmented[column][column];
    if (Math.abs(divisor) < 1e-12)
      throw new Error("Model fit is numerically unstable.");
    for (let j = column; j <= n; j++) augmented[column][j] /= divisor;
    for (let row = 0; row < n; row++)
      if (row !== column) {
        const factor = augmented[row][column];
        for (let j = column; j <= n; j++)
          augmented[row][j] -= factor * augmented[column][j];
      }
  }
  return augmented.map((row) => row[n]);
}

function fit(rows) {
  const width = rows[0].x.length;
  const means = Array.from({ length: width }, (_, j) =>
    mean(rows.map((row) => row.x[j])),
  );
  const scales = means.map((m, j) =>
    Math.max(1e-8, Math.sqrt(mean(rows.map((row) => (row.x[j] - m) ** 2)))),
  );
  const intercept = mean(rows.map((row) => row.y));
  const matrix = Array.from({ length: width }, (_, i) =>
    Array.from({ length: width }, (_, j) => (i === j ? ALPHA : 0)),
  );
  const vector = Array(width).fill(0);
  for (const row of rows) {
    const x = row.x.map((v, j) => (v - means[j]) / scales[j]);
    for (let i = 0; i < width; i++) {
      vector[i] += x[i] * (row.y - intercept);
      for (let j = 0; j < width; j++) matrix[i][j] += x[i] * x[j];
    }
  }
  const weights = solve(matrix, vector);
  return (x) =>
    intercept +
    dot(
      weights,
      x.map((v, j) => (v - means[j]) / scales[j]),
    );
}

export function forecast(points, now = new Date()) {
  if (
    points.some(
      (p, i) =>
        !Number.isFinite(p.adjusted) ||
        p.adjusted <= 0 ||
        !Number.isFinite(p.close) ||
        p.close <= 0 ||
        (i > 0 && p.date <= points[i - 1].date),
    )
  )
    throw new Error(
      "History must contain positive prices in chronological order.",
    );
  const history = completeWeeks(points, now).slice(-260);
  if (history.length < 120) return null;
  // A missing week changes the meaning of a one-week label: fail rather than silently train across it.
  if (
    history.some(
      (p, i) =>
        i > 0 &&
        (Date.parse(p.date) - Date.parse(history[i - 1].date)) / 86400000 > 10,
    )
  )
    return null;
  const rows = [];
  for (let i = LOOKBACK; i < history.length - 1; i++)
    rows.push({
      index: i,
      x: featuresAt(history, i),
      y: Math.log(history[i + 1].adjusted / history[i].adjusted),
    });
  const testStart = Math.max(52, rows.length - 52);
  const backtest = [];
  for (let i = testStart; i < rows.length; i++) {
    const prediction = fit(rows.slice(0, i))(rows[i].x);
    const origin = history[rows[i].index],
      outcome = history[rows[i].index + 1];
    backtest.push({
      origin: origin.date,
      date: outcome.date,
      predictedReturn: Math.expm1(prediction),
      actualReturn: Math.expm1(rows[i].y),
      residual: Math.abs(rows[i].y - prediction),
      trainingThrough: origin.date,
    });
  }
  const latest = history.at(-1);
  const prediction = fit(rows)(featuresAt(history, history.length - 1));
  const errors = backtest.map((row) => row.residual).sort((a, b) => a - b);
  const radius = errors[Math.ceil(errors.length * 0.8) - 1];
  const target = new Date(latest.date + "T12:00:00Z");
  target.setUTCDate(target.getUTCDate() - ((target.getUTCDay() + 6) % 7) + 11);
  const targetWeekEnding = target.toISOString().slice(0, 10);
  const result = {
    model: "Ridge regression",
    asOf: latest.date,
    targetWeekEnding,
    stale: targetWeekEnding < now.toISOString().slice(0, 10),
    trainingWeeks: rows.length,
    backtestWeeks: backtest.length,
    basePrice: latest.close,
    expectedReturn: Math.expm1(prediction),
    estimate: latest.close * Math.exp(prediction),
    low: latest.close * Math.exp(prediction - radius),
    high: latest.close * Math.exp(prediction + radius),
    mae: mean(
      backtest.map((row) => Math.abs(row.predictedReturn - row.actualReturn)),
    ),
    baselineMae: mean(backtest.map((row) => Math.abs(row.actualReturn))),
    directionAccuracy: mean(
      backtest.map((row) =>
        Number(Math.sign(row.predictedReturn) === Math.sign(row.actualReturn)),
      ),
    ),
    factors: [
      "1-, 4-, and 12-week momentum",
      "Distance from the 12-week moving average",
      "12-week return volatility",
    ],
    backtest,
  };
  if (
    [
      result.estimate,
      result.low,
      result.high,
      result.mae,
      result.baselineMae,
    ].some((v) => !Number.isFinite(v))
  )
    throw new Error("The model produced an invalid estimate.");
  return result;
}
