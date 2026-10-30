import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function database() {
  if (!env.DB) throw new HttpError(503, "Cloud storage is not ready.");
  return env.DB;
}
export async function identity(request?: Request) {
  const user = await getChatGPTUser();
  if (!user)
    throw new HttpError(401, "Sign in to use your research workspace.");
  if (request && request.method !== "GET") {
    if (request.headers.get("origin") !== new URL(request.url).origin)
      throw new HttpError(403, "This action must originate from this app.");
    if (!request.headers.get("content-type")?.startsWith("application/json"))
      throw new HttpError(415, "Send JSON.");
  }
  return user.userId;
}
export async function jsonBody(request: Request) {
  const raw = await request.text();
  if (raw.length > 100000)
    throw new HttpError(413, "The request is too large.");
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new HttpError(400, "Invalid JSON.");
  }
}
export function failure(error: unknown) {
  return Response.json(
    {
      error:
        error instanceof HttpError
          ? error.message
          : "This request could not be completed. Please try again.",
    },
    {
      status: error instanceof HttpError ? error.status : 500,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
export function privateJson(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
