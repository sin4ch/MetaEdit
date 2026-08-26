"use client";

import * as React from "react";
import { focusMetaEditTarget, metaEditRequest } from "@/lib/metaedit-client";
import type { WorkspaceState } from "@/types/metaedit";

const result = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] });

export function WebMCPRegistry({ enabled, state, onState, onStatus }: { enabled: boolean; state: WorkspaceState | null; onState: (state: WorkspaceState) => void; onStatus?: (available: boolean) => void }) {
  React.useEffect(() => {
    const context = document.modelContext;
    const available = Boolean(context);
    onStatus?.(available);
    if (!enabled || !context || !state) return;

    const call = async (action: string, input: Record<string, unknown>) => {
      const response = await metaEditRequest<{ state?: WorkspaceState }>(action, input);
      if (response.state) onState(response.state);
      return result(response);
    };
    const tools: WebMCPTool[] = [
      {
        name: "metaedit_get_workspace",
        description: "Read the current MetaEdit workspace, collaborators, annotations, revision proposals, approvals, and published version before deciding what to change.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: true },
        execute: () => result(state),
      },
      {
        name: "metaedit_list_annotations",
        description: "List open UI annotations with stable selectors, original text and computed style snapshots, author attribution, and comments.",
        inputSchema: { type: "object", properties: { status: { type: "string", enum: ["open", "resolved", "all"] } }, additionalProperties: false },
        annotations: { readOnlyHint: true },
        execute: ({ status = "open" }) => result(state.annotations.filter((item) => status === "all" || item.status === status)),
      },
      {
        name: "metaedit_inspect_annotation",
        description: "Inspect one annotation and its related revisions before proposing a safe UI patch.",
        inputSchema: { type: "object", properties: { annotationId: { type: "string" } }, required: ["annotationId"], additionalProperties: false },
        annotations: { readOnlyHint: true },
        execute: ({ annotationId }) => result({ annotation: state.annotations.find((item) => item.id === annotationId), revisions: state.revisions.filter((item) => item.annotationId === annotationId) }),
      },
      {
        name: "metaedit_create_annotation",
        description: "Create an attributed annotation for a UI target. Use target metadata collected from the page inspector, including selector, original text, and style snapshot.",
        inputSchema: { type: "object", properties: { target: { type: "object", description: "TargetMetadata from the MetaEdit inspector" }, comment: { type: "string", minLength: 1 } }, required: ["target", "comment"], additionalProperties: false },
        execute: (input) => call("create_annotation", input),
      },
      {
        name: "metaedit_propose_revision",
        description: "Propose a preview-only revision for one annotation. Allowed operations are replace_text, set_style with an allowlisted property, and set_visibility. Every operation must use the annotation selector. Never inject HTML, scripts, or CSS classes.",
        inputSchema: { type: "object", properties: { annotationId: { type: "string" }, instruction: { type: "string" }, baseVersion: { type: "integer" }, patch: { type: "array", minItems: 1, maxItems: 20, items: { type: "object" } } }, required: ["annotationId", "instruction", "baseVersion", "patch"], additionalProperties: false },
        execute: (input) => call("propose_revision", input),
      },
      {
        name: "metaedit_review_revision",
        description: "Approve or reject a proposed MetaEdit revision on behalf of the authenticated collaborator.",
        inputSchema: { type: "object", properties: { revisionId: { type: "string" }, decision: { type: "string", enum: ["approved", "rejected"] } }, required: ["revisionId", "decision"], additionalProperties: false },
        execute: (input) => call("review_revision", input),
      },
      {
        name: "metaedit_publish_revision",
        description: "Publish an approved revision to the public page. Only the workspace owner can do this, and all active collaborators must have approved.",
        inputSchema: { type: "object", properties: { revisionId: { type: "string" } }, required: ["revisionId"], additionalProperties: false },
        execute: (input) => call("publish_revision", input),
      },
      {
        name: "metaedit_focus_target",
        description: "Scroll the browser to an annotated UI target and briefly highlight it for the human collaborator.",
        inputSchema: { type: "object", properties: { selector: { type: "string" } }, required: ["selector"], additionalProperties: false },
        annotations: { readOnlyHint: true },
        execute: ({ selector }) => { focusMetaEditTarget(String(selector)); return result({ focused: selector }); },
      },
    ];
    for (const tool of tools) context.registerTool(tool);
    return () => { for (const tool of tools) context.unregisterTool(tool.name); };
  }, [enabled, state, onState, onStatus]);
  return null;
}
