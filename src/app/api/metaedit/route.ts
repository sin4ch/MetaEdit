import { NextResponse } from "next/server";
import { asRecord, captureBeforeOperations, readString, validatePatchOperations, validateScreenshot, validateTarget } from "@/lib/metaedit-contract";
import { createCollaborator, createSessionCookie, readSession, requireSession, sessionCookie, verifyAccessToken } from "@/lib/server/metaedit-auth";
import { ACTIVE_WINDOW_MS, ensureDatabase, getAnnotation, getRevision, idempotent, readWorkspaceState, recordActivity, WORKSPACE_ID } from "@/lib/server/metaedit-db";
import { createRevisionPullRequest } from "@/lib/server/github";
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
      response.cookies.set(sessionCookie.name, await createSessionCookie(collaborator.id, expiresAt), { ...sessionCookieOptions(request), maxAge: sessionCookie.maxAge });
      return response;
    }

    if (action === "logout") {
      const collaborator = await readSession(request);
      if (collaborator) await getD1().prepare(`UPDATE collaborators SET last_seen_at = ?, cursor_x = NULL, cursor_y = NULL WHERE id = ?`).bind(0, collaborator.id).run();
      const response = NextResponse.json({ ok: true });
      response.cookies.set(sessionCookie.name, "", { ...sessionCookieOptions(request), maxAge: 0 });
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
      const beforeScreenshot = validateScreenshot(body.beforeScreenshot);
      const result = await idempotent(key, async () => {
        const id = crypto.randomUUID();
        const now = Date.now();
        await getD1().prepare(`INSERT INTO annotations (id, workspace_id, author_id, author_name, target_id, selector, component, source, text_snapshot, style_snapshot, selection_type, region_json, highlighted_elements_json, comment, status, agent_state, before_screenshot, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', 'unseen', ?, ?, ?)`).bind(id, WORKSPACE_ID, collaborator.id, collaborator.displayName, target.instanceId, target.selector, target.component, target.source, target.textSnapshot, JSON.stringify(target.styleSnapshot), target.selectionType ?? "element", target.region ? JSON.stringify(target.region) : null, target.highlightedElements ? JSON.stringify(target.highlightedElements) : null, comment, beforeScreenshot, now, now).run();
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
        const latestVersion = Number(versionRow?.version ?? 0);
        const requestedBaseVersion = body.baseVersion === undefined ? latestVersion : Number(body.baseVersion);
        if (!Number.isInteger(requestedBaseVersion) || requestedBaseVersion < 0 || requestedBaseVersion > latestVersion) throw new Error(`baseVersion must be an integer between 0 and ${latestVersion}.`);
        const parent = requestedBaseVersion > 0 ? await getD1().prepare(`SELECT id FROM revisions WHERE workspace_id = ? AND version <= ? ORDER BY version DESC LIMIT 1`).bind(WORKSPACE_ID, requestedBaseVersion).first<{ id: string }>() : null;
        const id = crypto.randomUUID();
        const version = latestVersion + 1;
        const now = Date.now();
        await getD1().batch([
          getD1().prepare(`INSERT INTO revisions (id, workspace_id, annotation_id, author_id, author_name, instruction, base_version, parent_revision_id, version, status, patch_json, before_json, before_screenshot, publish_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'proposed', ?, ?, ?, 'idle', ?, ?)`).bind(id, WORKSPACE_ID, annotationId, collaborator.id, collaborator.displayName, instruction, requestedBaseVersion, parent?.id ?? null, version, JSON.stringify(patch), JSON.stringify(captureBeforeOperations(patch, annotation)), annotation.beforeScreenshot ?? null, now, now),
          getD1().prepare(`UPDATE annotations SET agent_state = 'in_progress', updated_at = ? WHERE id = ?`).bind(now, annotationId),
        ]);
        await recordActivity("revision.proposed", collaborator, id, `${collaborator.displayName} proposed revision v${version} for ${annotation.component}.`);
        return { revisionId: id, version, parentRevisionId: parent?.id ?? null };
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
        const active = await getD1().prepare(`SELECT COUNT(*) AS count FROM collaborators WHERE workspace_id = ? AND last_seen_at >= ?`).bind(WORKSPACE_ID, now - ACTIVE_WINDOW_MS).first<{ count: number }>();
        const reviews = await getD1().prepare(`SELECT decision, COUNT(*) AS count FROM approvals WHERE revision_id = ? GROUP BY decision`).bind(revisionId).all<{ decision: string; count: number }>();
        const rejected = reviews.results.some((row) => row.decision === "rejected" && Number(row.count) > 0);
        const approvedCount = Number(reviews.results.find((row) => row.decision === "approved")?.count ?? 0);
        const status = rejected ? "rejected" : approvedCount >= Math.max(1, Number(active?.count ?? 1)) ? "approved" : "proposed";
        await getD1().prepare(`UPDATE revisions SET status = ?, publish_status = 'idle', updated_at = ? WHERE id = ?`).bind(status, now, revisionId).run();
        if (revision.annotationId) {
          const agentState = status === "approved" ? "done" : status === "rejected" ? "seen" : "in_progress";
          await getD1().prepare(`UPDATE annotations SET agent_state = ?, updated_at = ? WHERE id = ?`).bind(agentState, now, revision.annotationId).run();
        }
        await recordActivity(`revision.${decision}`, collaborator, revisionId, `${collaborator.displayName} ${decision} revision v${revision.version}.`);
        return { ok: true };
      });
      return NextResponse.json({ ok: true, state: await readWorkspaceState(collaborator.id) });
    }

    if (action === "request_publish") {
      const revisionId = readString(body, "revisionId", { max: 120 })!;
      const revision = await getRevision(revisionId);
      if (!revision) return NextResponse.json({ error: "Revision not found." }, { status: 404 });
      if (revision.status === "published") return NextResponse.json({ error: "The revision has already been published." }, { status: 409 });
      if (revision.status === "rejected") return NextResponse.json({ error: "Rejected revisions cannot be published." }, { status: 409 });
      if (!revision.approvals.some((approval) => approval.decision === "approved")) return NextResponse.json({ error: "At least one collaborator must approve before publishing." }, { status: 409 });
      await idempotent(key, async () => {
        await recordActivity("revision.publish_requested", collaborator, revisionId, `${collaborator.displayName} requested publication of revision v${revision.version}.`);
        return { ok: true };
      });
      return NextResponse.json({ ok: true, state: await readWorkspaceState(collaborator.id) });
    }

    if (action === "publish_revision") {
      const revisionId = readString(body, "revisionId", { max: 120 })!;
      const revision = await getRevision(revisionId);
      if (!revision) return NextResponse.json({ error: "Revision not found." }, { status: 404 });
      if (revision.status === "published") return NextResponse.json({ error: "The revision has already been published." }, { status: 409 });
      if (revision.status === "rejected") return NextResponse.json({ error: "Rejected revisions cannot be published." }, { status: 409 });
      if (!revision.approvals.some((approval) => approval.decision === "approved")) return NextResponse.json({ error: "At least one collaborator must approve before publishing." }, { status: 409 });
      const afterScreenshot = validateScreenshot(body.afterScreenshot);
      const result = await idempotent(key, async () => {
        const now = Date.now();
        await getD1().prepare(`UPDATE revisions SET publish_status = 'creating', after_screenshot = COALESCE(?, after_screenshot), updated_at = ? WHERE id = ?`).bind(afterScreenshot, now, revisionId).run();
        await recordActivity("revision.publish_requested", collaborator, revisionId, `${collaborator.displayName} requested publication of revision v${revision.version}.`);
        await recordActivity("revision.publish_started", collaborator, revisionId, `${collaborator.displayName} is creating a pull request for revision v${revision.version}.`);
        try {
          const annotation = revision.annotationId ? await getAnnotation(revision.annotationId) : null;
          if (!annotation) throw new Error("The revision is missing its annotation target.");
          const effectiveAfterScreenshot = afterScreenshot ?? revision.afterScreenshot ?? null;
          const pullRequest = await createRevisionPullRequest({ ...revision, afterScreenshot: effectiveAfterScreenshot }, annotation, effectiveAfterScreenshot);
          const completedAt = Date.now();
          await getD1().batch([
            getD1().prepare(`UPDATE revisions SET status = 'published', publish_status = 'ready', after_screenshot = COALESCE(?, after_screenshot), github_pr_url = ?, github_pr_number = ?, github_commit_sha = ?, published_at = ?, updated_at = ? WHERE id = ?`).bind(afterScreenshot, pullRequest?.url ?? null, pullRequest?.number ?? null, pullRequest?.commitSha ?? null, completedAt, completedAt, revisionId),
            getD1().prepare(`UPDATE workspaces SET published_version = ? WHERE id = ?`).bind(revision.version, WORKSPACE_ID),
            getD1().prepare(`UPDATE annotations SET status = 'resolved', agent_state = 'done', updated_at = ? WHERE id = ?`).bind(completedAt, revision.annotationId),
          ]);
          await recordActivity("revision.published", collaborator, revisionId, pullRequest ? `${collaborator.displayName} opened pull request #${pullRequest.number} for revision v${revision.version}.` : `${collaborator.displayName} published revision v${revision.version}.`);
          return { ok: true, pullRequest };
        } catch (error) {
          await getD1().prepare(`UPDATE revisions SET publish_status = 'failed', updated_at = ? WHERE id = ?`).bind(Date.now(), revisionId).run();
          await recordActivity("revision.publish_failed", collaborator, revisionId, `${collaborator.displayName} could not publish revision v${revision.version}.`);
          throw error;
        }
      });
      return NextResponse.json({ ...result, state: await readWorkspaceState(collaborator.id) });
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
  if (typeof x !== "number" || !Number.isFinite(x) || x < -1000000 || x > 1000000) throw new Error("cursor.x must be a finite document coordinate.");
  if (typeof y !== "number" || !Number.isFinite(y) || y < -1000000 || y > 1000000) throw new Error("cursor.y must be a finite document coordinate.");
  return { x, y };
}

function sessionCookieOptions(request: Request) {
  const url = new URL(request.url);
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  const domain = hostname === "me.sin4.ch" || hostname.endsWith(".me.sin4.ch") ? "me.sin4.ch" : undefined;
  return {
    domain,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: url.protocol === "https:",
    path: "/",
  };
}
