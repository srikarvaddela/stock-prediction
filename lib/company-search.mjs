import catalog from "./stock-picker.json" with { type: "json" };
import { validSymbol } from "./market.mjs";

function nameKey(value) {
  return value
    .toLowerCase()
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(
      /\s+(?:incorporated|inc|corporation|corp|company|co|limited|ltd)(?:\s+(?:limited|ltd))?$/,
      "",
    )
    .trim();
}
const companyNames = new Map(
  Object.entries(catalog).map(([ticker, name]) => [nameKey(name), ticker]),
);
for (const [name, ticker] of [
  ["Google", "GOOGL"],
  ["TSMC", "TSM"],
  ["Taiwan Semiconductor", "TSM"],
  ["Amazon.com", "AMZN"],
]) {
  companyNames.set(nameKey(name), ticker);
}
export function stockSymbol(input) {
  if (typeof input !== "string" || input.length > 100) return "";
  const text = input.trim(),
    ticker = text.toUpperCase();
  return companyNames.get(nameKey(text)) ?? (validSymbol(ticker) ? ticker : "");
}
export function comparisonSymbols(input) {
  // Commas delimit company names. Preserve the older space-separated ticker shortcut.
  const entries = input.includes(",")
    ? input.split(",")
    : stockSymbol(input)
      ? [input]
      : input.trim().split(/\s+/);
  return [...new Set(entries.map(stockSymbol))];
}
