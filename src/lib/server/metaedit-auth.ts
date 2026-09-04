import { getRuntimeSecret } from "../../../db";
import { ACTIVE_WINDOW_MS, ensureDatabase, mapCollaborator, WORKSPACE_ID } from "./metaedit-db";
import { getD1 } from "../../../db";
import type { Collaborator } from "@/types/metaedit";

const COOKIE_NAME = "metaedit_session";
const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const DEMO_TOKEN_HASH = "e053d94124812256a0cba1536e35354c5a99b4678da026c5d7f867de7f36574f";
const encoder = new TextEncoder();

function bytesToHex(bytes: Uint8Array) { return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(""); }
function bytesToBase64Url(bytes: Uint8Array) { return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }

async function sha256(value: string) { return bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)))); }
async function signature(value: string) {
  const secret = getRuntimeSecret("METAEDIT_COOKIE_SECRET") ?? "metaedit-local-cookie-secret-change-in-hosting";
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return bytesToBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value))));
}

export async function verifyAccessToken(token: string) {
  const expected = getRuntimeSecret("METAEDIT_SESSION_TOKEN_HASH") ?? DEMO_TOKEN_HASH;
  const actual = await sha256(token);
  if (actual.length !== expected.length) return false;
  let mismatch = 0;
  for (let index = 0; index < actual.length; index++) mismatch |= actual.charCodeAt(index) ^ expected.charCodeAt(index);
  return mismatch === 0;
}

export async function createSessionCookie(collaboratorId: string, expiresAt: number) {
  const payload = bytesToBase64Url(encoder.encode(JSON.stringify({ collaboratorId, expiresAt })));
  return `${payload}.${await signature(payload)}`;
}

export async function readSession(request: Request): Promise<Collaborator | null> {
  await ensureDatabase();
  const cookie = request.headers.get("cookie")?.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${COOKIE_NAME}=`))?.slice(COOKIE_NAME.length + 1);
  if (!cookie) return null;
  const [payload, suppliedSignature] = cookie.split(".");
  if (!payload || !suppliedSignature || suppliedSignature !== await signature(payload)) return null;
  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = JSON.parse(atob(normalized)) as { collaboratorId: string; expiresAt: number };
    if (decoded.expiresAt <= Date.now()) return null;
    const row = await getD1().prepare(`SELECT * FROM collaborators WHERE id = ? AND workspace_id = ? AND session_expires_at > ?`).bind(decoded.collaboratorId, WORKSPACE_ID, Date.now()).first<Record<string, unknown>>();
    return row ? mapCollaborator(row) : null;
  } catch { return null; }
}

export async function requireSession(request: Request) {
  const collaborator = await readSession(request);
  if (!collaborator) throw new Response(JSON.stringify({ error: "Authenticate with the MetaEdit workspace token first." }), { status: 401, headers: { "content-type": "application/json" } });
  await getD1().prepare(`UPDATE collaborators SET last_seen_at = ? WHERE id = ?`).bind(Date.now(), collaborator.id).run();
  return collaborator;
}

export async function createCollaborator(request: Request, displayName: string) {
  await ensureDatabase();
  const d1 = getD1();
  const platformUserId = request.headers.get("oai-authenticated-user-id");
  const email = request.headers.get("oai-authenticated-user-email");
  const encodedName = request.headers.get("oai-authenticated-user-full-name");
  const platformName = encodedName ? safeDecode(encodedName) : null;
  const now = Date.now();
  const expiresAt = now + SESSION_MS;
  const existing = platformUserId ? await d1.prepare(`SELECT * FROM collaborators WHERE platform_user_id = ? AND workspace_id = ?`).bind(platformUserId, WORKSPACE_ID).first<Record<string, unknown>>() : null;
  const activeColorRows = await d1.prepare(`SELECT id, color FROM collaborators WHERE workspace_id = ? AND last_seen_at >= ?`).bind(WORKSPACE_ID, now - ACTIVE_WINDOW_MS).all<{ id: string; color: string }>();
  const activeColors = new Set(activeColorRows.results.map((row) => normalizeColor(row.color)).filter((color): color is string => Boolean(color)));
  if (existing) {
    const existingColor = normalizeColor(existing.color);
    const hasColorConflict = existingColor ? activeColorRows.results.some((row) => String(row.id) !== String(existing.id) && normalizeColor(row.color) === existingColor) : true;
    const color = existingColor && !hasColorConflict ? existingColor : randomAvailableColor(activeColors);
    await d1.prepare(`UPDATE collaborators SET display_name = ?, email = ?, color = ?, session_expires_at = ?, last_seen_at = ?, cursor_x = NULL, cursor_y = NULL WHERE id = ?`).bind(platformName ?? displayName, email, color, expiresAt, now, existing.id).run();
    return { collaborator: { ...mapCollaborator(existing), displayName: platformName ?? displayName, email, color, lastSeenAt: new Date(now).toISOString() }, expiresAt };
  }
  const count = await d1.prepare(`SELECT COUNT(*) AS count FROM collaborators WHERE workspace_id = ?`).bind(WORKSPACE_ID).first<{ count: number }>();
  const collaborator: Collaborator = { id: crypto.randomUUID(), displayName: platformName ?? displayName, email, role: Number(count?.count ?? 0) === 0 ? "owner" : "editor", color: randomAvailableColor(activeColors), lastSeenAt: new Date(now).toISOString() };
  await d1.prepare(`INSERT INTO collaborators (id, workspace_id, platform_user_id, display_name, email, role, color, session_expires_at, last_seen_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(collaborator.id, WORKSPACE_ID, platformUserId, collaborator.displayName, email, collaborator.role, collaborator.color, expiresAt, now, now).run();
  return { collaborator, expiresAt };
}

const COLLABORATOR_COLORS = [
  "#305dde", "#e05275", "#0f9f75", "#d97706", "#8b5cf6", "#0891b2",
  "#db2777", "#65a30d", "#9333ea", "#0284c7", "#ea580c", "#0d9488",
  "#dc2626", "#4f46e5", "#ca8a04", "#be123c", "#15803d", "#7c3aed",
];

function normalizeColor(value: unknown) {
  if (typeof value !== "string" || !/^#[\da-f]{6}$/i.test(value)) return null;
  return value.toLowerCase();
}

function randomAvailableColor(usedColors: Set<string>) {
  const available = COLLABORATOR_COLORS.filter((color) => !usedColors.has(color));
  if (available.length > 0) return available[randomIndex(available.length)];

  for (let attempt = 0; attempt < 64; attempt += 1) {
    const bytes = new Uint8Array(3);
    crypto.getRandomValues(bytes);
    const color = `#${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
    if (!usedColors.has(color)) return color;
  }
  return `#${crypto.randomUUID().replaceAll("-", "").slice(0, 6)}`;
}

function randomIndex(length: number) {
  const value = new Uint32Array(1);
  crypto.getRandomValues(value);
  return value[0] % length;
}
function safeDecode(value: string) { try { return decodeURIComponent(value); } catch { return null; } }

export const sessionCookie = { name: COOKIE_NAME, maxAge: Math.floor(SESSION_MS / 1000) };
