import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export function getDb() {
  if (!env.DB) throw new Error("The MetaEdit D1 binding is unavailable.");
  return drizzle(env.DB, { schema });
}

export function getD1(): D1Database {
  if (!env.DB) throw new Error("The MetaEdit D1 binding is unavailable.");
  return env.DB;
}

export function getRuntimeSecret(name: "METAEDIT_SESSION_TOKEN_HASH" | "METAEDIT_COOKIE_SECRET") {
  return env[name] ?? process.env[name];
}
