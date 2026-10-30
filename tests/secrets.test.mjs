import test from "node:test";
import assert from "node:assert/strict";
import { encryptSecret, decryptSecret } from "../lib/secrets.mjs";
const master = Buffer.alloc(32, 7).toString("base64");
test("API keys are encrypted, round-trip, and are bound to their owner", async () => {
  const cipher = await encryptSecret("TESTONLY-EXAMPLE", master, "owner-a");
  assert.ok(!cipher.includes("TESTONLY"));
  assert.equal(
    await decryptSecret(cipher, master, "owner-a"),
    "TESTONLY-EXAMPLE",
  );
  await assert.rejects(() => decryptSecret(cipher, master, "owner-b"));
  assert.notEqual(
    cipher,
    await encryptSecret("TESTONLY-EXAMPLE", master, "owner-a"),
  );
});
