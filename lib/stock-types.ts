export type PricePoint = { date: string; close: number; adjusted: number; volume: number };
export type Overview = {
  symbol: string; name: string; description: string; exchange: string; currency: string; sector: string;
  latestQuarter: string | null; marketCap: number | null; pe: number | null; eps: number | null;
  revenue: number | null; profitMargin: number | null; dividendYield: number | null;
  beta: number | null; high52: number | null; low52: number | null;
};
export type StockData = {
  symbol: string; prices: PricePoint[]; overview: Overview | null;
  source: string; demo: boolean; fetchedAt: string; warning: string | null;
};
