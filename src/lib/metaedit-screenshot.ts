import type { Annotation, HighlightedElement, MetaEditRect, TargetMetadata } from "@/types/metaedit";

const SCREENSHOT_MAX_PIXELS = 1_200_000;

/**
 * Capture a small, self-contained SVG snapshot of the annotated target.
 *
 * SVG keeps this browser-only helper dependency-free and avoids canvas/CORS
 * failures from images on the host page.  The resulting data URL can be
 * stored with the annotation and committed to the review pull request.
 */
export function captureMetaEditScreenshot(target: TargetMetadata): string | null {
  if (typeof document === "undefined" || typeof window === "undefined") return null;

  const bounds = target.selectionType === "region" ? target.region : target.boundingRect;
  if (!bounds || bounds.width <= 0 || bounds.height <= 0) return null;
  const width = Math.min(Math.ceil(bounds.width), 1600);
  const height = Math.min(Math.ceil(bounds.height), 1200);
  if (width * height > SCREENSHOT_MAX_PIXELS) return null;

  const svgBody = target.selectionType === "region"
    ? captureRegion(target, bounds)
    : captureElement(target.selector, bounds);
  if (!svgBody) return null;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="100%" height="100%" fill="white"/><foreignObject width="${width}" height="${height}">${svgBody}</foreignObject></svg>`;
  try {
    const bytes = new TextEncoder().encode(svg);
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return `data:image/svg+xml;base64,${btoa(binary)}`;
  } catch {
    return null;
  }
}

export function annotationToScreenshotTarget(annotation: Annotation): TargetMetadata {
  const element = annotation.selectionType === "region" ? null : document.querySelector<HTMLElement>(annotation.selector);
  const rect = element?.getBoundingClientRect();
  const scrollX = window.scrollX || document.documentElement.scrollLeft;
  const scrollY = window.scrollY || document.documentElement.scrollTop;
  return {
    component: annotation.component,
    source: annotation.source,
    instanceId: annotation.targetId,
    selector: annotation.selector,
    textSnapshot: element?.textContent?.trim() ?? annotation.textSnapshot,
    styleSnapshot: annotation.styleSnapshot,
    selectionType: annotation.selectionType,
    region: annotation.region ?? undefined,
    highlightedElements: annotation.highlightedElements,
    boundingRect: rect ? { top: rect.top + scrollY, left: rect.left + scrollX, width: rect.width, height: rect.height } : undefined,
  };
}

function captureElement(selector: string, bounds: MetaEditRect): string | null {
  const element = queryElement(selector);
  if (!element) return null;
  const clone = cloneWithComputedStyles(element);
  const style = `display:block;box-sizing:border-box;width:${Math.max(0, bounds.width)}px;height:${Math.max(0, bounds.height)}px;overflow:hidden;`;
  clone.setAttribute("style", `${clone.getAttribute("style") ?? ""};${style}`);
  return `<div xmlns="http://www.w3.org/1999/xhtml" style="margin:0;padding:0;width:${bounds.width}px;height:${bounds.height}px;overflow:hidden;background:white">${clone.outerHTML}</div>`;
}

function captureRegion(target: TargetMetadata, bounds: MetaEditRect): string {
  const elements = (target.highlightedElements ?? [])
    .map((item) => ({ item, element: queryElement(item.selector) }))
    .filter((entry): entry is { item: HighlightedElement; element: HTMLElement } => Boolean(entry.element));
  const children = elements.map(({ item, element }) => {
    const clone = cloneWithComputedStyles(element);
    const left = item.boundingRect.left - bounds.left;
    const top = item.boundingRect.top - bounds.top;
    clone.setAttribute("style", `${clone.getAttribute("style") ?? ""};position:absolute;left:${left}px;top:${top}px;width:${item.boundingRect.width}px;height:${item.boundingRect.height}px;overflow:hidden;`);
    return clone.outerHTML;
  }).join("");
  return `<div xmlns="http://www.w3.org/1999/xhtml" style="position:relative;margin:0;padding:0;width:${bounds.width}px;height:${bounds.height}px;overflow:hidden;background:white">${children}</div>`;
}

function queryElement(selector: string): HTMLElement | null {
  try {
    const element = document.querySelector<HTMLElement>(selector);
    if (!element || element.closest("[data-metaedit-chrome]")) return null;
    return element;
  } catch {
    return null;
  }
}

function cloneWithComputedStyles(element: HTMLElement): HTMLElement {
  const clone = element.cloneNode(true) as HTMLElement;
  copyComputedStyles(element, clone);
  const sourceChildren = Array.from(element.children);
  const cloneChildren = Array.from(clone.children);
  sourceChildren.forEach((child, index) => {
    const clonedChild = cloneChildren[index];
    if (clonedChild instanceof HTMLElement && child instanceof HTMLElement) copyComputedTree(child, clonedChild);
  });
  clone.querySelectorAll<HTMLElement>("[data-metaedit-chrome]").forEach((item) => item.remove());
  return clone;
}

function copyComputedTree(source: HTMLElement, destination: HTMLElement) {
  copyComputedStyles(source, destination);
  const sourceChildren = Array.from(source.children);
  const destinationChildren = Array.from(destination.children);
  sourceChildren.forEach((child, index) => {
    const clonedChild = destinationChildren[index];
    if (clonedChild instanceof HTMLElement && child instanceof HTMLElement) copyComputedTree(child, clonedChild);
  });
}

function copyComputedStyles(source: HTMLElement, destination: HTMLElement) {
  const computed = window.getComputedStyle(source);
  const properties = [
    "box-sizing", "display", "position", "inset", "top", "right", "bottom", "left", "width", "height", "min-width", "max-width", "min-height", "max-height",
    "margin", "padding", "border", "border-radius", "background", "background-color", "color", "opacity", "box-shadow", "font", "font-family", "font-size", "font-weight", "font-style", "line-height", "letter-spacing", "text-align", "text-transform", "white-space", "word-break", "overflow", "flex", "flex-direction", "flex-wrap", "align-items", "align-content", "justify-content", "gap", "grid-template-columns", "grid-template-rows", "visibility",
  ];
  for (const property of properties) {
    const value = computed.getPropertyValue(property);
    if (value) destination.style.setProperty(property, value);
  }
  destination.removeAttribute("data-metaedit-chrome");
  destination.removeAttribute("data-metaedit-id");
}
