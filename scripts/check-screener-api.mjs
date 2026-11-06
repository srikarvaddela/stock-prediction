import assert from "node:assert/strict";
import { filterStocks, sortStocks } from "../lib/screener.mjs";
import catalog from "../lib/stock-picker.json" with { type: "json" };
const base = process.argv[2] || "http://127.0.0.1:5186";
if (!["127.0.0.1", "localhost"].includes(new URL(base).hostname))
  throw new Error("Use a local Worker for this check.");
const headers = {
  "oai-authenticated-user-id": "screener-test-" + crypto.randomUUID(),
  "oai-authenticated-user-email": "local@example.invalid",
  Origin: base,
  "Content-Type": "application/json",
  // Keep negative HTTP cases on separate connections in the local dev proxy.
  Connection: "close",
};
async function request(path, body, custom = headers) {
  const r = await fetch(base + path, {
    headers: custom,
    method: body ? "POST" : "GET",
    body: body ? JSON.stringify(body) : undefined,
  });
  const raw = await r.text();
  try {
    return { status: r.status, body: JSON.parse(raw) };
  } catch {
    throw new Error(
      `${body ? "POST" : "GET"} ${path} ${JSON.stringify(body)} returned ${r.status}: ${raw}`,
    );
  }
}
assert.equal((await request("/api/screener", null, {})).status, 401);
const response = await request("/api/screener");
assert.equal(response.status, 200, response.body.error);
const { rows } = response.body;
assert.equal(rows.length, 30);
assert.deepEqual(rows.map((r) => r.symbol).sort(), Object.keys(catalog).sort());
for (const row of rows) {
  assert.ok(Number.isFinite(row.price) && row.price > 0);
  assert.ok(Number.isFinite(row.return4w));
  assert.ok(Number.isFinite(row.volatility) && row.volatility >= 0);
  assert.ok(row.indicatorDate <= row.priceDate);
  assert.equal(row.pe, null);
  assert.equal(row.revenueGrowth, null);
  assert.ok(Number.isFinite(row.pythonMae));
}
assert.deepEqual(
  filterStocks(rows, { sector: "Energy" })
    .map((r) => r.symbol)
    .sort(),
  ["CVX", "XOM"],
);
assert.equal(filterStocks(rows, { query: "Apple" })[0].symbol, "AAPL");
assert.equal(filterStocks(rows, { maxPe: "20" }).length, 0);
assert.ok(
  filterStocks(rows, { beatsBaseline: true }).every(
    (r) => r.pythonBeatsBaseline,
  ),
);
const sorted = sortStocks(rows, "price", "desc");
assert.ok(sorted.every((r, i) => !i || r.price <= sorted[i - 1].price));
if (!response.body.canLoadFundamentals)
  assert.equal(
    (await request("/api/screener", { symbol: "AAPL" })).status,
    409,
  );
assert.equal(
  (await request("/api/screener", { symbol: "NOTREAL" })).status,
  400,
);
// Deliberate cross-origin rejection goes last: Wrangler may briefly restart
// its local request proxy after rejecting an unread POST body.
assert.equal(
  (
    await request(
      "/api/screener",
      { symbol: "AAPL" },
      { ...headers, Origin: "https://invalid.example" },
    )
  ).status,
  403,
);
console.log(
  "Screener API passed for all 30 companies: metrics, sector/name filters, missing fundamentals, sorting, baseline filters, authentication and key requirements.",
);
