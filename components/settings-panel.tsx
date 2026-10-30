"use client";
import { useEffect, useState } from "react";
import { KeyRound, ShieldCheck, ArrowUpRight } from "lucide-react";
type Status = {
  configured: boolean;
  canSaveKey: boolean;
  dailyLimit: number;
  callsToday: number;
  day: string;
  source: string;
};
export function SettingsPanel({ onConnected }: { onConnected: () => void }) {
  const [status, setStatus] = useState<Status | null>(null),
    [apiKey, setApiKey] = useState(""),
    [limit, setLimit] = useState(25),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const refresh = async () => {
    const response = await fetch("/api/settings");
    const result = (await response.json()) as Status & { error?: string };
    if (!response.ok) throw new Error(result.error);
    setStatus(result);
    setLimit(result.dailyLimit);
  };
  useEffect(() => {
    refresh().catch((e) => setMessage(e.message));
  }, []);
  async function save(remove = false) {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey, dailyLimit: limit, remove }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error);
      setApiKey("");
      await refresh();
      onConnected();
      setMessage(
        remove
          ? "Personal key removed."
          : "Key saved securely. Use Test connection to verify provider access.",
      );
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function testConnection() {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/stocks?symbol=IBM");
      const data = (await r.json()) as { error?: string; prices?: unknown[] };
      if (!r.ok) throw new Error(data.error);
      setMessage(
        `Connection works. Loaded ${data.prices?.length} weekly observations for IBM.`,
      );
      await refresh();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel settings-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">CONNECT YOUR DATA</p>
          <h2>Your market-data connection</h2>
        </div>
        <KeyRound size={23} />
      </div>
      <p className="section-copy">
        Connect Alpha Vantage to research stocks beyond IBM. Your key is
        encrypted on the server and is never returned to the browser.
      </p>
      <div className="connection-status">
        <ShieldCheck size={19} />
        <div>
          <strong>
            {status?.configured ? "API key configured" : "Using the IBM demo"}
          </strong>
          <p>
            {status
              ? `${status.callsToday} of ${status.dailyLimit} configured requests used today (${status.day}, UTC)`
              : "Checking your connection…"}
          </p>
        </div>
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <label className="field-label">
          Alpha Vantage API key
          <input
            type="password"
            autoComplete="off"
            spellCheck={false}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={
              status?.configured
                ? "Enter a new key to replace the saved key"
                : "Paste your key here"
            }
            required
            minLength={8}
            maxLength={128}
          />
        </label>
        <label className="field-label">
          Daily request budget
          <input
            type="number"
            min={1}
            max={10000}
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
          />
        </label>
        <p className="form-hint">
          The standard free plan allows 25 requests per day. Increasing this
          app’s budget does not upgrade your provider plan. Cached responses do
          not consume additional requests.
        </p>
        <div className="button-row">
          <button
            className="primary-button"
            disabled={busy || !status?.canSaveKey}
            type="submit"
          >
            {busy ? "Working…" : "Save encrypted key"}
          </button>
          <button
            className="secondary-button"
            type="button"
            disabled={busy}
            onClick={testConnection}
          >
            Test connection
          </button>
          {status?.source === "personal" && (
            <button
              type="button"
              className="text-button"
              disabled={busy}
              onClick={() => save(true)}
            >
              Remove saved key
            </button>
          )}
        </div>
      </form>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      <a
        className="text-button"
        href="https://www.alphavantage.co/support/#api-key"
        target="_blank"
        rel="noreferrer"
      >
        Get a free Alpha Vantage key <ArrowUpRight size={14} />
      </a>
      <p className="form-hint">
        Price history and fundamentals use separate requests. News and earnings
        are loaded only when you ask for them. Provider availability and
        subscriptions may restrict some datasets.
      </p>
    </section>
  );
}
