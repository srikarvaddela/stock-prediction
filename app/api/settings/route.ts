import { env } from "cloudflare:workers";
import { encryptSecret } from "@/lib/secrets.mjs";
import {
  database,
  identity,
  jsonBody,
  failure,
  privateJson,
  HttpError,
} from "@/lib/server";
export async function GET() {
  try {
    const owner = await identity();
    const row = await database()
      .prepare(
        "SELECT key_cipher, daily_limit FROM preferences WHERE user_id=?",
      )
      .bind(owner)
      .first<{ key_cipher: string | null; daily_limit: number }>();
    const day = new Date().toISOString().slice(0, 10);
    const used = await database()
      .prepare("SELECT calls FROM provider_usage WHERE id=?")
      .bind(`${owner}:${day}`)
      .first<{ calls: number }>();
    return privateJson({
      configured: !!(row?.key_cipher || env.ALPHA_VANTAGE_API_KEY),
      canSaveKey: !!env.APP_ENCRYPTION_KEY,
      dailyLimit: row?.daily_limit ?? 25,
      callsToday: used?.calls ?? 0,
      day,
      source: row?.key_cipher
        ? "personal"
        : env.ALPHA_VANTAGE_API_KEY
          ? "server"
          : "demo",
    });
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request: Request) {
  try {
    const owner = await identity(request),
      body = await jsonBody(request),
      db = database();
    const limit = Number(body.dailyLimit ?? 25);
    if (!Number.isInteger(limit) || limit < 1 || limit > 10000)
      throw new HttpError(
        400,
        "Choose a daily request budget between 1 and 10000.",
      );
    let cipher: string | null = null;
    if (body.remove !== true) {
      if (
        typeof body.apiKey !== "string" ||
        !/^[a-zA-Z0-9_-]{8,128}$/.test(body.apiKey)
      )
        throw new HttpError(400, "Enter a valid API key.");
      if (!env.APP_ENCRYPTION_KEY)
        throw new HttpError(
          503,
          "Encrypted key storage is not configured yet.",
        );
      cipher = await encryptSecret(body.apiKey, env.APP_ENCRYPTION_KEY, owner);
    }
    await db.batch([
      db
        .prepare(
          "INSERT INTO preferences(user_id,key_cipher,daily_limit,updated_at) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET key_cipher=excluded.key_cipher,daily_limit=excluded.daily_limit,updated_at=excluded.updated_at",
        )
        .bind(owner, cipher, limit, new Date().toISOString()),
      db.prepare("DELETE FROM market_cache WHERE owner_id=?").bind(owner),
    ]);
    return privateJson({ saved: true, configured: !!cipher });
  } catch (e) {
    return failure(e);
  }
}
