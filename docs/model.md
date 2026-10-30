# Forecast methodology — v2.0.0

The engine trains bounded numeric models on historical weekly prices. It does not ask a language model to invent a target price.

## Models and horizons

Direct 1-week and 4-week adjusted log-return models compete: no change, historical mean, ridge regression (penalties 10 and 100), 16-stage gradient-boosted regression stumps, and an equal ridge/boosting ensemble. Five features use only past prices: 1-, 4-, and 12-week returns, distance from a 12-week moving average, and 12-week volatility.

At least 180 completed weekly observations are required; at most 320 are used. The current week is excluded. Gaps longer than ten days fail validation. Standardization is fit only on each training window. Ridge intercepts are not penalized. Boosting uses fixed parameters and training-only quartile thresholds.

## Selection, calibration, and testing

An earlier 26-origin validation period selects the lowest-return-MAE candidate. Selection may choose the no-change baseline. The selected family stays fixed during later evaluation, while its parameters are retrained at each origin on matured targets.

A distinct 26-origin calibration period sets an empirical 80% error-band radius. A final 52-origin test evaluates the selected candidate and interval coverage. Boundaries are purged by the forecast horizon: no label used in one stage can mature after the next stage starts. Every fit only uses targets whose dates are at or before the forecast origin.

The current forecast is fit on all matured labels. Its band is recalibrated on the latest 26 completed test errors. Coverage displayed in the UI belongs to the independent historical test with the earlier fixed radius. Nominal coverage is not guaranteed, particularly with correlated/overlapping four-week outcomes.

## Output and interpretation

MAE and RMSE are measured in simple-return percentage points; the baseline predicts zero return. Direction accuracy is retrospective, not a probability for the next forecast. The UI includes validation rankings, individual test results, an export, and sensitivity to replacing each feature with its training average. Sensitivities are not causal attributions.

Price equivalents apply predicted adjusted returns to the latest completed raw close. Adjusted returns reflect dividends and splits; this is not a forecast of corporate actions. Targets are labeled by calendar week ending Friday. Stale estimates are marked historical.

## Limits

Provider history can be revised and is not a point-in-time archive. This is a chronological simulation, not an audited live performance record. Independent prospective forecast storage is needed for that. News and fundamentals are separate research context, not model inputs. Fees, slippage, taxes, execution, and portfolio effects are excluded. No profitability is claimed. Model performance on one stock does not establish performance across the market.
