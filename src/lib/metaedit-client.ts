import type { PatchOperation, WorkspaceState } from "@/types/metaedit";

export async function metaEditRequest<T = Record<string, unknown>>(action: string, payload: Record<string, unknown> = {}, options: { signal?: AbortSignal } = {}): Promise<T> {
  const response = await fetch("/api/metaedit", {
    method: "POST",
    headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
    body: JSON.stringify({ action, ...payload }),
    signal: options.signal,
  });
  const body = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(body.error ?? `MetaEdit request failed (${response.status}).`);
  return body;
}

export async function fetchWorkspaceState(scope: "workspace" | "public" = "workspace") {
  const response = await fetch(`/api/metaedit?scope=${scope}`, { cache: "no-store" });
  const body = await response.json() as { authenticated?: boolean; state?: WorkspaceState } | WorkspaceState;
  if (!response.ok) throw new Error("Not authenticated.");
  return ("state" in body ? body.state : body) as WorkspaceState;
}

export function applyPatchOperations(operations: PatchOperation[]) {
  for (const operation of operations) {
    let element: HTMLElement | null = null;
    try { element = document.querySelector<HTMLElement>(operation.selector); } catch { continue; }
    if (!element || element.closest("[data-metaedit-chrome]")) continue;
    if (operation.op === "replace_text") element.textContent = operation.value;
    if (operation.op === "set_style") element.style[operation.property] = operation.value;
    if (operation.op === "set_visibility") element.hidden = !operation.visible;
  }
}

export function focusMetaEditTarget(selector: string) {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) throw new Error("The annotated element is not present on this page.");
  element.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
  element.animate([
    { outline: "3px solid rgba(48,93,222,0)", outlineOffset: "8px" },
    { outline: "3px solid rgba(48,93,222,.75)", outlineOffset: "4px" },
    { outline: "3px solid rgba(48,93,222,0)", outlineOffset: "8px" },
  ], { duration: 1200, easing: "ease-out" });
}
