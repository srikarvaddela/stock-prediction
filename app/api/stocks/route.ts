import { identity, failure, privateJson } from "@/lib/server";
import { loadStock } from "@/lib/stocks";
export async function GET(request: Request) {
  try {
    const owner = await identity(),
      params = new URL(request.url).searchParams;
    return privateJson(
      await loadStock(
        owner,
        (params.get("symbol") || "IBM").trim().toUpperCase(),
        Number(params.get("horizon") || 1),
      ),
    );
  } catch (e) {
    return failure(e);
  }
}
