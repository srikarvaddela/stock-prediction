/// <reference types="vite/client" />
import type { PricePoint } from "./stock-types";
type Snapshot = {
  symbol: string;
  prices: PricePoint[];
  name: string;
  exchange: string;
  fetchedAt: string;
};
const snapshots = import.meta.glob("../.market-snapshots/*.json", {
  eager: true,
  import: "default",
}) as unknown as Record<string, Snapshot | undefined>;
export function savedHistory(symbol: string) {
  return snapshots["../.market-snapshots/" + symbol + ".json"] ?? null;
}
