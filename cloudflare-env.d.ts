declare namespace Cloudflare {
  interface Env {
    ALPHA_VANTAGE_API_KEY?: string;
    APP_ENCRYPTION_KEY?: string;
    DB?: D1Database;
    BUCKET?: R2Bucket;
  }
}
