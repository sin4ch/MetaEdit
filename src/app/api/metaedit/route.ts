import { NextResponse } from "next/server";
import { asRecord, captureBeforeOperations, readString, validatePatchOperations, validateTarget } from "@/lib/metaedit-contract";
import { createCollaborator, createSessionCookie, readSession, requireSession, sessionCookie, verifyAccessToken } from "@/lib/server/metaedit-auth";
import { ensureDatabase, getAnnotation, getRevision, idempotent, readWorkspaceState, recordActivity, WORKSPACE_ID } from "@/lib/server/metaedit-db";
import { getD1 } from "../../../../db";

export const runtime = "edge";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    if (url.searchParams.get("scope") === "public") return NextResponse.json(await readWorkspaceState(null, true));
    const collaborator = await readSession(request);
    if (!collaborator) return NextResponse.json({ authenticated: false }, { status: 401 });
    await getD1().prepare(`UPDATE collaborators SET last_seen_at = ? WHERE id = ?`).bind(Date.now(), collaborator.id).run();
    return NextResponse.json({ authenticated: true, state: await readWorkspaceState(collaborator.id) });
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: Request) {
  try {
    await ensureDatabase();
    const body = asRecord(await request.json());
    const action = readString(body, "action", { max: 80 });

    if (action === "login") {
      const token = readString(body, "token", { min: 6, max: 300 })!;
      const displayName = readString(body, "displayName", { min: 2, max: 80 })!;
      if (!await verifyAccessToken(token)) return NextResponse.json({ error: "That workspace token is not valid." }, { status: 403 });
      const { collaborator, expiresAt } = await createCollaborator(request, displayName);
      await recordActivity("collaborator.joined", collaborator, collaborator.id, `${collaborator.displayName} joined the workspace.`);
      const response = NextResponse.json({ session: { collaborator, workspaceId: WORKSPACE_ID, workspaceName: "MetaEdit", expiresAt: new Date(expiresAt).toISOString() }, state: await readWorkspaceState(collaborator.id) });
      response.cookies.set(sessionCookie.name, await createSessionCookie(collaborator.id, expiresAt), { httpOnly: true, sameSite: "lax", secure: new URL(request.url).protocol === "https:", path: "/", maxAge: sessionCookie.maxAge });
      return response;
    }

    if (action === "logout") {
      const collaborator = await readSession(request);
      if (collaborator) await getD1().prepare(`UPDATE collaborators SET last_seen_at = ?, cursor_x = NULL, cursor_y = NULL WHERE id = ?`).bind(0, collaborator.id).run();
      const response = NextResponse.json({ ok: true });
      response.cookies.set(sessionCookie.name, "", { httpOnly: true, sameSite: "lax", secure: new URL(request.url).protocol === "https:", path: "/", maxAge: 0 });
      return response;
    }

    const collaborator = await requireSession(request);
    const key = request.headers.get("idempotency-key") ?? (typeof body.idempotencyKey === "string" ? body.idempotencyKey : null) ?? crypto.randomUUID();

    if (action === "heartbeat") {
      const cursor = readCursor(body.cursor);
      if (cursor !== undefined) {
        await getD1().prepare(`UPDATE collaborators SET cursor_x = ?, cursor_y = ? WHERE id = ?`).bind(cursor?.x ?? null, cursor?.y ?? null, collaborator.id).run();
      }
      return NextResponse.json({ ok: true, state: await readWorkspaceState(collaborator.id) });
    }

    if (action === "mark_annotations_seen") {
      const annotationIds = Array.isArray(body.annotationIds)
        ? body.annotationIds.filter((value): value is string => typeof value === "string" && value.length > 0 && value.length <= 120).slice(0, 100)
        : [];
      if (annotationIds.length > 0) {
        const placeholders = annotationIds.map(() => "?").join(", ");
        await getD1().prepare(`UPDATE annotations SET agent_state = CASE WHEN agent_state = 'unseen' THEN 'seen' ELSE agent_state END, updated_at = ? WHERE workspace_id = ? AND id IN (${placeholders})`).bind(Date.now(), WORKSPACE_ID, ...annotationIds).run();
      }
      return NextResponse.json({ ok: true, state: await readWorkspaceState(collaborator.id) });
    }

    if (action === "create_annotation") {
      const target = validateTarget(body.target);
      const comment = readString(body, "comment", { min: 1, max: 4000 })!;
      const result = await idempotent(key, async () => {
        const id = crypto.randomUUID();
        const now = Date.now();
        await getD1().prepare(`INSERT INTO annotations (id, workspace_id, author_id, author_name, target_id, selector, component, source, text_snapshot, style_snapshot, selection_type, region_json, highlighted_elements_json, comment, status, agent_state, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', 'unseen', ?, ?)`).bind(id, WORKSPACE_ID, collaborator.id, collaborator.displayName, target.instanceId, target.selector, target.component, target.source, target.textSnapshot, JSON.stringify(target.styleSnapshot), target.selectionType ?? "element", target.region ? JSON.stringify(target.region) : null, target.highlightedElements ? JSON.stringify(target.highlightedElements) : null, comment, now, now).run();
        const targetLabel = target.selectionType === "region" ? `freeform region containing ${target.highlightedElements?.length ?? 0} visible element${target.highlightedElements?.length === 1 ? "" : "s"}` : `${target.component} (#${target.instanceId})`;
        await recordActivity("annotation.created", collaborator, id, `${collaborator.displayName} annotated ${targetLabel}.`);
        return { annotationId: id };
      });
      return NextResponse.json({ ...result, state: await readWorkspaceState(collaborator.id) });
    }

    if (action === "resolve_annotation") {
      const annotationId = readString(body, "annotationId", { max: 120 })!;
      if (!await getAnnotation(annotationId)) return NextResponse.json({ error: "Annotation not found." }, { status: 404 });
      await getD1().prepare(`UPDATE annotations SET status = 'resolved', agent_state = 'done', updated_at = ? WHERE id = ?`).bind(Date.now(), annotationId).run();
      await recordActivity("annotation.resolved", collaborator, annotationId, `${collaborator.displayName} resolved an annotation.`);
      return NextResponse.json({ ok: true, state: await readWorkspaceState(collaborator.id) });
    }

    if (action === "propose_revision") {
      const annotationId = readString(body, "annotationId", { max: 120 })!;
      const instruction = readString(body, "instruction", { min: 1, max: 4000 })!;
      const annotation = await getAnnotation(annotationId);
      if (!annotation) return NextResponse.json({ error: "Annotation not found." }, { status: 404 });
      const patch = validatePatchOperations(body.patch);
      const allowedSelectors = new Set(annotation.selectionType === "region" ? (annotation.highlightedElements ?? []).map((element) => element.selector) : [annotation.selector]);
      if (patch.some((operation) => !allowedSelectors.has(operation.selector))) return NextResponse.json({ error: "This revision may only change elements inside the annotated target." }, { status: 400 });
      const result = await idempotent(key, async () => {
        const versionRow = await getD1().prepare(`SELECT COALESCE(MAX(version), 0) AS version FROM revisions WHERE workspace_id = ?`).bind(WORKSPACE_ID).first<{ version: number }>();
        const baseVersion = Number(body.baseVersion ?? versionRow?.version ?? 0);
        if (baseVersion !== Number(versionRow?.version ?? 0)) throw new Error(`The workspace changed. Refresh and propose against version ${versionRow?.version ?? 0}.`);
        const id = crypto.randomUUID();
        const version = baseVersion + 1;
        const now = Date.now();
        await getD1().batch([
          getD1().prepare(`INSERT INTO revisions (id, workspace_id, annotation_id, author_id, author_name, instruction, base_version, version, status, patch_json, before_json, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'proposed', ?, ?, ?, ?)`).bind(id, WORKSPACE_ID, annotationId, collaborator.id, collaborator.displayName, instruction, baseVersion, version, JSON.stringify(patch), JSON.stringify(captureBeforeOperations(patch, annotation)), now, now),
          getD1().prepare(`UPDATE annotations SET agent_state = 'in_progress', updated_at = ? WHERE id = ?`).bind(now, annotationId),
        ]);
        await recordActivity("revision.proposed", collaborator, id, `${collaborator.displayName} proposed revision v${version} for ${annotation.component}.`);
        return { revisionId: id, version };
      });
      return NextResponse.json({ ...result, state: await readWorkspaceState(collaborator.id) });
    }

    if (action === "review_revision") {
      const revisionId = readString(body, "revisionId", { max: 120 })!;
      const decision = readString(body, "decision", { max: 20 });
      if (decision !== "approved" && decision !== "rejected") throw new Error("decision must be approved or rejected.");
      const revision = await getRevision(revisionId);
      if (!revision) return NextResponse.json({ error: "Revision not found." }, { status: 404 });
      if (revision.status === "published") return NextResponse.json({ error: "Published revisions cannot be reviewed again." }, { status: 409 });
      const now = Date.now();
      await idempotent(key, async () => {
        await getD1().prepare(`INSERT INTO approvals (id, revision_id, collaborator_id, collaborator_name, decision, created_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(revision_id, collaborator_id) DO UPDATE SET decision = excluded.decision, collaborator_name = excluded.collaborator_name, created_at = excluded.created_at`).bind(crypto.randomUUID(), revisionId, collaborator.id, collaborator.displayName, decision, now).run();
        const active = await getD1().prepare(`SELECT COUNT(*) AS count FROM collaborators WHERE workspace_id = ? AND last_seen_at >= ?`).bind(WORKSPACE_ID, now - 10 * 60 * 1000).first<{ count: number }>();
        const reviews = await getD1().prepare(`SELECT decision, COUNT(*) AS count FROM approvals WHERE revision_id = ? GROUP BY decision`).bind(revisionId).all<{ decision: string; count: number }>();
        const rejected = reviews.results.some((row) => row.decision === "rejected" && Number(row.count) > 0);
        const approvedCount = Number(reviews.results.find((row) => row.decision === "approved")?.count ?? 0);
        const status = rejected ? "rejected" : approvedCount >= Math.max(1, Number(active?.count ?? 1)) ? "approved" : "proposed";
        await getD1().prepare(`UPDATE revisions SET status = ?, updated_at = ? WHERE id = ?`).bind(status, now, revisionId).run();
        if (revision.annotationId) {
          const agentState = status === "approved" ? "done" : status === "rejected" ? "seen" : "in_progress";
          await getD1().prepare(`UPDATE annotations SET agent_state = ?, updated_at = ? WHERE id = ?`).bind(agentState, now, revision.annotationId).run();
        }
        await recordActivity(`revision.${decision}`, collaborator, revisionId, `${collaborator.displayName} ${decision} revision v${revision.version}.`);
        return { ok: true };
      });
      return NextResponse.json({ ok: true, state: await readWorkspaceState(collaborator.id) });
    }

    if (action === "publish_revision") {
      if (collaborator.role !== "owner") return NextResponse.json({ error: "Only the workspace owner can publish." }, { status: 403 });
      const revisionId = readString(body, "revisionId", { max: 120 })!;
      const revision = await getRevision(revisionId);
      if (!revision) return NextResponse.json({ error: "Revision not found." }, { status: 404 });
      if (revision.status !== "approved") return NextResponse.json({ error: "Every active collaborator must approve before publishing." }, { status: 409 });
      await idempotent(key, async () => {
        const now = Date.now();
        await getD1().batch([
          getD1().prepare(`UPDATE revisions SET status = 'published', published_at = ?, updated_at = ? WHERE id = ?`).bind(now, now, revisionId),
          getD1().prepare(`UPDATE workspaces SET published_version = ? WHERE id = ?`).bind(revision.version, WORKSPACE_ID),
          getD1().prepare(`UPDATE annotations SET status = 'resolved', agent_state = 'done', updated_at = ? WHERE id = ?`).bind(now, revision.annotationId),
        ]);
        await recordActivity("revision.published", collaborator, revisionId, `${collaborator.displayName} published revision v${revision.version}.`);
        return { ok: true };
      });
      return NextResponse.json({ ok: true, state: await readWorkspaceState(collaborator.id) });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) { return errorResponse(error); }
}

function errorResponse(error: unknown) {
  if (error instanceof Response) return error;
  const message = error instanceof Error ? error.message : "Unexpected MetaEdit error.";
  const conflict = message.startsWith("The workspace changed.");
  return NextResponse.json({ error: message }, { status: conflict ? 409 : 400 });
}

function readCursor(value: unknown): { x: number; y: number } | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const cursor = asRecord(value);
  const x = cursor.x;
  const y = cursor.y;
  if (typeof x !== "number" || !Number.isFinite(x) || x < -100000 || x > 100000) throw new Error("cursor.x must be a finite viewport coordinate.");
  if (typeof y !== "number" || !Number.isFinite(y) || y < -100000 || y > 100000) throw new Error("cursor.y must be a finite viewport coordinate.");
  return { x, y };
}
