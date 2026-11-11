import { existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
export function writeLocalGoogleVars() {
  if (!existsSync(".stock/google-secrets.json")) return;
  const saved = JSON.parse(readFileSync(".stock/google-secrets.json", "utf8"));
  const values = { BETTER_AUTH_URL: "http://localhost:8790" };
  for (const key of [
    "BETTER_AUTH_SECRET",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "APP_ENCRYPTION_KEY",
  ]) {
    if (typeof saved[key] !== "string" || !saved[key])
      throw new Error("Incomplete local sign-in configuration.");
    values[key] = saved[key];
  }
  mkdirSync(".stock", { recursive: true });
  writeFileSync(
    ".stock/.dev.vars",
    Object.entries(values)
      .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
      .join("\n") + "\n",
    { mode: 0o600 },
  );
}
