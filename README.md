# Stock Prediction

Research real stocks and inspect experimental machine-learning forecasts with transparent historical evaluation.

## What works

- Real weekly price history with 3-month, 6-month, 1-year, and 5-year charts.
- Company descriptions, market capitalization, P/E, revenue, margins, dividends, and earnings per share.
- Stock search with explicit provider/configuration errors.
- A watchlist stored in your browser.
- Weekly ridge-regression forecasts, a historical-error band, and walk-forward backtests against a no-change baseline.
- A model lab explaining the inputs and displaying individual forecast outcomes.

IBM works without configuration using Alpha Vantage's real provider demo data. Other tickers need your own market-data API key. This is historical weekly data, not a live trading feed. The forecast does not use an LLM or require an OpenAI key.

## Run locally

Requires Node.js 22.13+.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5173. To enable other tickers, copy `.dev.vars.example` to `.dev.vars`, set `ALPHA_VANTAGE_API_KEY`, and restart the server. Keep keys server-side; do not paste them into chat or commit them.

For a hosted deployment, configure the same environment variable through the hosting provider's secret settings. Cloudflare Workers and Sites hosting are supported by the included Vinext configuration. The GitHub source repository is public; the Sites preview is owner-private.

## Verify

```sh
npm run typecheck
npm test
npm run build
```

Tests cover provider input validation, missing fundamentals, training cutoff rules, future-data isolation, flat-price stability, and error-metric correctness. GitHub Actions runs these checks on pushes and pull requests.

## Stack and structure

- React + TypeScript, Vinext, Cloudflare Workers.
- `app/page.tsx`: dashboard, search, chart, and browser watchlist.
- `app/api/stocks/route.ts`: server-side provider integration, request spacing, and bounded six-hour caching.
- `lib/market.mjs`: provider normalization and validation.
- `lib/forecast.mjs`: numeric forecasting and chronological evaluation.
- `components/forecast-panel.tsx`: forecast interpretation and backtest report.
- `docs/model.md`: assumptions, formulas, and limitations.

## Incremental delivery

1. Foundation and reproducible setup — pushed independently.
2. Real-data research dashboard and watchlist — verified and pushed independently.
3. Experimental forecasts, backtesting, documentation, and CI — verified and pushed independently.

Continue the same workflow for future changes: complete and verify one meaningful milestone, commit, then push before starting the next. Do not save up the whole project for one final push.

## Next milestones

- Side-by-side stock comparisons and richer company research.
- Prospective forecast tracking stored before outcomes are known.
- Broader model evaluation, stronger baselines, and calibrated uncertainty.
- Optional sourced news summaries, with a separate language-model integration.

## Data and limitations

[Alpha Vantage documentation](https://www.alphavantage.co/documentation/) describes the weekly adjusted history and company overview endpoints. Provider plans, rate limits, and data-use terms apply. With the demo key, only IBM is supported. Market-data and fundamentals failures are surfaced rather than replaced with invented values.

Forecasts are experimental estimates, not guaranteed returns or instructions to trade. A model may underperform the no-change baseline. Review [the model methodology](docs/model.md) before interpreting a result. Browser visual QA was not performed because access to the local preview was declined; build, type checks, unit tests, and server/API integration checks were used instead.
