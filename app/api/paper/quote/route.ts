import { identity, privateJson, failure } from "@/lib/server";
import { stockSymbol } from "@/lib/company-search.mjs";
import { paperQuote } from "@/lib/paper-server";
export async function GET(request: Request) {
  try {
    await identity();
    return privateJson(
      paperQuote(
        stockSymbol(new URL(request.url).searchParams.get("symbol") || ""),
      ),
    );
  } catch (e) {
    return failure(e);
  }
}
