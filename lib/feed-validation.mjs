export function validSnapshot(data, symbol) {
  if (!data || data.symbol !== symbol || !Array.isArray(data.prices) || data.prices.length < 2 || data.prices.length > 520 || !Number.isFinite(Date.parse(data.fetchedAt))) return false;
  let previous = "";
  return data.prices.every(p => {
    const ok = /^\d{4}-\d{2}-\d{2}$/.test(p.date) && p.date > previous && [p.close,p.adjusted].every(n=>Number.isFinite(n)&&n>0) && Number.isFinite(p.volume) && p.volume>=0;
    previous=p.date; return ok;
  });
}
