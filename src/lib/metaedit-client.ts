import type { MetaEditRect, PatchOperation, WorkspaceState } from "@/types/metaedit";

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

export function focusMetaEditTarget(selector: string, color = "#305dde") {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) throw new Error("The annotated element is not present on this page.");
  const accentColor = color || "#305dde";
  element.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
  element.animate([
    { outline: `3px solid ${colorWithAlpha(accentColor, 0)}`, outlineOffset: "8px" },
    { outline: `3px solid ${colorWithAlpha(accentColor, 0.75)}`, outlineOffset: "4px" },
    { outline: `3px solid ${colorWithAlpha(accentColor, 0)}`, outlineOffset: "8px" },
  ], { duration: 1200, easing: "ease-out" });
}

export function focusMetaEditRegion(region: MetaEditRect, color = "#305dde") {
  const accentColor = color || "#305dde";
  const top = Math.max(0, region.top - (window.innerHeight - region.height) / 2);
  const left = Math.max(0, region.left - (window.innerWidth - region.width) / 2);
  window.scrollTo({ top, left, behavior: "smooth" });

  const marker = document.createElement("div");
  marker.dataset.metaeditChrome = "true";
  marker.setAttribute("aria-hidden", "true");
  Object.assign(marker.style, {
    position: "absolute",
    top: `${region.top}px`,
    left: `${region.left}px`,
    width: `${region.width}px`,
    height: `${region.height}px`,
    boxSizing: "border-box",
    border: `2px solid ${colorWithAlpha(accentColor, 0.9)}`,
    background: colorWithAlpha(accentColor, 0.08),
    borderRadius: "8px",
    pointerEvents: "none",
    zIndex: "9998",
  });
  document.body.appendChild(marker);
  marker.animate([
    { opacity: 0, transform: "scale(.98)" },
    { opacity: 1, transform: "scale(1)", offset: 0.25 },
    { opacity: 1, transform: "scale(1)", offset: 0.7 },
    { opacity: 0, transform: "scale(1.01)" },
  ], { duration: 1500, easing: "ease-out" });
  window.setTimeout(() => marker.remove(), 1600);
}

function colorWithAlpha(color: string, alpha: number) {
  const match = color.trim().match(/^#([\da-f]{6})$/i);
  if (!match) return `rgba(48, 93, 222, ${alpha})`;
  const value = Number.parseInt(match[1], 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}
