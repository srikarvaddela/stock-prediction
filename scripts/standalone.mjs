// A separate deployment target; never deploy the Sites configuration to a standalone host.
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { writeLocalGoogleVars } from "./local-google-vars.mjs";
const root = process.cwd();
const action = process.argv[2];
const wrangler = path.join(root, "node_modules/wrangler/bin/wrangler.js");
function run(args, extra = {}) {
  const p = spawnSync(process.execPath, args, {
    cwd: root,
    stdio: "inherit",
    windowsHide: true,
    ...extra,
  });
  if (p.error || p.status !== 0)
    throw new Error("Command failed. Review the preceding diagnostics.");
}
function configuration() {
  const original = JSON.parse(
    readFileSync("dist/server/wrangler.json", "utf8"),
  );
  if (original.vars?.STOCK_AUTH_MODE !== "standalone")
    throw new Error("Build the standalone target first.");
  const settings = existsSync(".stock/cloudflare.json")
    ? JSON.parse(readFileSync(".stock/cloudflare.json", "utf8"))
    : {};
  const config = {
    ...original,
    main: "../dist/server/index.js",
    assets: { ...original.assets, directory: "../dist/client" },
    name: settings.workerName || "stock-prediction",
    vars: {
      STOCK_AUTH_MODE: "standalone",
      ...(settings.origin ? { BETTER_AUTH_URL: settings.origin } : {}),
    },
    workers_dev: true,
    preview_urls: false,
  };
  delete config.services;
  config.d1_databases = (config.d1_databases || []).map((db) => ({
    ...db,
    migrations_dir: "../drizzle",
  }));
  if (settings.accountId) config.account_id = settings.accountId;
  if (settings.databaseId)
    config.d1_databases = [
      {
        binding: "DB",
        database_name: "stock-prediction",
        database_id: settings.databaseId,
        migrations_dir: "../drizzle",
      },
    ];
  mkdirSync(".stock", { recursive: true });
  writeFileSync(".stock/wrangler.json", JSON.stringify(config, null, 2) + "\n");
  return { settings, config };
}
try {
  if (action === "build") {
    run(["scripts/run-framework.mjs", "build"], {
      env: { ...process.env, STOCK_BUILD_TARGET: "standalone" },
    });
    configuration();
    writeLocalGoogleVars();
    console.log(
      "Standalone build ready. Local preview: npm run start:standalone",
    );
  } else if (action === "start") {
    configuration();
    writeLocalGoogleVars();
    run([
      "--import",
      "./scripts/sites-env.mjs",
      wrangler,
      "d1",
      "migrations",
      "apply",
      "DB",
      "--local",
      "--config",
      ".stock/wrangler.json",
      "--persist-to",
      ".stock/state",
    ]);
    run([
      "--import",
      "./scripts/sites-env.mjs",
      wrangler,
      "dev",
      "--config",
      ".stock/wrangler.json",
      "--local",
      "--persist-to",
      ".stock/state",
      "--ip",
      "127.0.0.1",
      "--port",
      "8790",
      "--inspector-port",
      "0",
    ]);
  } else if (action === "deploy" || action === "migrate") {
    const { settings } = configuration();
    if (
      !/^[a-f0-9]{32}$/.test(settings.accountId || "") ||
      !/^[a-f0-9-]{36}$/.test(settings.databaseId || "")
    )
      throw new Error(
        "Configure your accountId and databaseId in ignored .stock/cloudflare.json first. See docs/google-sign-in.md.",
      );
    if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(settings.workerName || ""))
      throw new Error("Configure a valid workerName.");
    if (action === "migrate")
      run([
        "--import",
        "./scripts/sites-env.mjs",
        wrangler,
        "d1",
        "migrations",
        "apply",
        "DB",
        "--remote",
        "--config",
        ".stock/wrangler.json",
      ]);
    else
      run([
        "--import",
        "./scripts/sites-env.mjs",
        wrangler,
        "deploy",
        "--config",
        ".stock/wrangler.json",
      ]);
  } else throw new Error("Expected build, start, migrate, or deploy.");
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
