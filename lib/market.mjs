export const validSymbol = value => typeof value === 'string' && /^[A-Z][A-Z0-9.-]{0,9}$/.test(value);

export function parseWeekly(payload) {
  const series = payload?.['Weekly Adjusted Time Series'];
  if (!series || typeof series !== 'object') throw new Error('Weekly price data is unavailable. The provider may have reached its request limit.');
  const points = Object.entries(series).map(([date, row]) => ({
    date, close: Number(row['4. close']), adjusted: Number(row['5. adjusted close']), volume: Number(row['6. volume']),
  })).filter(p => /^\d{4}-\d{2}-\d{2}$/.test(p.date) && Number.isFinite(p.close) && p.close > 0 && Number.isFinite(p.adjusted) && p.adjusted > 0 && Number.isFinite(p.volume) && p.volume >= 0).sort((a,b)=>a.date.localeCompare(b.date));
  if (points.length < 2) throw new Error('The provider returned insufficient valid price history.');
  return points.slice(-520);
}

export function parseOverview(payload, symbol) {
  if (payload?.Symbol !== symbol) return null;
  const numeric = key => { const value=Number(payload[key]); return payload[key] && Number.isFinite(value) ? value : null; };
  return {
    symbol, name: payload.Name || symbol, description: payload.Description || '',
    exchange: payload.Exchange || '', currency: payload.Currency || 'USD', sector: payload.Sector || 'Not available',
    latestQuarter: payload.LatestQuarter || null,
    marketCap: numeric('MarketCapitalization'), pe: numeric('PERatio'), eps: numeric('EPS'),
    revenue: numeric('RevenueTTM'), profitMargin: numeric('ProfitMargin'), dividendYield: numeric('DividendYield'),
    beta: numeric('Beta'), high52: numeric('52WeekHigh'), low52: numeric('52WeekLow'),
  };
}
