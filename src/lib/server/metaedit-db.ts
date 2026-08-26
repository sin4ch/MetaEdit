import { getD1 } from "../../../db";
import type { Annotation, Approval, Collaborator, Revision, WorkspaceState } from "@/types/metaedit";

export const WORKSPACE_ID = "default";
const ACTIVE_WINDOW_MS = 10 * 60 * 1000;
let initialized: Promise<void> | null = null;

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS workspaces (id TEXT PRIMARY KEY, name TEXT NOT NULL, published_version INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS collaborators (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, platform_user_id TEXT, display_name TEXT NOT NULL, email TEXT, role TEXT NOT NULL, color TEXT NOT NULL, session_expires_at INTEGER NOT NULL, last_seen_at INTEGER NOT NULL, created_at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_collaborators_workspace_seen ON collaborators(workspace_id, last_seen_at)`,
  `CREATE INDEX IF NOT EXISTS idx_collaborators_platform_user ON collaborators(platform_user_id)`,
  `CREATE TABLE IF NOT EXISTS annotations (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, author_id TEXT NOT NULL, author_name TEXT NOT NULL, target_id TEXT NOT NULL, selector TEXT NOT NULL, component TEXT NOT NULL, source TEXT NOT NULL, text_snapshot TEXT NOT NULL, style_snapshot TEXT NOT NULL, comment TEXT NOT NULL, status TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_annotations_workspace_created ON annotations(workspace_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS revisions (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, annotation_id TEXT, author_id TEXT NOT NULL, author_name TEXT NOT NULL, instruction TEXT NOT NULL, base_version INTEGER NOT NULL, version INTEGER NOT NULL, status TEXT NOT NULL, patch_json TEXT NOT NULL, before_json TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, published_at INTEGER)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_revisions_workspace_version ON revisions(workspace_id, version)`,
  `CREATE TABLE IF NOT EXISTS approvals (id TEXT PRIMARY KEY, revision_id TEXT NOT NULL, collaborator_id TEXT NOT NULL, collaborator_name TEXT NOT NULL, decision TEXT NOT NULL, created_at INTEGER NOT NULL)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_approvals_revision_collaborator ON approvals(revision_id, collaborator_id)`,
  `CREATE TABLE IF NOT EXISTS activity_events (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, kind TEXT NOT NULL, actor_id TEXT NOT NULL, actor_name TEXT NOT NULL, entity_id TEXT NOT NULL, message TEXT NOT NULL, created_at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_activity_workspace_created ON activity_events(workspace_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS idempotency_records (key TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, response_json TEXT NOT NULL, created_at INTEGER NOT NULL)`,
];

export async function ensureDatabase() {
  if (!initialized) {
    initialized = (async () => {
      const d1 = getD1();
      await d1.batch(SCHEMA.map((sql) => d1.prepare(sql)));
      await d1.prepare(`INSERT OR IGNORE INTO workspaces (id, name, published_version, created_at) VALUES (?, ?, 0, ?)`).bind(WORKSPACE_ID, "MetaEdit", Date.now()).run();
    })().catch((error) => {
      initialized = null;
      throw error;
    });
  }
  await initialized;
}

type Row = Record<string, unknown>;
const iso = (value: unknown) => new Date(Number(value)).toISOString();

export function mapCollaborator(row: Row): Collaborator {
  return { id: String(row.id), displayName: String(row.display_name), role: String(row.role) as Collaborator["role"], color: String(row.color), email: row.email ? String(row.email) : null, lastSeenAt: iso(row.last_seen_at) };
}

export function mapAnnotation(row: Row): Annotation {
  return { id: String(row.id), authorId: String(row.author_id), authorName: String(row.author_name), targetId: String(row.target_id), selector: String(row.selector), component: String(row.component), source: String(row.source), textSnapshot: String(row.text_snapshot), styleSnapshot: JSON.parse(String(row.style_snapshot)), comment: String(row.comment), status: String(row.status) as Annotation["status"], createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) };
}

function mapApproval(row: Row): Approval {
  return { id: String(row.id), revisionId: String(row.revision_id), collaboratorId: String(row.collaborator_id), collaboratorName: String(row.collaborator_name), decision: String(row.decision) as Approval["decision"], createdAt: iso(row.created_at) };
}

function mapRevision(row: Row, approvals: Approval[]): Revision {
  return { id: String(row.id), annotationId: row.annotation_id ? String(row.annotation_id) : null, authorId: String(row.author_id), authorName: String(row.author_name), instruction: String(row.instruction), baseVersion: Number(row.base_version), version: Number(row.version), status: String(row.status) as Revision["status"], patch: JSON.parse(String(row.patch_json)), before: JSON.parse(String(row.before_json)), approvals: approvals.filter((item) => item.revisionId === String(row.id)), createdAt: iso(row.created_at), updatedAt: iso(row.updated_at), publishedAt: row.published_at ? iso(row.published_at) : null };
}

export async function readWorkspaceState(currentCollaboratorId: string | null, publicOnly = false): Promise<WorkspaceState> {
  await ensureDatabase();
  const d1 = getD1();
  const [workspaceResult, collaboratorsResult, annotationsResult, revisionsResult, approvalsResult, activityResult] = await d1.batch([
    d1.prepare(`SELECT * FROM workspaces WHERE id = ?`).bind(WORKSPACE_ID),
    d1.prepare(`SELECT * FROM collaborators WHERE workspace_id = ? AND last_seen_at >= ? ORDER BY created_at`).bind(WORKSPACE_ID, Date.now() - ACTIVE_WINDOW_MS),
    d1.prepare(publicOnly ? `SELECT * FROM annotations WHERE 1 = 0` : `SELECT * FROM annotations WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 200`).bind(...(publicOnly ? [] : [WORKSPACE_ID])),
    d1.prepare(publicOnly ? `SELECT * FROM revisions WHERE workspace_id = ? AND status = 'published' ORDER BY version` : `SELECT * FROM revisions WHERE workspace_id = ? ORDER BY version`).bind(WORKSPACE_ID),
    d1.prepare(publicOnly ? `SELECT * FROM approvals WHERE 1 = 0` : `SELECT * FROM approvals ORDER BY created_at`).bind(),
    d1.prepare(publicOnly ? `SELECT * FROM activity_events WHERE 1 = 0` : `SELECT * FROM activity_events WHERE workspace_id = ? ORDER BY created_at DESC LIMIT 200`).bind(...(publicOnly ? [] : [WORKSPACE_ID])),
  ]);
  const workspace = workspaceResult.results[0] as Row;
  const collaborators = (collaboratorsResult.results as Row[]).map(mapCollaborator);
  const approvals = (approvalsResult.results as Row[]).map(mapApproval);
  const revisionRows = revisionsResult.results as Row[];
  return {
    workspace: { id: String(workspace.id), name: String(workspace.name), publishedVersion: Number(workspace.published_version), latestVersion: revisionRows.reduce((max, row) => Math.max(max, Number(row.version)), 0) },
    currentCollaborator: collaborators.find((item) => item.id === currentCollaboratorId) ?? null,
    collaborators,
    annotations: (annotationsResult.results as Row[]).map(mapAnnotation),
    revisions: revisionRows.map((row) => mapRevision(row, approvals)),
    activity: (activityResult.results as Row[]).map((row) => ({ id: String(row.id), kind: String(row.kind), actorId: String(row.actor_id), actorName: String(row.actor_name), entityId: String(row.entity_id), message: String(row.message), createdAt: iso(row.created_at) })),
  };
}

export async function recordActivity(kind: string, actor: Pick<Collaborator, "id" | "displayName">, entityId: string, message: string) {
  await getD1().prepare(`INSERT INTO activity_events (id, workspace_id, kind, actor_id, actor_name, entity_id, message, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).bind(crypto.randomUUID(), WORKSPACE_ID, kind, actor.id, actor.displayName, entityId, message, Date.now()).run();
}

export async function getAnnotation(id: string): Promise<Annotation | null> {
  await ensureDatabase();
  const row = await getD1().prepare(`SELECT * FROM annotations WHERE id = ? AND workspace_id = ?`).bind(id, WORKSPACE_ID).first<Row>();
  return row ? mapAnnotation(row) : null;
}

export async function getRevision(id: string): Promise<Revision | null> {
  const state = await readWorkspaceState(null);
  return state.revisions.find((revision) => revision.id === id) ?? null;
}

export async function idempotent<T>(key: string, operation: () => Promise<T>): Promise<T> {
  const d1 = getD1();
  const existing = await d1.prepare(`SELECT response_json FROM idempotency_records WHERE key = ? AND workspace_id = ?`).bind(key, WORKSPACE_ID).first<{ response_json: string }>();
  if (existing) return JSON.parse(existing.response_json) as T;
  const result = await operation();
  await d1.prepare(`INSERT OR IGNORE INTO idempotency_records (key, workspace_id, response_json, created_at) VALUES (?, ?, ?, ?)`).bind(key, WORKSPACE_ID, JSON.stringify(result), Date.now()).run();
  return result;
}
