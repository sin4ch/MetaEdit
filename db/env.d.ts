declare namespace Cloudflare {
  interface Env {
    DB: D1Database;
    METAEDIT_SESSION_TOKEN_HASH?: string;
    METAEDIT_COOKIE_SECRET?: string;
    GITHUB_TOKEN?: string;
    GITHUB_OWNER?: string;
    GITHUB_REPOSITORY?: string;
    GITHUB_BASE_BRANCH?: string;
  }
}
