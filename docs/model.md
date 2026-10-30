# Forecast methodology

This first model is an experimental ridge regression, not an LLM generating price targets. It is trained on the selected stock each time new market data is loaded, with results cached alongside the data.

## Inputs and target

- At most 260 completed weekly observations; at least 120 are required.
- Five features: one-, four-, and twelve-week log returns, log distance from a twelve-week price average, and twelve-week log-return volatility.
- Target: the following week's adjusted log return.
- All observations in the current calendar week are excluded. History with a gap exceeding ten days is not modeled.
- Historical adjusted prices account for splits/dividends. The chart separately displays raw closing prices.

## Training and evaluation

Features are standardized using training data only. A fixed ridge penalty of 10 is applied to the slopes; the intercept is the training target mean. No parameter selection uses the evaluation window.

The latest 52 eligible origins are evaluated with an expanding training window. At each origin, training labels end at that origin and the prediction is scored against the following weekly observation. The model is then refit on all available labeled history for the latest forecast.

Metrics are mean absolute error in simple returns (displayed as percentage points) and historical direction accuracy. The benchmark predicts zero return. The interface explicitly reports when the model does not beat it. The backtest table contains individual predicted and observed returns, allowing the score to be inspected.

## Forecast interpretation

The displayed price-equivalent estimate is the last completed week's raw close multiplied by the exponential of the predicted adjusted log return. It is not a prediction of future splits or dividends. The target is labeled by its calendar week ending Friday; market holidays are not forecast. Stale estimates are marked historical.

The displayed band uses the 80th percentile of absolute out-of-sample log-return errors. It is an empirical uncertainty illustration, not a calibrated 80% confidence/probability interval. Coverage is not independently validated.

## Limits

The historical data is the provider's current revised series, not a point-in-time archive. This is a chronological simulation, not an audited live performance record. One stock and a small evaluation window provide weak evidence of predictive value. Results exclude execution, fees, slippage, taxes, portfolio effects, fundamentals, news, and economic regime changes. No trading performance or profitability is claimed.

Future work: prospective forecast storage, broader cross-stock evaluation, better baselines, and an independent untouched test period before any model selection.
