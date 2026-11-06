import { writeFile, mkdir } from "node:fs/promises";
import { parseDirectory } from "../lib/directory.mjs";
export async function fetchDirectory() {
  const lists = [];
  for (const file of ["nasdaqlisted", "otherlisted"]) {
    const r = await fetch(`https://www.nasdaqtrader.com/dynamic/SymDir/${file}.txt`, { signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error(`Directory HTTP ${r.status}`);
    lists.push(...parseDirectory(await r.text(), file === "nasdaqlisted"));
  }
  const rows = [...new Map(lists.map(r=>[r.symbol,r])).values()].sort((a,b)=>a.symbol.localeCompare(b.symbol));
  if (rows.length < 3000) throw new Error("Exchange directory unexpectedly incomplete; preserving previous file.");
  return { fetchedAt:new Date().toISOString(), source:"Nasdaq Trader symbol directory", rows };
}
if (process.argv[1]?.replaceAll("\\", "/").endsWith("/refresh-directory.mjs")) {
  const output = process.argv[2] || "lib/stock-directory.json";
  const data = await fetchDirectory();
  await mkdir(new URL("../lib/", import.meta.url),{recursive:true});
  await writeFile(output, JSON.stringify(data));
  console.log(`${data.rows.length} company listings saved to ${output}`);
}
