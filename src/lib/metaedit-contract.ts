import type { EditableStyleProperty, PatchOperation, TargetMetadata } from "@/types/metaedit";

export const EDITABLE_STYLE_PROPERTIES = new Set<EditableStyleProperty>([
  "color", "backgroundColor", "borderColor", "borderRadius", "fontSize", "fontWeight", "letterSpacing", "lineHeight", "textAlign", "padding", "margin", "gap", "width", "maxWidth", "minHeight", "opacity",
]);

const SAFE_SELECTOR = /^(?:\[data-metaedit-id="[a-zA-Z0-9:_-]+"\]|#[a-zA-Z][a-zA-Z0-9:_-]*|(?:[a-z][a-z0-9-]*)(?:\:nth-of-type\(\d+\))?(?: > (?:[a-z][a-z0-9-]*)(?:\:nth-of-type\(\d+\))?){0,8})$/;

export function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected an object.");
  return value as Record<string, unknown>;
}

export function readString(record: Record<string, unknown>, key: string, options: { min?: number; max?: number; optional?: boolean } = {}): string | undefined {
  const value = record[key];
  if (value === undefined && options.optional) return undefined;
  if (typeof value !== "string") throw new Error(`${key} must be a string.`);
  const trimmed = value.trim();
  if (trimmed.length < (options.min ?? 1)) throw new Error(`${key} is too short.`);
  if (trimmed.length > (options.max ?? 4000)) throw new Error(`${key} is too long.`);
  return trimmed;
}

export function validateSelector(selector: string): string {
  if (!SAFE_SELECTOR.test(selector)) throw new Error("The target selector is not safe or stable.");
  return selector;
}

export function validateTarget(value: unknown): TargetMetadata {
  const target = asRecord(value);
  const styles = asRecord(target.styleSnapshot ?? {});
  const styleSnapshot: Record<string, string> = {};
  for (const [key, item] of Object.entries(styles).slice(0, 24)) if (typeof item === "string") styleSnapshot[key] = item.slice(0, 300);
  return {
    component: readString(target, "component", { max: 120 })!,
    source: readString(target, "source", { max: 240 })!,
    instanceId: readString(target, "instanceId", { max: 160 })!,
    selector: validateSelector(readString(target, "selector", { max: 600 })!),
    textSnapshot: typeof target.textSnapshot === "string" ? target.textSnapshot.slice(0, 12000) : "",
    styleSnapshot,
  };
}

export function validatePatchOperations(value: unknown): PatchOperation[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 20) throw new Error("patch must contain between 1 and 20 operations.");
  return value.map((raw) => {
    const operation = asRecord(raw);
    const op = readString(operation, "op", { max: 40 });
    const selector = validateSelector(readString(operation, "selector", { max: 600 })!);
    if (op === "replace_text") {
      if (typeof operation.value !== "string" || operation.value.length > 12000) throw new Error("Replacement text must be 12,000 characters or fewer.");
      return { op, selector, value: operation.value };
    }
    if (op === "set_style") {
      const property = readString(operation, "property", { max: 40 }) as EditableStyleProperty;
      if (!EDITABLE_STYLE_PROPERTIES.has(property)) throw new Error(`${property} cannot be edited.`);
      const styleValue = readString(operation, "value", { max: 300 })!;
      if (/url\s*\(|expression\s*\(|javascript:/i.test(styleValue)) throw new Error("Unsafe style value.");
      return { op, selector, property, value: styleValue };
    }
    if (op === "set_visibility") {
      if (typeof operation.visible !== "boolean") throw new Error("visible must be a boolean.");
      return { op, selector, visible: operation.visible };
    }
    throw new Error(`Unsupported patch operation: ${op}`);
  });
}

export function captureBeforeOperations(patch: PatchOperation[], annotation: { selector: string; textSnapshot: string; styleSnapshot: Record<string, string> }): PatchOperation[] {
  return patch.map((operation) => {
    if (operation.op === "replace_text") return { op: "replace_text", selector: operation.selector, value: operation.selector === annotation.selector ? annotation.textSnapshot : "" };
    if (operation.op === "set_style") return { op: "set_style", selector: operation.selector, property: operation.property, value: operation.selector === annotation.selector ? (annotation.styleSnapshot[operation.property] ?? "") : "" };
    return { op: "set_visibility", selector: operation.selector, visible: true };
  });
}
