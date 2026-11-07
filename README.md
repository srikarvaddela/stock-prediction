# Stock Prediction

A private stock research workspace with one- and four-week forecasts. The public GitHub repository contains the application source. [Open the hosted app](https://stock-prediction-srikar.shoyo722.chatgpt.site).

## Start in the app

Open **All companies** to search thousands of U.S. exchange-listed company shares and ADRs by name, ticker, or exchange. The directory includes smaller companies; OTC securities, funds, preferred shares, warrants, and units are excluded. The 30 featured stocks remain convenient shortcuts. A listing is not a guarantee of available data or sufficient history for a forecast. A chart identifies its source, observation date, and saved-history fallback.

No-key prices use Yahoo Finance daily history aggregated into weeks. A scheduled GitHub pipeline refreshes a public data branch independently of app publication; the app caches validated data in D1. Bundled featured histories are a last fallback. Free news headlines link to their publishers. To load company fundamentals, earnings, and financial statements, save an [Alpha Vantage key](https://www.alphavantage.co/support/#api-key) in **Settings**; IBM also has demo reports. Provider coverage and quotas apply. Connecting a key does not prevent fallback to public prices if that key's price dataset is unavailable.

## Research and evaluate

- **Research** displays weekly prices, timestamped fundamentals, and experimental forecasts. Load sourced headlines, reported EPS, upcoming earnings dates, or quarterly financial summaries. Summaries align the income statement, balance sheet, and cash-flow statement by quarter and currency, keep missing values unknown, and use up to three uncached provider requests.
- **Compare** shows two to four stocks side by side, including sales growth, profitability, valuation, and forecast errors. Each column shows its own reporting dates.
- **Model lab** ranks six candidate models on earlier validation data. It reports the selected model’s performance on a later 52-origin test, shows interval coverage and sensitivities, and exports the complete backtest.
- **Forecast log** records the selected ticker and horizon before the target day. Repeated saves preserve the original estimate. Select **Check outcomes** after a target week finishes. The result uses adjusted returns. Issuance and outcome checks run on demand.
- **Portfolio** stores up to 30 USD stock lots with quantities and cost per share. Refresh valuations to see unrealized gains, sector exposure, and concentration. The return, volatility, and drawdown analysis uses hypothetical weekly rebalancing at today’s weights across shared observations. Unpriced lots are shown separately.
- **Watchlist** syncs saved tickers to the signed-in workspace.
- **Screener** filters the expanded directory by available sector group, recorded
  price, four-week adjusted return, annualized volatility, and Python baseline
  performance. P/E and year-over-year quarterly revenue-growth filters use cached
  reported fundamentals. Load one company's fundamentals on demand with a key;
  each uncached load uses one provider request. Missing values stay unknown.
  Sort results, browse 100 rows per page, open company research, or export all filtered rows as CSV. Unclassified sectors and missing price/metric values remain explicit.
- **Paper trading** starts a separate virtual account with $100,000. Review a
  saved closing quote before a simulated buy or sell. Cash, fractional shares,
  realized gains and order history persist privately. Orders cannot overdraw
  cash or short shares, and duplicate request IDs cannot create duplicate fills.
  SPY adjusted-price returns provide a dated benchmark from account creation.
  Quotes older than seven days, or missing corporate-action data, pause new trades. New orders include a $1 simulated fee and 0.05% adverse slippage, disclosed before confirmation. Reported splits preserve cost basis and adjust share counts; reported dividends credit eligible holdings once. Credits occur on ex-date in this simulation, not the actual broker payment date. Shares round to six decimals. Taxes, reinvestment, mergers, spinoffs, delisting settlement, and retroactive provider corrections are not modeled. This is not live execution.

Forecast inputs, chronological splits, scoring, and limitations are documented in [the model methodology](docs/model.md). Model selection and validation run separately for each symbol and horizon. The no-change baseline is eligible to win. Publisher summaries and company data provide research context. They do not enter the numeric model.

## Python model research

The [Python training pipeline](ml/README.md) trains scikit-learn ridge and gradient
boosting models, compares them with no-change and historical-mean baselines, and
exports fitted models plus chronological backtest reports. It supports one- and
four-week horizons using the app's dated weekly price snapshots. Python results
appear alongside the JavaScript forecast in **Model lab** for eligible companies across the directory. Training requires at least 180 contiguous completed weeks; newer listings may have a chart but no Python forecast. Scheduled jobs retrain when the completed-week origin changes. Old origins are flagged; visiting the app does not retrain Python.
The forecast card and forecast log continue to use the JavaScript engine.

Model lab separates 52-origin historical backtests from forecasts recorded before their outcomes. It shows four 13-origin periods and a 95% moving-block bootstrap interval for the error difference against no change. Forward records start when the scheduled pipeline is enabled and settle only after the target week has ended. They are not fabricated from historical backtests. Current listing selection and revised adjusted prices introduce survivorship and revision bias; the UI explains those limits.

## Automatic data updates

[Market-data workflow](.github/workflows/market-data.yml) refreshes the Nasdaq Trader directory, Yahoo price histories and headline links, eligible Python reports, and forward outcomes. Runs are scheduled at **23:37 UTC Monday–Friday** and **09:37 UTC Saturday** (5:37 p.m. and 3:37 a.m. Chicago standard time; local times shift with daylight saving). Eight disjoint jobs partition the universe. Unchanged completed-week models are reused. Each row retains its own retrieval and observation dates; unsuccessful fetches keep previous data. Scheduled Actions can be delayed or disabled by GitHub, so consult the workflow run status when dates stop advancing.

Only public market data is pushed to the separate `market-data` branch using GitHub's job-scoped token. User accounts, API keys, portfolios, and watchlists never enter it. The runtime reads that branch without publishing a new app version. The initial completed run obtained 5,709 histories (including the SPY benchmark) and 1-week Python reports for 4,510 company listings from a 5,754-company directory; these counts change over time. Missing histories and insufficient histories are not presented as valid forecasts.

## Local development

Requires Node.js 22.13+, npm, and Python 3.11–3.13 with `ml/requirements.txt`
installed (see the Python setup instructions). From the repository root:

```sh
npm ci
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_cool_warstar.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_real_bloodstrike.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0002_curvy_bulldozer.sql
npm run dev
```

Apply each migration once to a new local database. Open the local URL printed by the dev server. Local development uses the bundled Sites sign-in simulator. The predev script creates an ignored encryption key in .dev.vars. Retain it to keep previously saved local keys readable. For a hosted installation, configure APP_ENCRYPTION_KEY as a base64-encoded, 32-byte secret and provision the D1 binding declared in .openai/hosting.json. ALPHA_VANTAGE_API_KEY is an optional server-wide fallback.

## Verification

```sh
npm run typecheck
npm test
npm run build
```

GitHub Actions runs these checks for changes to main and pull requests. Tests cover time-series leakage, matured target boundaries, stable model selection, provider validation, encrypted key isolation, holiday-week settlement, and partially priced portfolios.

A separate CI job tests the Python pipeline on Python 3.11 and 3.13, including
future-data isolation, purged splits, baseline scoring, and artifact round trips.

With a built local Worker on port 5186, `scripts/check-universe-api.mjs`, `scripts/check-research-api.mjs`, `scripts/check-screener-api.mjs`, `scripts/check-paper-api.mjs`, and `scripts/check-paper-actions.mjs` exercise the real HTTP routes. Integration identities and corporate-action fixtures are local-only. The last script removes its synthetic fixtures after verification. Never send local test identity headers to a hosted app.

## Development workflow

Verify, commit, and push each finished milestone independently before starting the next. Source code does not contain user holdings, saved forecasts, or provider keys.
