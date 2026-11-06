import { readFile, writeFile, mkdir, rename, access } from "node:fs/promises";
import { weeklyHistory } from "../lib/public-history.mjs";
const catalog = JSON.parse(
  await readFile(new URL("../lib/stock-picker.json", import.meta.url), "utf8"),
);
const directory = new URL("../.market-snapshots/", import.meta.url);
await mkdir(directory, { recursive: true });
for (const symbol of [...Object.keys(catalog), "SPY"]) {
  if (process.argv.includes("--missing")) {
    try {
      await access(new URL(symbol + ".json", directory));
      continue;
    } catch {}
  }
  try {
    const response = await fetch(
      "https://query1.finance.yahoo.com/v8/finance/chart/" +
        symbol +
        "?range=10y&interval=1d&includeAdjustedClose=true&events=div%2Csplits",
      { signal: AbortSignal.timeout(10000) },
    );
    if (!response.ok) throw new Error("HTTP " + response.status);
    const raw=await response.json(), series=raw.chart.result[0];
    const data = weeklyHistory(raw, symbol);
    const day=t=>new Date(t*1000).toLocaleDateString("en-CA",{timeZone:"America/New_York"});
    data.actions=[...Object.values(series.events?.dividends||{}).map(e=>({type:"dividend",date:day(e.date),amount:e.amount})),...Object.values(series.events?.splits||{}).map(e=>({type:"split",date:day(e.date),ratio:e.numerator/e.denominator}))];
    data.actionsFrom=day(series.timestamp[0]);data.actionsThrough=data.prices.at(-1).date;
    const temp = new URL(symbol + ".tmp", directory);
    await writeFile(
      temp,
      JSON.stringify({ symbol, ...data, fetchedAt: new Date().toISOString() }),
    );
    await rename(temp, new URL(symbol + ".json", directory));
    console.log(
      symbol +
        " · " +
        data.prices.length +
        " weeks through " +
        data.prices.at(-1).date,
    );
  } catch (e) {
    console.warn(
      "Could not refresh " +
        symbol +
        " (" +
        e.message +
        "). Keeping any previous snapshot.",
    );
  }
}
