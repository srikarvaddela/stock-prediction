import test from "node:test";
import assert from "node:assert/strict";
import catalog from "../lib/stock-picker.json" with { type: "json" };
import { stockSymbol, comparisonSymbols } from "../lib/company-search.mjs";

test("every featured company resolves to the same ticker from its name and symbol", () => {
  for (const [symbol, name] of Object.entries(catalog)) {
    for (const query of [
      symbol,
      symbol.toLowerCase(),
      name,
      " " + name.toUpperCase() + " ",
    ]) {
      assert.equal(stockSymbol(query), symbol, query);
    }
  }
});
test("common company aliases resolve while explicit share classes are preserved", () => {
  for (const [query, symbol] of [
    ["Apple Inc.", "AAPL"],
    ["Google", "GOOGL"],
    ["GOOG", "GOOG"],
    ["TSMC", "TSM"],
    ["Amazon.com, Inc.", "AMZN"],
    ["Microsoft Corporation", "MSFT"],
    ["BRK.B", "BRK.B"],
  ])
    assert.equal(stockSymbol(query), symbol);
  assert.equal(stockSymbol("AAPL&symbol=IBM"), "");
});
test("comparisons preserve multiword names and deduplicate company aliases", () => {
  assert.deepEqual(
    comparisonSymbols("Apple, AAPL, International Business Machines"),
    ["AAPL", "IBM"],
  );
  assert.deepEqual(comparisonSymbols("AAPL MSFT"), ["AAPL", "MSFT"]);
});
