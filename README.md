# Stock Prediction

A private stock research workspace with one- and four-week forecasts. The public GitHub repository contains the application source. [Open the hosted app](https://stock-prediction-srikar.shoyo722.chatgpt.site).

## Start in the app

Choose Apple, Microsoft, NVIDIA, Amazon, Alphabet, or IBM under **Stocks to explore**. Historical prices and forecasts for these stocks work without a personal key. Search can also load other supported US equities when the public feed is available. A chart identifies its price source, last observation date, and any saved-history fallback.

IBM uses the Alpha Vantage demo. Other no-key prices use Yahoo Finance chart history, with daily observations rolled into trading weeks. At build time the app saves a dated fallback for the five featured non-IBM stocks. To connect additional company fundamentals, news, and earnings, save an [Alpha Vantage key](https://www.alphavantage.co/support/#api-key) in **Settings**. Provider coverage and quotas apply.

## Research and evaluate

- **Research** displays weekly closing prices, timestamped company fundamentals, and an experimental forecast. Load sourced news, reported EPS, or expected earnings dates on demand.
- **Compare** shows two to four stocks side by side, including sales growth, profitability, valuation, and forecast errors. Each column shows its own reporting dates.
- **Model lab** ranks six candidate models on earlier validation data. It reports the selected model’s performance on a later 52-origin test, shows interval coverage and sensitivities, and exports the complete backtest.
- **Forecast log** records the selected ticker and horizon before the target day. Repeated saves preserve the original estimate. Select **Check outcomes** after a target week finishes. The result uses adjusted returns. Issuance and outcome checks run on demand.
- **Portfolio** stores up to 30 USD stock lots with quantities and cost per share. Refresh valuations to see unrealized gains, sector exposure, and concentration. The return, volatility, and drawdown analysis uses hypothetical weekly rebalancing at today’s weights across shared observations. Unpriced lots are shown separately.
- **Watchlist** syncs saved tickers to the signed-in workspace.

Forecast inputs, chronological splits, scoring, and limitations are documented in [the model methodology](docs/model.md). Model selection and validation run separately for each symbol and horizon. The no-change baseline is eligible to win. Publisher summaries and company data provide research context. They do not enter the numeric model.

## Local development

Requires Node.js 22.13+ and npm. From the repository root:

```sh
npm ci
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_cool_warstar.sql
npm run dev
```

Apply the migration once to a new local database. Open the local URL printed by the dev server. Local development uses the bundled Sites sign-in simulator. The predev script creates an ignored encryption key in .dev.vars. Retain it to keep previously saved local keys readable. For a hosted installation, configure APP_ENCRYPTION_KEY as a base64-encoded, 32-byte secret and provision the D1 binding declared in .openai/hosting.json. ALPHA_VANTAGE_API_KEY is an optional server-wide fallback.

## Verification

```sh
npm run typecheck
npm test
npm run build
```

GitHub Actions runs these checks for changes to main and pull requests. Tests cover time-series leakage, matured target boundaries, stable model selection, provider validation, encrypted key isolation, holiday-week settlement, and partially priced portfolios.

## Development workflow

Verify, commit, and push each finished milestone independently before starting the next. Source code does not contain user holdings, saved forecasts, or provider keys.
