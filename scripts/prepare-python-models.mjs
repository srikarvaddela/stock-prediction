import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import catalog from "../lib/stock-picker.json" with { type: "json" };
const python =
  process.env.PYTHON ||
  (existsSync(".venv/Scripts/python.exe")
    ? ".venv/Scripts/python.exe"
    : existsSync(".venv/bin/python")
      ? ".venv/bin/python"
      : "python");
const symbols = Object.keys(catalog);
// Missing histories fail publication instead of silently dropping trained companies.
for (const s of symbols) await access(".market-snapshots/" + s + ".json");
const hash = createHash("sha256");
for (const f of ["ml/pipeline.py", "ml/train.py", "ml/requirements.txt"])
  hash.update(await readFile(f));
const today = new Date().toISOString().slice(0, 10);
hash.update(today);
for (const s of symbols)
  hash.update(await readFile(".market-snapshots/" + s + ".json"));
const signature = hash.digest("hex");
let current;
try {
  current = JSON.parse(
    await readFile(".python-forecasts/manifest.json", "utf8"),
  );
} catch {}
if (
  current?.signature === signature &&
  symbols.every((s) =>
    [1, 4].every((h) => existsSync(`.python-forecasts/${s}-${h}.json`)),
  )
) {
  console.log("Python forecasts already match the input histories.");
  process.exit(0);
}
const trained = spawnSync(
  python,
  [
    "-m",
    "ml.train",
    "--symbols",
    ...symbols,
    "--horizons",
    "1",
    "4",
    "--as-of",
    today,
  ],
  { stdio: "inherit" },
);
if (trained.error || trained.status !== 0)
  throw new Error(
    "Python training failed. Install ml/requirements.txt in Python 3.11–3.13.",
  );
await mkdir(".python-forecasts", { recursive: true });
for (const symbol of symbols)
  for (const horizon of [1, 4]) {
    const r = JSON.parse(
      await readFile(`ml/artifacts/${symbol}/${horizon}w/report.json`, "utf8"),
    );
    const digest = createHash("sha256")
      .update(await readFile(`.market-snapshots/${symbol}.json`))
      .digest("hex");
    if (
      r.symbol !== symbol ||
      r.horizon !== horizon ||
      r.dataset.sha256 !== digest
    )
      throw new Error("Python report provenance mismatch.");
    r.usage =
      "Published Python training result. Re-trained when the application is published.";
    await writeFile(
      `.python-forecasts/${symbol}-${horizon}.json`,
      JSON.stringify(r),
    );
  }
await writeFile(
  ".python-forecasts/manifest.json",
  JSON.stringify({ signature, symbols, trainedOn: today }),
);
