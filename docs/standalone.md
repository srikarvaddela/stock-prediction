# Standalone Cloudflare deployment

Stock Prediction has two separate deployment targets. The default Sites build uses platform-managed ChatGPT identity. The standalone build uses Google OAuth, database-backed Better Auth sessions, and a separate Cloudflare D1 database. Unknown or absent auth modes fail closed; standalone requests never trust Sites identity headers.

## Setup

1. Authenticate Wrangler in the Cloudflare account you intend to use.
2. Create a D1 database. Record its actual `accountId`, `databaseId`, `workerName`, and HTTPS `origin` in ignored `.stock/cloudflare.json`.
3. Create ignored `.stock/google-secrets.json` with `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, a unique random `BETTER_AUTH_SECRET` of at least 32 characters, and `APP_ENCRYPTION_KEY` containing exactly 32 random bytes encoded as standard Base64. Do not reuse session or encryption keys from another app.
4. Register the production origin and exact `/api/auth/callback/google` URL on the Google OAuth web client. Keep any existing application origins/callbacks. If the Google app is in testing mode, intended users must be added to its test-user list. The current setup uses the owner's existing OAuth client; its consent-screen branding belongs to that Google project.
5. Run `npm run build:standalone`, `npm run db:standalone`, and upload the ignored secrets JSON using `wrangler secret bulk --config .stock/wrangler.json`. Pass secret files by path; do not put their values in arguments, source, or logs.
6. Run `npm run deploy:standalone`. Confirm actual sign-in, private workspace reads, sign-out, and anonymous rejection before updating any portfolio link.

For local preview, `npm run start:standalone` uses `http://localhost:8790` and isolated `.stock/state`. Register that exact callback if testing live Google locally. Local variables are generated from the ignored secrets file.

## Validation

`npm run typecheck` and `npm test` cover existing application behavior. After a standalone build, run `node scripts/check-standalone-auth.mjs`. It applies migrations to an isolated local test database and uses synthetic signed sessions to check authentication, account isolation, forged/expired/revoked sessions, spoofed identity headers, origin checks, Google authorization state and PKCE, and callback restrictions. It makes no Google token exchange and cannot prove that the provider allowlist is configured correctly.

Production APIs return `Cache-Control: no-store` for private data. Sessions use the auth provider's signed cookies and server-side database validation. API-key encryption remains bound to the acting account. Authentication rate limits use an atomic D1 claim. No passwords or automatic linking by matching an unverified email are enabled.

## Existing Sites records

The original hosted app and its database are retained. Sites user IDs and standalone Google user IDs are different; records must not be reassigned based on a client-supplied identity or an assumed email match.

At migration inspection, the original app had no holdings, forecast records, paper accounts, or paper trades. It had two preferences rows, both with the default `["IBM"]` watchlist and no saved API key. Preserve those preference rows under their original IDs in the new database as retained legacy records; they are not automatically granted to a new Google account. New accounts start with the same default watchlist. If non-default private records are added to the original app later, their transfer requires proof of control of both accounts before any ownership mapping.

Public market cache entries and provider-usage counters are not personal records and are not copied. The standalone app reads the existing public GitHub market-data feed and rebuilds cache entries as needed.

## Public guest access

The shared Google consent app remains in Testing mode. Public visitors can start a private guest workspace without Google. Better Auth creates a unique server-side user/session and an HttpOnly signed cookie. Guest creation is limited to 20 per IP per hour. Guest records are isolated by the same account-scoped APIs as Google records and never inherit migrated Sites records. Access lasts while the cookie/session remains valid (up to seven days); signing out or clearing cookies ends access. Guest-to-Google data transfer is not implemented. The optional Google preview is restricted to accounts allowed by the provider configuration.
