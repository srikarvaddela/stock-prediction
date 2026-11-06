export function parseDirectory(text, nasdaq = false) {
  const [header, ...lines] = text.trim().split(/\r?\n/);
  const keys = header.split("|");
  if (!keys.includes("Test Issue") || !keys.includes("ETF")) throw new Error("Invalid exchange directory");
  return lines.flatMap((line) => {
    const row = Object.fromEntries(line.split("|").map((v, i) => [keys[i], v]));
    const name = row["Security Name"] || "";
    // Focus on company equity/ADRs, excluding funds and non-common instruments.
    if (row["Test Issue"] !== "N" || row.ETF !== "N" || /\b(warrants?|rights|units|preferred|preference|notes|debentures|bonds|fund|trust preferred)\b/i.test(name)) return [];
    const symbol = (row.Symbol || row["ACT Symbol"] || "").replace(/\.([A-Z])$/, "-$1");
    if (!/^[A-Z][A-Z0-9-]{0,9}$/.test(symbol)) return [];
    return [{ symbol, name, exchange: nasdaq ? "NASDAQ" : ({N:"NYSE",A:"NYSE American",P:"NYSE Arca",Z:"Cboe",V:"IEX"}[row.Exchange] || row.Exchange) }];
  });
}
export function searchDirectory(rows, query, exchange = "") {
  const q = String(query || "").trim().toLowerCase();
  return rows.filter(r => (!exchange || r.exchange === exchange) && (!q || r.symbol.toLowerCase().includes(q) || r.name.toLowerCase().includes(q)))
    .sort((a,b) => Number(b.symbol.toLowerCase() === q) - Number(a.symbol.toLowerCase() === q) || Number(b.symbol.toLowerCase().startsWith(q)) - Number(a.symbol.toLowerCase().startsWith(q)) || a.symbol.localeCompare(b.symbol));
}
