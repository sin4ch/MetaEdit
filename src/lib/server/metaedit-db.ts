import { getD1 } from "../../../db";
import type { Annotation, Approval, Collaborator, HighlightedElement, MetaEditRect, Revision, WorkspaceState } from "@/types/metaedit";

export const WORKSPACE_ID = "default";
export const ACTIVE_WINDOW_MS = 45 * 1000;
let initialized: Promise<void> | null = null;

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS workspaces (id TEXT PRIMARY KEY, name TEXT NOT NULL, published_version INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS collaborators (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, platform_user_id TEXT, display_name TEXT NOT NULL, email TEXT, role TEXT NOT NULL, color TEXT NOT NULL, session_expires_at INTEGER NOT NULL, last_seen_at INTEGER NOT NULL, cursor_x REAL, cursor_y REAL, created_at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_collaborators_workspace_seen ON collaborators(workspace_id, last_seen_at)`,
  `CREATE INDEX IF NOT EXISTS idx_collaborators_platform_user ON collaborators(platform_user_id)`,
  `CREATE TABLE IF NOT EXISTS annotations (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, author_id TEXT NOT NULL, author_name TEXT NOT NULL, target_id TEXT NOT NULL, selector TEXT NOT NULL, component TEXT NOT NULL, source TEXT NOT NULL, text_snapshot TEXT NOT NULL, style_snapshot TEXT NOT NULL, selection_type TEXT NOT NULL DEFAULT 'element', region_json TEXT, highlighted_elements_json TEXT, comment TEXT NOT NULL, status TEXT NOT NULL, agent_state TEXT NOT NULL DEFAULT 'unseen', before_screenshot TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_annotations_workspace_created ON annotations(workspace_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS revisions (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, annotation_id TEXT, author_id TEXT NOT NULL, author_name TEXT NOT NULL, instruction TEXT NOT NULL, base_version INTEGER NOT NULL, parent_revision_id TEXT, version INTEGER NOT NULL, status TEXT NOT NULL, patch_json TEXT NOT NULL, before_json TEXT NOT NULL, before_screenshot TEXT, after_screenshot TEXT, github_pr_url TEXT, github_pr_number INTEGER, github_commit_sha TEXT, publish_status TEXT NOT NULL DEFAULT 'idle', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, published_at INTEGER)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_revisions_workspace_version ON revisions(workspace_id, version)`,
  `CREATE TABLE IF NOT EXISTS approvals (id TEXT PRIMARY KEY, revision_id TEXT NOT NULL, collaborator_id TEXT NOT NULL, collaborator_name TEXT NOT NULL, decision TEXT NOT NULL, created_at INTEGER NOT NULL)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS idx_approvals_revision_collaborator ON approvals(revision_id, collaborator_id)`,
  `CREATE TABLE IF NOT EXISTS activity_events (id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, kind TEXT NOT NULL, actor_id TEXT NOT NULL, actor_name TEXT NOT NULL, entity_id TEXT NOT NULL, message TEXT NOT NULL, created_at INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_activity_workspace_created ON activity_events(workspace_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS idempotency_records (key TEXT PRIMARY KEY, workspace_id TEXT NOT NULL, response_json TEXT NOT NULL, created_at INTEGER NOT NULL)`,
];

const ANNOTATION_MIGRATIONS = [
  `ALTER TABLE collaborators ADD COLUMN cursor_x REAL`,
  `ALTER TABLE collaborators ADD COLUMN cursor_y REAL`,
  `ALTER TABLE annotations ADD COLUMN selection_type TEXT NOT NULL DEFAULT 'element'`,
  `ALTER TABLE annotations ADD COLUMN region_json TEXT`,
  `ALTER TABLE annotations ADD COLUMN highlighted_elements_json TEXT`,
  `ALTER TABLE annotations ADD COLUMN agent_state TEXT NOT NULL DEFAULT 'unseen'`,
  `ALTER TABLE annotations ADD COLUMN before_screenshot TEXT`,
  `ALTER TABLE revisions ADD COLUMN parent_revision_id TEXT`,
  `ALTER TABLE revisions ADD COLUMN before_screenshot TEXT`,
  `ALTER TABLE revisions ADD COLUMN after_screenshot TEXT`,
  `ALTER TABLE revisions ADD COLUMN github_pr_url TEXT`,
  `ALTER TABLE revisions ADD COLUMN github_pr_number INTEGER`,
  `ALTER TABLE revisions ADD COLUMN github_commit_sha TEXT`,
  `ALTER TABLE revisions ADD COLUMN publish_status TEXT NOT NULL DEFAULT 'idle'`,
];

export async function ensureDatabase() {
  if (!initialized) {
    initialized = (async () => {
      const d1 = getD1();
      await d1.batch(SCHEMA.map((sql) => d1.prepare(sql)));
      for (const sql of ANNOTATION_MIGRATIONS) {
        try { await d1.prepare(sql).run(); } catch (error) {
          const message = String(error).toLowerCase();
          if (!message.includes("duplicate column") && !message.includes("already exists")) throw error;
        }
      }
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
function parseJson<T>(value: unknown, fallback: T): T { if (typeof value !== "string" || !value) return fallback; try { return JSON.parse(value) as T; } catch { return fallback; } }

export function mapCollaborator(row: Row): Collaborator {
  const cursorX = row.cursor_x === null || row.cursor_x === undefined ? Number.NaN : Number(row.cursor_x);
  const cursorY = row.cursor_y === null || row.cursor_y === undefined ? Number.NaN : Number(row.cursor_y);
  const cursor = Number.isFinite(cursorX) && Number.isFinite(cursorY) ? { x: cursorX, y: cursorY } : undefined;
  return { id: String(row.id), displayName: String(row.display_name), role: String(row.role) as Collaborator["role"], color: String(row.color), email: row.email ? String(row.email) : null, lastSeenAt: iso(row.last_seen_at), cursor };
}

export function mapAnnotation(row: Row): Annotation {
  const selectionType = row.selection_type === "region" ? "region" : "element";
  const rawAgentState = String(row.agent_state ?? "unseen");
  const agentState = ["unseen", "seen", "in_progress", "done"].includes(rawAgentState) ? rawAgentState as Annotation["agentState"] : "unseen";
  return { id: String(row.id), authorId: String(row.author_id), authorName: String(row.author_name), authorColor: row.author_color ? String(row.author_color) : undefined, targetId: String(row.target_id), selector: String(row.selector), component: String(row.component), source: String(row.source), textSnapshot: String(row.text_snapshot), styleSnapshot: parseJson(row.style_snapshot, {}), selectionType, region: selectionType === "region" ? parseJson<MetaEditRect | null>(row.region_json, null) : null, highlightedElements: selectionType === "region" ? parseJson<HighlightedElement[]>(row.highlighted_elements_json, []) : [], agentState, beforeScreenshot: typeof row.before_screenshot === "string" ? row.before_screenshot : null, comment: String(row.comment), status: String(row.status) as Annotation["status"], createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) };
}

function mapApproval(row: Row): Approval {
  return { id: String(row.id), revisionId: String(row.revision_id), collaboratorId: String(row.collaborator_id), collaboratorName: String(row.collaborator_name), decision: String(row.decision) as Approval["decision"], createdAt: iso(row.created_at) };
}

function mapRevision(row: Row, approvals: Approval[]): Revision {
  const rawPublishStatus = String(row.publish_status ?? "idle");
  const publishStatus = ["idle", "creating", "ready", "failed"].includes(rawPublishStatus) ? rawPublishStatus as Revision["publishStatus"] : "idle";
  return { id: String(row.id), annotationId: row.annotation_id ? String(row.annotation_id) : null, authorId: String(row.author_id), authorName: String(row.author_name), authorColor: row.author_color ? String(row.author_color) : undefined, instruction: String(row.instruction), baseVersion: Number(row.base_version), parentRevisionId: row.parent_revision_id ? String(row.parent_revision_id) : null, version: Number(row.version), status: String(row.status) as Revision["status"], patch: JSON.parse(String(row.patch_json)), before: JSON.parse(String(row.before_json)), approvals: approvals.filter((item) => item.revisionId === String(row.id)), createdAt: iso(row.created_at), updatedAt: iso(row.updated_at), publishedAt: row.published_at ? iso(row.published_at) : null, beforeScreenshot: typeof row.before_screenshot === "string" ? row.before_screenshot : null, afterScreenshot: typeof row.after_screenshot === "string" ? row.after_screenshot : null, githubPrUrl: typeof row.github_pr_url === "string" ? row.github_pr_url : null, githubPrNumber: row.github_pr_number === null || row.github_pr_number === undefined ? null : Number(row.github_pr_number), githubCommitSha: typeof row.github_commit_sha === "string" ? row.github_commit_sha : null, publishStatus };
}

export async function readWorkspaceState(currentCollaboratorId: string | null, publicOnly = false): Promise<WorkspaceState> {
  await ensureDatabase();
  const d1 = getD1();
  const [workspaceResult, collaboratorsResult, annotationsResult, revisionsResult, approvalsResult, activityResult] = await d1.batch([
    d1.prepare(`SELECT * FROM workspaces WHERE id = ?`).bind(WORKSPACE_ID),
    d1.prepare(`SELECT * FROM collaborators WHERE workspace_id = ? AND last_seen_at >= ? ORDER BY created_at`).bind(WORKSPACE_ID, Date.now() - ACTIVE_WINDOW_MS),
    d1.prepare(publicOnly ? `SELECT * FROM annotations WHERE 1 = 0` : `SELECT annotations.*, collaborators.color AS author_color FROM annotations LEFT JOIN collaborators ON collaborators.id = annotations.author_id AND collaborators.workspace_id = annotations.workspace_id WHERE annotations.workspace_id = ? ORDER BY annotations.created_at DESC`).bind(...(publicOnly ? [] : [WORKSPACE_ID])),
    d1.prepare(publicOnly ? `SELECT * FROM revisions WHERE workspace_id = ? AND status = 'published' ORDER BY version` : `SELECT revisions.*, collaborators.color AS author_color FROM revisions LEFT JOIN collaborators ON collaborators.id = revisions.author_id AND collaborators.workspace_id = revisions.workspace_id WHERE revisions.workspace_id = ? ORDER BY revisions.version`).bind(WORKSPACE_ID),
    d1.prepare(publicOnly ? `SELECT * FROM approvals WHERE 1 = 0` : `SELECT * FROM approvals ORDER BY created_at`).bind(),
    d1.prepare(publicOnly ? `SELECT * FROM activity_events WHERE 1 = 0` : `SELECT * FROM activity_events WHERE workspace_id = ? ORDER BY created_at DESC`).bind(...(publicOnly ? [] : [WORKSPACE_ID])),
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
  const row = await getD1().prepare(`SELECT annotations.*, collaborators.color AS author_color FROM annotations LEFT JOIN collaborators ON collaborators.id = annotations.author_id AND collaborators.workspace_id = annotations.workspace_id WHERE annotations.id = ? AND annotations.workspace_id = ?`).bind(id, WORKSPACE_ID).first<Row>();
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
