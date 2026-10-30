import { env } from "cloudflare:workers";
import { decryptSecret } from "@/lib/secrets.mjs";
import { database, HttpError } from "@/lib/server";
type Credentials = {
  key: string;
  demo: boolean;
  limit: number;
  fingerprint: string;
};
export async function credentials(owner: string): Promise<Credentials> {
  const row = await database()
    .prepare("SELECT key_cipher,daily_limit FROM preferences WHERE user_id=?")
    .bind(owner)
    .first<{ key_cipher: string | null; daily_limit: number }>();
  let key = env.ALPHA_VANTAGE_API_KEY || "demo";
  if (row?.key_cipher) {
    if (!env.APP_ENCRYPTION_KEY)
      throw new HttpError(503, "Encrypted key storage is unavailable.");
    try {
      key = await decryptSecret(row.key_cipher, env.APP_ENCRYPTION_KEY, owner);
    } catch {
      throw new HttpError(
        503,
        "Your saved data key could not be decrypted. Save it again in Settings.",
      );
    }
  }
  const hash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(key),
  );
  const fingerprint = Array.from(new Uint8Array(hash).slice(0, 8), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  return {
    key,
    demo: key === "demo",
    limit: row?.daily_limit ?? 25,
    fingerprint,
  };
}
const pending = new Map<string, Promise<Record<string, unknown>>>();
let queue: Promise<unknown> = Promise.resolve();
export async function providerQuery(
  owner: string,
  creds: Credentials,
  fn: string,
  params: Record<string, string>,
  ttl = 6 * 3600000,
): Promise<Record<string, unknown>> {
  const id = `${owner}:${creds.fingerprint}:${fn}:${new URLSearchParams(params)}`;
  const db = database();
  const saved = await db
    .prepare("SELECT body FROM market_cache WHERE id=? AND expires_at>?")
    .bind(id, Date.now())
    .first<{ body: string }>();
  if (saved) return JSON.parse(saved.body);
  if (pending.has(id)) return pending.get(id)!;
  const task = queue
    .catch(() => {})
    .then(async () => {
      if (!creds.demo) {
        const budget = await db
          .prepare(
            "INSERT INTO provider_usage(id,calls) VALUES(?,1) ON CONFLICT(id) DO UPDATE SET calls=calls+1 WHERE calls<? RETURNING calls",
          )
          .bind(
            `${owner}:${new Date().toISOString().slice(0, 10)}`,
            creds.limit,
          )
          .first();
        if (!budget)
          throw new HttpError(
            429,
            "Your configured daily request budget is used. Cached data remains available; new data resets tomorrow (UTC).",
          );
      }
      const url = new URL("https://www.alphavantage.co/query");
      url.search = new URLSearchParams({
        function: fn,
        ...params,
        apikey: creds.key,
      }).toString();
      try {
        const response = await fetch(url, {
          signal: AbortSignal.timeout(15000),
        });
        if (!response.ok)
          throw new HttpError(502, "The market-data provider is unavailable.");
        const payload = (await response.json()) as Record<string, unknown>;
        if (payload.Information || payload.Note)
          throw new HttpError(
            429,
            "The provider limited this request or this dataset is not included in your plan. Try later or check your key and plan.",
          );
        if (payload["Error Message"])
          throw new HttpError(
            404,
            "The provider did not recognize this ticker or dataset.",
          );
        await db
          .prepare(
            "INSERT INTO market_cache(id,owner_id,body,expires_at) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET body=excluded.body,expires_at=excluded.expires_at",
          )
          .bind(id, owner, JSON.stringify(payload), Date.now() + ttl)
          .run();
        await db
          .prepare("DELETE FROM market_cache WHERE owner_id=? AND expires_at<?")
          .bind(owner, Date.now() - 86400000)
          .run();
        return payload;
      } catch (e) {
        if (e instanceof HttpError) throw e;
        throw new HttpError(
          502,
          "The provider request timed out or failed. Try again later.",
        );
      } finally {
        await new Promise((resolve) => setTimeout(resolve, 650));
      }
    });
  pending.set(id, task);
  queue = task;
  try {
    return await task;
  } finally {
    pending.delete(id);
  }
}
