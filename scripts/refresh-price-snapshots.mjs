import { readFile, writeFile, mkdir, rename, access } from "node:fs/promises";
import { weeklyHistory } from "../lib/public-history.mjs";
const catalog = JSON.parse(
  await readFile(new URL("../lib/stock-picker.json", import.meta.url), "utf8"),
);
const directory = new URL("../.market-snapshots/", import.meta.url);
await mkdir(directory, { recursive: true });
for (const symbol of Object.keys(catalog)) {
  if (symbol === "IBM") continue;
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
        "?range=10y&interval=1d&includeAdjustedClose=true",
      { signal: AbortSignal.timeout(10000) },
    );
    if (!response.ok) throw new Error("HTTP " + response.status);
    const data = weeklyHistory(await response.json(), symbol);
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
