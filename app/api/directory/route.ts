import directory from "@/lib/stock-directory.json";
import { searchDirectory } from "@/lib/directory.mjs";
import { identity, failure, privateJson } from "@/lib/server";
export async function GET(request: Request) {
  try {
    await identity();
    const q = new URL(request.url).searchParams;
    const rows = searchDirectory(directory.rows, (q.get("q") || "").slice(0,100), q.get("exchange") || "");
    const page = Math.max(0, Math.min(1000, Number(q.get("page")) || 0));
    return privateJson({rows:rows.slice(page*50, page*50+50), total:rows.length, universe:directory.rows.length, fetchedAt:directory.fetchedAt, page});
  } catch(e) { return failure(e); }
}
