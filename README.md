# Stock Prediction

A web app for researching real stocks and evaluating machine-learning price forecasts.

## Development

Requires Node.js 22.13+.

```sh
npm ci
npm run dev
```

Open http://localhost:5173. Built with React, TypeScript, and Vinext; the server can run on Cloudflare Workers.

## Milestones

1. Project foundation and reproducible setup.
2. Stock research dashboard, market data integration, and local watchlist.
3. Experimental machine-learning forecasts with chronological backtesting and a no-change baseline.

Each completed milestone is verified, committed, and pushed separately. Never combine multiple completed milestones into a single final push.

## Data and forecasts

Market data comes from Alpha Vantage. The public demo supports IBM; an API key is required for other stocks. The application must label data timestamps and distinguish provider data from model estimates. Forecasts are experimental estimates, not guaranteed returns or trade instructions.

Provider documentation: https://www.alphavantage.co/documentation/

## Repository hygiene

Do not commit API keys, credentials, local environment files, node_modules, or build artifacts.
