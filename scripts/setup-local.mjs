import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
const path = ".dev.vars";
const text = existsSync(path) ? readFileSync(path, "utf8") : "";
if (!/^APP_ENCRYPTION_KEY=.+/m.test(text)) {
  writeFileSync(
    path,
    text + "\nAPP_ENCRYPTION_KEY=" + randomBytes(32).toString("base64") + "\n",
  );
  console.log("Initialized an ignored local encryption key.");
}
