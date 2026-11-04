const number = (value) =>
  value == null ||
  String(value).trim() === "" ||
  !Number.isFinite(Number(value))
    ? null
    : Number(value);
const validDate = (value) =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
export function articles(payload, symbol) {
  if (!Array.isArray(payload.feed)) throw new Error("Missing news feed");
  return payload.feed
    .flatMap((item) => {
      if (
        !item?.title ||
        !/^https?:\/\//i.test(item.url) ||
        !Array.isArray(item.ticker_sentiment) ||
        !item.ticker_sentiment.some((t) => t.ticker === symbol)
      )
        return [];
      const stamp = String(item.time_published).match(
        /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})/,
      );
      return [
        {
          title: String(item.title),
          url: item.url,
          source: item.source || "Publisher",
          published: stamp
            ? stamp[1] +
              "-" +
              stamp[2] +
              "-" +
              stamp[3] +
              " " +
              stamp[4] +
              ":" +
              stamp[5] +
              " UTC"
            : "Date unavailable",
          summary: String(item.summary || "").slice(0, 500),
        },
      ];
    })
    .slice(0, 10);
}
export function earnings(payload, symbol) {
  if (payload.symbol !== symbol || !Array.isArray(payload.quarterlyEarnings))
    throw new Error("Missing earnings data");
  return payload.quarterlyEarnings
    .filter((r) => validDate(r.reportedDate))
    .slice(0, 8)
    .map((r) => ({
      quarter: r.fiscalDateEnding,
      reported: r.reportedDate,
      eps: number(r.reportedEPS),
      estimate: number(r.estimatedEPS),
      surprise: number(r.surprisePercentage),
    }));
}
export function calendar(csv, symbol) {
  const rows = [];
  let record = [],
    field = "",
    quoted = false;
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if (c === '"') {
      if (quoted && csv[i + 1] === '"') {
        field += '"';
        i++;
      } else quoted = !quoted;
    } else if (c === "," && !quoted) {
      record.push(field);
      field = "";
    } else if (c === "\n" && !quoted) {
      record.push(field.trim());
      rows.push(record);
      record = [];
      field = "";
    } else field += c;
  }
  if (field || record.length) {
    record.push(field.trim());
    rows.push(record);
  }
  const headers = rows.shift() || [],
    si = headers.indexOf("symbol"),
    di = headers.indexOf("reportDate");
  if (si < 0 || di < 0 || rows.some((r) => r.length > 1 && !validDate(r[di])))
    throw new Error("Calendar unavailable");
  return rows
    .filter((r) => r[si] === symbol && validDate(r[di]))
    .map((r) => ({
      date: r[di],
      quarter: r[headers.indexOf("fiscalDateEnding")],
      estimate: number(r[headers.indexOf("estimate")]),
      currency: r[headers.indexOf("currency")],
    }));
}
