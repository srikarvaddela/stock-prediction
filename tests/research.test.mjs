import test from "node:test";
import assert from "node:assert/strict";
import {rssHeadlines,financialSummary,calendar} from "../lib/research.mjs";
test("RSS uses safe links and plain headline text, without copying article bodies",()=>{
 const rows=rssHeadlines('<rss><item><title>A &amp; B</title><link>https://example.com/news</link><description>Do not copy</description><pubDate>Fri, 06 Nov 2026 14:00:00 GMT</pubDate></item><item><title>Bad</title><link>javascript:alert(1)</link></item></rss>');
 assert.equal(rows.length,1);assert.equal(rows[0].title,"A & B");assert.equal(rows[0].summary,"");assert.throws(()=>rssHeadlines("not xml"));
});
test("financial summaries join matching quarter/currency and preserve missing values",()=>{
 const income={symbol:"ABC",quarterlyReports:[{fiscalDateEnding:"2026-09-30",reportedCurrency:"USD",totalRevenue:"120",netIncome:"12"},{fiscalDateEnding:"2025-09-30",reportedCurrency:"USD",totalRevenue:"100"}]};
 const balance={symbol:"ABC",quarterlyReports:[{fiscalDateEnding:"2026-06-30",reportedCurrency:"USD",totalAssets:"999"}]};
 const cash={symbol:"ABC",quarterlyReports:[{fiscalDateEnding:"2026-09-30",reportedCurrency:"USD",operatingCashflow:"20",capitalExpenditures:"5"}]};
 const result=financialSummary(income,balance,cash,"ABC");assert.equal(result.assets,null);assert.equal(result.freeCashFlow,15);assert.equal(result.netMargin,0.1);assert.ok(Math.abs(result.revenueGrowth-0.2)<1e-12);assert.equal(result.missing.length,1);
 assert.throws(()=>financialSummary(income,balance,cash,"XYZ"));
});
test("upcoming earnings excludes past dates and other companies",()=>{
 assert.deepEqual(calendar("symbol,reportDate,fiscalDateEnding,estimate,currency\nABC,2026-11-01,2026-09-30,1,USD\nABC,2026-11-10,2026-09-30,2,USD\nXYZ,2026-11-12,2026-09-30,1,USD","ABC","2026-11-06").map(r=>r.date),["2026-11-10"]);
});
