"use client";

import * as React from "react";
import { focusMetaEditTarget, metaEditRequest } from "@/lib/metaedit-client";
import type { WorkspaceState } from "@/types/metaedit";

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
    const tools: WebMCPTool[] = [
      {
        name: "metaedit_get_workspace",
        description: "Read the current MetaEdit workspace, collaborators, annotations, revision proposals, approvals, and published version before deciding what to change.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute: () => result(currentState()),
      },
      {
        name: "metaedit_list_annotations",
        description: "List open UI annotations with stable selectors, original text and computed style snapshots, author attribution, and comments.",
        inputSchema: { type: "object", properties: { status: { type: "string", enum: ["open", "resolved", "all"] } }, additionalProperties: false },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute: ({ status = "open" }) => {
          const current = currentState();
          return result(current.annotations.filter((item) => status === "all" || item.status === status));
        },
      },
      {
        name: "metaedit_inspect_annotation",
        description: "Inspect one annotation and its related revisions before proposing a safe UI patch.",
        inputSchema: { type: "object", properties: { annotationId: { type: "string" } }, required: ["annotationId"], additionalProperties: false },
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute: ({ annotationId }) => {
          const current = currentState();
          return result({ annotation: current.annotations.find((item) => item.id === annotationId), revisions: current.revisions.filter((item) => item.annotationId === annotationId) });
        },
      },
      {
        name: "metaedit_create_annotation",
        description: "Create an attributed annotation for a UI target. Use target metadata collected from the page inspector, including selector, original text, and style snapshot.",
        inputSchema: { type: "object", properties: { target: { type: "object", description: "TargetMetadata from the MetaEdit inspector" }, comment: { type: "string", minLength: 1 } }, required: ["target", "comment"], additionalProperties: false },
        annotations: { untrustedContentHint: true },
        execute: (input, options) => call("create_annotation", input, options),
      },
      {
        name: "metaedit_propose_revision",
        description: "Propose a preview-only revision for one annotation. Allowed operations are replace_text, set_style with an allowlisted property, and set_visibility. Every operation must use the annotation selector. Never inject HTML, scripts, or CSS classes.",
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
        description: "Publish an approved revision to the public page. Only the workspace owner can do this, and all active collaborators must have approved.",
        inputSchema: { type: "object", properties: { revisionId: { type: "string" } }, required: ["revisionId"], additionalProperties: false },
        annotations: { untrustedContentHint: true },
        execute: (input, options) => call("publish_revision", input, options),
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
    void Promise.all(tools.map((tool) => Promise.resolve().then(() => context.registerTool(tool, { signal: controller.signal })))).catch((error: unknown) => {
      if (!controller.signal.aborted) console.warn("MetaEdit WebMCP tool registration failed", error);
    });
    return () => controller.abort();
  }, [enabled, onStatus]);
  return null;
}
