"use client";

import * as React from "react";
import { focusMetaEditTarget, metaEditRequest } from "@/lib/metaedit-client";
import { annotationToScreenshotTarget, captureMetaEditScreenshot } from "@/lib/metaedit-screenshot";
import type { TargetMetadata, WorkspaceState } from "@/types/metaedit";

const result = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] });

export function WebMCPRegistry({ enabled, state, onState, onStatus }: { enabled: boolean; state: WorkspaceState | null; onState: (state: WorkspaceState) => void; onStatus?: (available: boolean) => void }) {
  const stateRef = React.useRef(state);
  const onStateRef = React.useRef(onState);

  React.useEffect(() => {
    stateRef.current = state;
    onStateRef.current = onState;
  }, [state, onState]);

  React.useEffect(() => {
    const context = document.modelContext;
    const available = Boolean(context);
    onStatus?.(available);
    if (!enabled || !context) return;

    const currentState = () => {
      const current = stateRef.current;
      if (!current) throw new Error("The MetaEdit workspace is still loading.");
      return current;
    };

    const call = async (action: string, input: Record<string, unknown>, options: WebMCPExecuteOptions) => {
      const response = await metaEditRequest<{ state?: WorkspaceState }>(action, input, { signal: options.signal });
      if (response.state) onStateRef.current(response.state);
      return result(response);
    };
    const markSeen = async (annotationIds: string[], options: WebMCPExecuteOptions) => {
      const ids = Array.from(new Set(annotationIds.filter(Boolean))).slice(0, 100);
      if (ids.length === 0) return currentState();
      const response = await metaEditRequest<{ state?: WorkspaceState }>("mark_annotations_seen", { annotationIds: ids }, { signal: options.signal });
      if (response.state) onStateRef.current(response.state);
      return response.state ?? currentState();
    };
    const tools: WebMCPTool[] = [
      {
        name: "metaedit_get_workspace",
        description: "Read the current MetaEdit workspace, collaborators, annotations, revision proposals, approvals, and published version before deciding what to change. Reading annotations marks them as seen by the agent.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: { untrustedContentHint: true },
        execute: async (_input, options) => result(await markSeen(currentState().annotations.filter((item) => item.agentState === "unseen").map((item) => item.id), options)),
      },
      {
        name: "metaedit_list_annotations",
        description: "List open UI annotations with stable selectors, original text and computed style snapshots, author attribution, comments, and any freeform regions with the elements they intersect. Listing annotations marks them as seen by the agent.",
        inputSchema: { type: "object", properties: { status: { type: "string", enum: ["open", "resolved", "all"] } }, additionalProperties: false },
        annotations: { untrustedContentHint: true },
        execute: async ({ status = "open" }, options) => {
          const current = currentState();
          const next = await markSeen(current.annotations.filter((item) => status === "all" || item.status === status).map((item) => item.id), options);
          return result(next.annotations.filter((item) => status === "all" || item.status === status));
        },
      },
      {
        name: "metaedit_inspect_annotation",
        description: "Inspect one annotation and its related revisions before proposing a safe UI patch. This marks the annotation as seen by the agent. Region annotations include the raw rectangle and the visible elements inside it.",
        inputSchema: { type: "object", properties: { annotationId: { type: "string" } }, required: ["annotationId"], additionalProperties: false },
        annotations: { untrustedContentHint: true },
        execute: async ({ annotationId }, options) => {
          const current = await markSeen([String(annotationId)], options);
          return result({ annotation: current.annotations.find((item) => item.id === annotationId), revisions: current.revisions.filter((item) => item.annotationId === annotationId) });
        },
      },
      {
        name: "metaedit_create_annotation",
        description: "Create an attributed annotation for an element or a freeform region. For a region, preserve the raw rectangle and highlightedElements list so the agent can understand every intersected element without snapping the selection.",
        inputSchema: { type: "object", properties: { target: { type: "object", description: "TargetMetadata from the MetaEdit inspector. A region target has selectionType=region, a document-space region rectangle, and highlightedElements.", properties: { component: { type: "string" }, source: { type: "string" }, instanceId: { type: "string" }, selector: { type: "string" }, textSnapshot: { type: "string" }, styleSnapshot: { type: "object" }, selectionType: { type: "string", enum: ["element", "region"] }, region: { type: "object", properties: { top: { type: "number" }, left: { type: "number" }, width: { type: "number" }, height: { type: "number" } }, required: ["top", "left", "width", "height"], additionalProperties: false }, highlightedElements: { type: "array", items: { type: "object" } } }, required: ["component", "source", "instanceId", "selector", "textSnapshot", "styleSnapshot"], additionalProperties: false }, comment: { type: "string", minLength: 1 } }, required: ["target", "comment"], additionalProperties: false },
        annotations: { untrustedContentHint: true },
        execute: (input, options) => {
          const target = input.target as TargetMetadata;
          const beforeScreenshot = target && typeof target === "object" ? captureMetaEditScreenshot(target) : null;
          return call("create_annotation", beforeScreenshot ? { ...input, beforeScreenshot } : input, options);
        },
      },
      {
        name: "metaedit_propose_revision",
        description: "Propose a preview-only revision for one annotation. Allowed operations are replace_text, set_style with an allowlisted property, and set_visibility. Element annotations may edit their selector; freeform annotations may edit only selectors listed in highlightedElements. Never inject HTML, scripts, or CSS classes.",
        inputSchema: { type: "object", properties: { annotationId: { type: "string" }, instruction: { type: "string" }, baseVersion: { type: "integer" }, patch: { type: "array", minItems: 1, maxItems: 20, items: { type: "object" } } }, required: ["annotationId", "instruction", "baseVersion", "patch"], additionalProperties: false },
        annotations: { untrustedContentHint: true },
        execute: (input, options) => call("propose_revision", input, options),
      },
      {
        name: "metaedit_review_revision",
        description: "Approve or reject a proposed MetaEdit revision on behalf of the authenticated collaborator.",
        inputSchema: { type: "object", properties: { revisionId: { type: "string" }, decision: { type: "string", enum: ["approved", "rejected"] } }, required: ["revisionId", "decision"], additionalProperties: false },
        annotations: { untrustedContentHint: true },
        execute: (input, options) => call("review_revision", input, options),
      },
      {
        name: "metaedit_publish_revision",
        description: "Publish an approved revision by opening a GitHub pull request with the structured patch and before/after evidence. Only the workspace owner can do this, and all active collaborators must have approved.",
        inputSchema: { type: "object", properties: { revisionId: { type: "string" } }, required: ["revisionId"], additionalProperties: false },
        annotations: { untrustedContentHint: true },
        execute: (input, options) => {
          const revision = currentState().revisions.find((item) => item.id === String(input.revisionId));
          const annotation = revision?.annotationId ? currentState().annotations.find((item) => item.id === revision.annotationId) : undefined;
          const afterScreenshot = annotation ? captureMetaEditScreenshot(annotationToScreenshotTarget(annotation)) : null;
          return call("publish_revision", afterScreenshot ? { ...input, afterScreenshot } : input, options);
        },
      },
      {
        name: "metaedit_focus_target",
        description: "Scroll the browser to an annotated UI target and briefly highlight it for the human collaborator.",
        inputSchema: { type: "object", properties: { selector: { type: "string" } }, required: ["selector"], additionalProperties: false },
        annotations: { readOnlyHint: true },
        execute: ({ selector }) => { focusMetaEditTarget(String(selector)); return result({ focused: selector }); },
      },
    ];
    const controller = new AbortController();
    void Promise.all(tools.map((tool) => Promise.resolve().then(() => context.registerTool(tool, { signal: controller.signal })))).then(() => {
      if (!controller.signal.aborted) onStatus?.(true);
    }).catch((error: unknown) => {
      if (!controller.signal.aborted) {
        onStatus?.(false);
        console.warn("MetaEdit WebMCP tool registration failed", error);
      }
    });
    return () => controller.abort();
  }, [enabled, onStatus]);
  return null;
}
