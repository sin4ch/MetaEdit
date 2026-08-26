declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    METAEDIT_SESSION_TOKEN_HASH?: string;
    METAEDIT_COOKIE_SECRET?: string;
  }
}
