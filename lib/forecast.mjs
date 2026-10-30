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

function fit(rows, alpha = ALPHA) {
  const width = rows[0].x.length;
  const means = Array.from({ length: width }, (_, j) =>
    mean(rows.map((row) => row.x[j])),
  );
  const scales = means.map((m, j) =>
    Math.max(1e-8, Math.sqrt(mean(rows.map((row) => (row.x[j] - m) ** 2)))),
  );
  const intercept = mean(rows.map((row) => row.y));
  const matrix = Array.from({ length: width }, (_, i) =>
    Array.from({ length: width }, (_, j) => (i === j ? alpha : 0)),
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

// Small gradient-boosted regression stumps: deterministic, bounded compute for a Worker.
function fitBoost(rows) {
  const intercept = mean(rows.map((r) => r.y)),
    predictions = rows.map(() => intercept),
    stumps = [];
  const cuts = Array.from({ length: rows[0].x.length }, (_, j) => {
    const sorted = rows.map((r) => r.x[j]).sort((a, b) => a - b);
    return [0.25, 0.5, 0.75].map(
      (q) => sorted[Math.floor((sorted.length - 1) * q)],
    );
  });
  for (let step = 0; step < 16; step++) {
    const residuals = rows.map((r, i) => r.y - predictions[i]);
    let best = null;
    for (let j = 0; j < cuts.length; j++)
      for (const threshold of cuts[j]) {
        let lc = 0,
          rc = 0,
          ls = 0,
          rs = 0;
        rows.forEach((r, i) => {
          if (r.x[j] <= threshold) {
            lc++;
            ls += residuals[i];
          } else {
            rc++;
            rs += residuals[i];
          }
        });
        if (lc < 8 || rc < 8) continue;
        const left = ls / lc,
          right = rs / rc;
        const loss = rows.reduce(
          (s, r, i) =>
            s + (residuals[i] - (r.x[j] <= threshold ? left : right)) ** 2,
          0,
        );
        if (!best || loss < best.loss)
          best = { j, threshold, left: left * 0.1, right: right * 0.1, loss };
      }
    if (!best) break;
    stumps.push(best);
    rows.forEach((r, i) => {
      predictions[i] += r.x[best.j] <= best.threshold ? best.left : best.right;
    });
  }
  return (x) =>
    intercept +
    stumps.reduce((s, t) => s + (x[t.j] <= t.threshold ? t.left : t.right), 0);
}
const CANDIDATES = [
  { id: "flat", name: "No change", fit: () => () => 0 },
  {
    id: "mean",
    name: "Historical mean",
    fit: (rows) => {
      const m = mean(rows.map((r) => r.y));
      return () => m;
    },
  },
  { id: "ridge10", name: "Ridge regression", fit: (rows) => fit(rows, 10) },
  { id: "ridge100", name: "Conservative ridge", fit: (rows) => fit(rows, 100) },
  { id: "boost", name: "Gradient boosting", fit: fitBoost },
  {
    id: "ensemble",
    name: "Ridge + boosting ensemble",
    fit: (rows) => {
      const a = fit(rows, 10),
        b = fitBoost(rows);
      return (x) => (a(x) + b(x)) / 2;
    },
  },
];
function quantile(values, q) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[
    Math.min(sorted.length - 1, Math.ceil((sorted.length + 1) * q) - 1)
  ];
}
function weekTarget(date, horizon) {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 4 + 7 * horizon);
  return d.toISOString().slice(0, 10);
}
export function forecast(points, now = new Date(), horizon = 1) {
  if (![1, 4].includes(horizon))
    throw new Error("Supported horizons are one and four weeks.");
  if (
    points.some(
      (p, i) =>
        !/^\d{4}-\d{2}-\d{2}$/.test(p.date) ||
        !Number.isFinite(Date.parse(p.date)) ||
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
  const history = completeWeeks(points, now).slice(-320);
  if (history.length < 180) return null;
  if (
    history.some(
      (p, i) =>
        i > 0 &&
        (Date.parse(p.date) - Date.parse(history[i - 1].date)) / 86400000 > 10,
    )
  )
    return null;
  const rows = [];
  for (let i = LOOKBACK; i < history.length - horizon; i++)
    rows.push({
      index: i,
      targetIndex: i + horizon,
      x: featuresAt(history, i),
      y: Math.log(history[i + horizon].adjusted / history[i].adjusted),
    });
  // Purged boundaries: every label used in selection/calibration matures before the next stage starts.
  const testStart = rows.length - 52;
  const calibrationEnd = testStart - horizon + 1,
    calibrationStart = calibrationEnd - 26;
  const validationEnd = calibrationStart - horizon + 1,
    validationStart = validationEnd - 26;
  if (validationStart < 52) return null;
  const trainAt = (i) => rows.filter((r) => r.targetIndex <= rows[i].index);
  const predictAt = (candidate, i) => candidate.fit(trainAt(i))(rows[i].x);
  const candidates = CANDIDATES.map((candidate) => {
    const errors = [];
    for (let i = validationStart; i < validationEnd; i++)
      errors.push(
        Math.abs(Math.expm1(predictAt(candidate, i)) - Math.expm1(rows[i].y)),
      );
    return {
      id: candidate.id,
      name: candidate.name,
      validationMae: mean(errors),
    };
  }).sort((a, b) => a.validationMae - b.validationMae);
  const selected = CANDIDATES.find((c) => c.id === candidates[0].id);
  const calibration = [];
  for (let i = calibrationStart; i < calibrationEnd; i++)
    calibration.push(Math.abs(rows[i].y - predictAt(selected, i)));
  const evaluationRadius = quantile(calibration, 0.8);
  const backtest = [];
  for (let i = testStart; i < rows.length; i++) {
    const train = trainAt(i),
      prediction = selected.fit(train)(rows[i].x),
      origin = history[rows[i].index],
      outcome = history[rows[i].targetIndex];
    backtest.push({
      origin: origin.date,
      date: outcome.date,
      predictedReturn: Math.expm1(prediction),
      actualReturn: Math.expm1(rows[i].y),
      residual: Math.abs(rows[i].y - prediction),
      trainingThrough: history[train.at(-1).targetIndex].date,
      covered: Math.abs(rows[i].y - prediction) <= evaluationRadius,
    });
  }
  const latest = history.at(-1),
    prediction = selected.fit(rows)(featuresAt(history, history.length - 1));
  const radius = quantile(
      backtest.slice(-26).map((r) => r.residual),
      0.8,
    ),
    targetWeekEnding = weekTarget(latest.date, horizon);
  const featureNames = [
    "1-week momentum",
    "4-week momentum",
    "12-week momentum",
    "Distance from moving average",
    "Return volatility",
  ];
  const latestFeatures = featuresAt(history, history.length - 1),
    model = selected.fit(rows);
  const drivers = featureNames
    .map((name, j) => {
      const neutral = mean(rows.map((r) => r.x[j])),
        changed = [...latestFeatures];
      changed[j] = neutral;
      return {
        name,
        impact: Math.expm1(prediction) - Math.expm1(model(changed)),
      };
    })
    .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
  const result = {
    model: selected.name,
    modelId: selected.id,
    modelVersion: "2.0.0",
    horizon,
    asOf: latest.date,
    targetWeekEnding,
    stale: targetWeekEnding < now.toISOString().slice(0, 10),
    trainingWeeks: rows.length,
    backtestWeeks: backtest.length,
    basePrice: latest.close,
    baseAdjusted: latest.adjusted,
    expectedReturn: Math.expm1(prediction),
    estimate: latest.close * Math.exp(prediction),
    low: latest.close * Math.exp(prediction - radius),
    high: latest.close * Math.exp(prediction + radius),
    mae: mean(
      backtest.map((r) => Math.abs(r.predictedReturn - r.actualReturn)),
    ),
    baselineMae: mean(backtest.map((r) => Math.abs(r.actualReturn))),
    rmse: Math.sqrt(
      mean(backtest.map((r) => (r.predictedReturn - r.actualReturn) ** 2)),
    ),
    directionAccuracy: mean(
      backtest.map((r) =>
        Number(Math.sign(r.predictedReturn) === Math.sign(r.actualReturn)),
      ),
    ),
    intervalCoverage: mean(backtest.map((r) => Number(r.covered))),
    validationThrough: history[rows[validationEnd - 1].targetIndex].date,
    calibrationThrough: history[rows[calibrationEnd - 1].targetIndex].date,
    holdoutFrom: backtest[0].origin,
    factors: featureNames,
    drivers,
    candidates,
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
