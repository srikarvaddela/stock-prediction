import assert from "node:assert/strict";
import {executionTerms} from "../lib/paper.mjs";
const base = process.argv[2] || "http://127.0.0.1:5186";
if (!["127.0.0.1", "localhost"].includes(new URL(base).hostname))
  throw new Error("Run this integration check only against a local Worker.");
const owner = "paper-test-" + crypto.randomUUID();
const headers = {
  "oai-authenticated-user-id": owner,
  "oai-authenticated-user-email": "local@example.invalid",
  Origin: base,
  "Content-Type": "application/json",
  Connection:"close",
};
async function call(path, body, custom = headers) {
  const r = await fetch(base + path, {
    headers: custom,
    method: body ? "POST" : "GET",
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, data: await r.json() };
}
assert.equal((await call("/api/paper", null, {})).status, 401);
let state = (await call("/api/paper")).data;
assert.equal(state.cashCents, 10000000);
assert.equal(state.tradeCount, 0);
const q = (await call("/api/paper/quote?symbol=Apple")).data;
assert.equal(q.symbol, "AAPL");
assert.equal(q.stale, false);
const order = {
  requestId: crypto.randomUUID(),
  symbol: "AAPL",
  side: "buy",
  quantity: "1",
  version: 0,
  priceDate: q.date,
  priceCents: q.priceCents,
  costModel:q.costModel,
};
const first = await call("/api/paper", order);
assert.equal(first.status, 200, first.data.error);
state = first.data.state;
assert.equal(state.version, 1);
assert.equal(state.positions[0].quantity, 1);
assert.equal(state.cashCents, 10000000 - executionTerms(1e6,q.priceCents,"buy").cashCents);
const replay = await call("/api/paper", order);
assert.equal(replay.status, 200);
assert.equal(replay.data.state.tradeCount, 1);
assert.equal(
  (await call("/api/paper", { ...order, quantity: "2" })).status,
  409,
);
assert.equal(
  (
    await call("/api/paper", {
      ...order,
      requestId: crypto.randomUUID(),
      version: 1,
      priceCents: 1,
    })
  ).status,
  409,
);
assert.equal(
  (
    await call("/api/paper", {
      ...order,
      requestId: crypto.randomUUID(),
      version: 1,
      side: "sell",
      quantity: "2",
    })
  ).status,
  409,
);
assert.equal(
  (
    await call("/api/paper", {
      ...order,
      requestId: crypto.randomUUID(),
      version: 1,
      quantity: "1000000",
    })
  ).status,
  409,
);
const competing = await Promise.all(
  [1, 2].map(() =>
    call("/api/paper", {
      ...order,
      requestId: crypto.randomUUID(),
      version: 1,
      quantity: "0.5",
    }),
  ),
);
assert.deepEqual(competing.map((r) => r.status).sort(), [200, 409]);
state = (await call("/api/paper")).data;
assert.equal(state.positions[0].quantity, 1.5);
assert.ok(state.cashCents >= 0);
const sells = await Promise.all(
  [1, 2].map(() =>
    call("/api/paper", {
      ...order,
      requestId: crypto.randomUUID(),
      version: 2,
      side: "sell",
      quantity: "1",
    }),
  ),
);
assert.deepEqual(sells.map((r) => r.status).sort(), [200, 409]);
state = (await call("/api/paper")).data;
assert.equal(state.positions[0].quantity, 0.5);
const close = await call("/api/paper", {
  ...order,
  requestId: crypto.randomUUID(),
  version: 3,
  side: "sell",
  quantity: "0.5",
});
assert.equal(close.status, 200, close.data.error);
assert.equal(close.data.state.positions.length, 0);
const expected=10000000-executionTerms(1e6,q.priceCents,"buy").cashCents-executionTerms(0.5e6,q.priceCents,"buy").cashCents+executionTerms(1e6,q.priceCents,"sell").cashCents+executionTerms(0.5e6,q.priceCents,"sell").cashCents;
assert.equal(close.data.state.cashCents, expected);
assert.equal(close.data.state.realizedCents, expected-10000000);
assert.equal(close.data.state.feeCents,400);
assert.equal(close.data.state.benchmark.symbol, "SPY");
const other = (
  await call("/api/paper", null, {
    ...headers,
    "oai-authenticated-user-id": owner + "-other",
  })
).data;
assert.equal(other.tradeCount, 0);
assert.equal(other.cashCents, 10000000);
assert.equal((await call("/api/paper", {}, {...headers,Origin:"https://invalid.example"})).status,403);
console.log(
  "Paper API passed: authentication, quote validation, fills, fractional shares, duplicate retries, cash/share limits, concurrent orders, closing positions, benchmark and owner isolation.",
);
