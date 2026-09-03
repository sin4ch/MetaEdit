"use client";

import * as React from "react";
import type { HighlightedElement, MetaEditRect, TargetMetadata } from "@/types/metaedit";

interface GlobalInspectorProps {
  isInspecting: boolean;
  selectedTarget: TargetMetadata | null;
  onSelectTarget: (target: TargetMetadata) => void;
  onSelectRegion: (target: TargetMetadata) => void;
  selectionColor?: string;
}

interface RectBox {
  top: number;
  left: number;
  width: number;
  height: number;
  tagName: string;
  componentName: string;
  elementId: string;
  sourceFile: string;
  selector: string;
  textSnapshot: string;
  styleSnapshot: Record<string, string>;
}

interface Point {
  x: number;
  y: number;
}

interface DrawRect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function GlobalInspector({
  isInspecting,
  selectedTarget,
  onSelectTarget,
  onSelectRegion,
  selectionColor,
}: GlobalInspectorProps) {
  const [hoverRect, setHoverRect] = React.useState<RectBox | null>(null);
  const [selectedRect, setSelectedRect] = React.useState<RectBox | null>(null);
  const [drawRect, setDrawRect] = React.useState<DrawRect | null>(null);
  const [viewportOffset, setViewportOffset] = React.useState({ x: 0, y: 0 });
  const suppressClickRef = React.useRef(false);
  const drawStartRef = React.useRef<Point | null>(null);
  const dragActiveRef = React.useRef(false);
  const accentColor = selectionColor ?? "#305dde";

  // Derive component name / context from ANY element
  const getElementMeta = (el: HTMLElement): RectBox => {
    const rect = el.getBoundingClientRect();
    const scrollY = window.scrollY || document.documentElement.scrollTop;
    const scrollX = window.scrollX || document.documentElement.scrollLeft;

    // Check data attributes or class/tag
    const customComponent = el.getAttribute("data-component");
    const customSource = el.getAttribute("data-source");
    const customId = el.getAttribute("data-instance-id") || el.getAttribute("data-metaedit-id") || el.id;

    let componentName = customComponent;
    if (!componentName) {
      const tag = el.tagName.toLowerCase();
      if (tag === "h1") componentName = "HeroHeadline";
      else if (tag === "h2") componentName = "SectionHeader";
      else if (tag === "h3") componentName = "CardHeader";
      else if (tag === "h4" || tag === "h5" || tag === "h6") componentName = "HeadingText";
      else if (tag === "button") componentName = "Button";
      else if (tag === "a") componentName = "NavLink";
      else if (tag === "p") componentName = "ParagraphText";
      else if (tag === "span") componentName = "TextSpan";
      else if (tag === "nav") componentName = "Navigation";
      else if (tag === "header") componentName = "Header";
      else if (tag === "footer") componentName = "FooterCard";
      else if (tag === "section") componentName = "PageSection";
      else if (tag === "input" || tag === "textarea") componentName = "InputField";
      else {
        const className = typeof el.className === "string" ? el.className : "";
        if (className.includes("card") || className.includes("rounded")) componentName = "CardSurface";
        else componentName = tag.toUpperCase();
      }
    }

    const sourceFile = customSource || `src/app/page.tsx`;
    const stablePath = getStablePath(el);
    const elementId = customId || `target-${hashString(stablePath)}`;
    if (!el.dataset.metaeditId) el.dataset.metaeditId = elementId;
    const computed = window.getComputedStyle(el);
    const styleSnapshot = Object.fromEntries(
      ["color", "backgroundColor", "borderColor", "borderRadius", "fontSize", "fontWeight", "letterSpacing", "lineHeight", "textAlign", "padding", "margin", "gap", "width", "maxWidth", "minHeight", "opacity"].map((property) => [property, computed[property as keyof CSSStyleDeclaration] as string])
    );

    return {
      top: rect.top + scrollY,
      left: rect.left + scrollX,
      width: rect.width,
      height: rect.height,
      tagName: el.tagName.toLowerCase(),
      componentName,
      elementId,
      sourceFile,
      selector: stablePath,
      textSnapshot: el.textContent?.trim() ?? "",
      styleSnapshot,
    };
  };

  React.useEffect(() => {
    if (!isInspecting) return;
    suppressClickRef.current = false;

    const isIgnored = (target: HTMLElement | null): boolean => isIgnoredTarget(target, false);

    const handleMouseMove = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (drawStartRef.current) {
        setHoverRect(null);
        return;
      }
      if (isIgnored(target)) {
        setHoverRect(null);
        return;
      }
      if (target) {
        const meta = getElementMeta(target);
        setHoverRect(meta);
      }
    };

    const handleSelect = (target: HTMLElement) => {
      const meta = getElementMeta(target);
      setSelectedRect(meta);
      onSelectTarget({
        component: meta.componentName,
        source: meta.sourceFile,
        instanceId: meta.elementId,
        selector: meta.selector,
        textSnapshot: meta.textSnapshot,
        styleSnapshot: meta.styleSnapshot,
        boundingRect: {
          top: meta.top,
          left: meta.left,
          width: meta.width,
          height: meta.height,
        },
      });
      drawStartRef.current = null;
      dragActiveRef.current = false;
      setDrawRect(null);
    };

    const handleClick = (e: MouseEvent) => {
      if (suppressClickRef.current) {
        suppressClickRef.current = false;
        return;
      }
      const target = e.target as HTMLElement | null;
      if (isIgnored(target)) return;

      e.preventDefault();
      e.stopPropagation();

      if (target) handleSelect(target);
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (e.button !== 0 || isIgnoredTarget(e.target as HTMLElement | null, true)) return;
      e.preventDefault();
      e.stopPropagation();
      const point = { x: e.clientX, y: e.clientY };
      drawStartRef.current = point;
      dragActiveRef.current = false;
      setDrawRect({ top: point.y, left: point.x, width: 0, height: 0 });
    };

    const handlePointerMove = (e: PointerEvent) => {
      const start = drawStartRef.current;
      if (!start) return;
      e.preventDefault();
      e.stopPropagation();
      const rect = normalizeDrawRect(start, { x: e.clientX, y: e.clientY });
      if (rect.width > 6 || rect.height > 6) dragActiveRef.current = true;
      setDrawRect(rect);
    };

    const handlePointerUp = (e: PointerEvent) => {
      const start = drawStartRef.current;
      if (!start) return;
      e.preventDefault();
      e.stopPropagation();
      const rect = normalizeDrawRect(start, { x: e.clientX, y: e.clientY });
      const wasDrag = dragActiveRef.current;
      drawStartRef.current = null;
      dragActiveRef.current = false;
      setDrawRect(null);
      suppressClickRef.current = true;

      if (wasDrag && rect.width >= 8 && rect.height >= 8) {
        onSelectRegion(buildRegionTarget(rect, getElementMeta));
        return;
      }

      const target = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      if (!isIgnored(target) && target) handleSelect(target);
    };

    const handlePointerCancel = () => {
      drawStartRef.current = null;
      dragActiveRef.current = false;
      setDrawRect(null);
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("click", handleClick, { capture: true });
    window.addEventListener("pointerdown", handlePointerDown, { capture: true });
    window.addEventListener("pointermove", handlePointerMove, { capture: true });
    window.addEventListener("pointerup", handlePointerUp, { capture: true });
    window.addEventListener("pointercancel", handlePointerCancel, { capture: true });

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("click", handleClick, { capture: true });
      window.removeEventListener("pointerdown", handlePointerDown, { capture: true });
      window.removeEventListener("pointermove", handlePointerMove, { capture: true });
      window.removeEventListener("pointerup", handlePointerUp, { capture: true });
      window.removeEventListener("pointercancel", handlePointerCancel, { capture: true });
    };
  }, [isInspecting, onSelectTarget, onSelectRegion]);

  React.useEffect(() => {
    const previousCursor = document.body.style.cursor;
    if (isInspecting) document.body.style.cursor = "crosshair";
    return () => { document.body.style.cursor = previousCursor; };
  }, [isInspecting]);

  React.useEffect(() => {
    if (!isInspecting && !selectedTarget) return;
    const syncViewportOffset = () => setViewportOffset({ x: window.scrollX, y: window.scrollY });
    syncViewportOffset();
    window.addEventListener("scroll", syncViewportOffset, { passive: true });
    window.addEventListener("resize", syncViewportOffset);
    return () => {
      window.removeEventListener("scroll", syncViewportOffset);
      window.removeEventListener("resize", syncViewportOffset);
    };
  }, [isInspecting, selectedTarget]);

  return (
    <div className={`pointer-events-none fixed inset-0 z-[60] overflow-visible${isInspecting ? " cursor-crosshair" : ""}`} data-metaedit-chrome="true">
      {/* Hover Rect: Clean sharp bounding box precisely over the element */}
      {isInspecting && hoverRect && (
        <div
          style={{
            position: "absolute",
            top: hoverRect.top - viewportOffset.y,
            left: hoverRect.left - viewportOffset.x,
            width: hoverRect.width,
            height: hoverRect.height,
            border: `1.5px solid ${accentColor}`,
            backgroundColor: colorWithAlpha(accentColor, 0.05),
            boxSizing: "border-box",
            pointerEvents: "none",
            zIndex: 9999,
          }}
        >
          {/* Top Pill Tag */}
          <div
            style={{
              position: "absolute",
              top: "-22px",
              left: "0px",
              backgroundColor: accentColor,
              color: "#ffffff",
              fontSize: "11px",
              fontWeight: 500,
              fontFamily: "var(--font-sans)",
              padding: "2px 8px",
              whiteSpace: "nowrap",
              display: "flex",
              alignItems: "center",
              gap: "4px",
              boxShadow: "0 1px 4px rgba(0,0,0,0.15)",
            }}
          >
            <span>{hoverRect.componentName}</span>
            <span style={{ opacity: 0.75, fontFamily: "monospace", fontSize: "10px" }}>
              #{hoverRect.elementId}
            </span>
          </div>
        </div>
      )}

      {/* Selected Rect: Clean blue highlight */}
      {selectedTarget?.selectionType !== "region" && selectedTarget && selectedRect && (
        <div
          style={{
            position: "absolute",
            top: selectedRect.top - viewportOffset.y,
            left: selectedRect.left - viewportOffset.x,
            width: selectedRect.width,
            height: selectedRect.height,
            border: `2px solid ${accentColor}`,
            backgroundColor: colorWithAlpha(accentColor, 0.08),
            boxSizing: "border-box",
            pointerEvents: "none",
            zIndex: 9998,
          }}
        />
      )}

      {isInspecting && drawRect && (
        <div
          style={{
            position: "fixed",
            top: drawRect.top,
            left: drawRect.left,
            width: drawRect.width,
            height: drawRect.height,
            border: `2px solid ${accentColor}`,
            backgroundColor: colorWithAlpha(accentColor, 0.1),
            boxSizing: "border-box",
            pointerEvents: "none",
            zIndex: 10000,
          }}
        >
          <div className="absolute left-0 top-0 -translate-y-full rounded-t-md px-2 py-1 text-[10px] font-medium text-white shadow-sm whitespace-nowrap" style={{ backgroundColor: accentColor }}>
            Freeform area · release to select
          </div>
        </div>
      )}

      {selectedTarget?.selectionType === "region" && selectedTarget.region && (
        <div
          style={{
            position: "fixed",
            top: selectedTarget.region.top - viewportOffset.y,
            left: selectedTarget.region.left - viewportOffset.x,
            width: selectedTarget.region.width,
            height: selectedTarget.region.height,
            border: `2px solid ${accentColor}`,
            backgroundColor: colorWithAlpha(accentColor, 0.08),
            boxSizing: "border-box",
            pointerEvents: "none",
            zIndex: 9998,
          }}
        >
          <div className="absolute left-0 top-0 -translate-y-full rounded-t-md px-2 py-1 text-[10px] font-medium text-white shadow-sm whitespace-nowrap" style={{ backgroundColor: accentColor }}>
            Freeform area · {selectedTarget.highlightedElements?.length ?? 0} elements
          </div>
        </div>
      )}
    </div>
  );
}

function isIgnoredTarget(target: HTMLElement | null, allowPageRoots: boolean): boolean {
  if (!target || !(target instanceof Element)) return true;
  if (target.closest("[data-metaedit-chrome]")) return true;
  if (!allowPageRoots && (target === document.body || target === document.documentElement)) return true;
  return false;
}

function colorWithAlpha(color: string, alpha: number) {
  const match = color.trim().match(/^#([\da-f]{6})$/i);
  if (!match) return color;
  const value = Number.parseInt(match[1], 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function normalizeDrawRect(start: Point, end: Point): DrawRect {
  return { top: Math.min(start.y, end.y), left: Math.min(start.x, end.x), width: Math.abs(end.x - start.x), height: Math.abs(end.y - start.y) };
}

function buildRegionTarget(rect: DrawRect, getElementMeta: (element: HTMLElement) => RectBox): TargetMetadata {
  const scrollX = window.scrollX || document.documentElement.scrollLeft;
  const scrollY = window.scrollY || document.documentElement.scrollTop;
  const region = { top: rect.top + scrollY, left: rect.left + scrollX, width: rect.width, height: rect.height } satisfies MetaEditRect;
  const highlightedElements = getHighlightedElements(rect, getElementMeta);
  const elementSummary = highlightedElements.filter((element) => element.textSnapshot).slice(0, 6).map((element) => `${element.component}: ${element.textSnapshot.replace(/\s+/g, " ").slice(0, 180)}`).join(" | ");
  const textSnapshot = elementSummary || "No text elements were intersected; the selected area is whitespace.";
  const description = highlightedElements.length === 0
    ? `Freeform region ${Math.round(rect.width)} × ${Math.round(rect.height)} px containing only whitespace.`
    : `Freeform region ${Math.round(rect.width)} × ${Math.round(rect.height)} px intersecting ${highlightedElements.length} visible element${highlightedElements.length === 1 ? "" : "s"}.`;
  const regionId = `region-${Math.round(region.left)}-${Math.round(region.top)}-${Math.round(region.width)}-${Math.round(region.height)}-${Date.now().toString(36)}`;
  return {
    component: "FreeformRegion",
    source: "viewport",
    instanceId: regionId,
    selector: "body",
    textSnapshot: textSnapshot.slice(0, 12000),
    styleSnapshot: {},
    selectionType: "region",
    region,
    boundingRect: region,
    highlightedElements,
    description,
  };
}

function getHighlightedElements(rect: DrawRect, getElementMeta: (element: HTMLElement) => RectBox): HighlightedElement[] {
  const selectors = "[data-component], h1, h2, h3, h4, h5, h6, p, button, a, input, textarea, section, article, nav, header, footer";
  const seen = new Set<string>();
  return Array.from(document.querySelectorAll<HTMLElement>(selectors)).map((element) => {
    if (isIgnoredTarget(element, true) || element.hidden) return null;
    const bounds = element.getBoundingClientRect();
    const intersectionWidth = Math.max(0, Math.min(rect.left + rect.width, bounds.right) - Math.max(rect.left, bounds.left));
    const intersectionHeight = Math.max(0, Math.min(rect.top + rect.height, bounds.bottom) - Math.max(rect.top, bounds.top));
    const intersectionArea = intersectionWidth * intersectionHeight;
    if (intersectionArea <= 0) return null;
    const meta = getElementMeta(element);
    if (seen.has(meta.selector)) return null;
    seen.add(meta.selector);
    return {
      selector: meta.selector,
      component: meta.componentName,
      instanceId: meta.elementId,
      tagName: meta.tagName,
      textSnapshot: meta.textSnapshot.slice(0, 1200),
      styleSnapshot: meta.styleSnapshot,
      boundingRect: { top: meta.top, left: meta.left, width: meta.width, height: meta.height },
      intersectionRatio: Math.min(1, intersectionArea / Math.max(1, bounds.width * bounds.height)),
    } satisfies HighlightedElement;
  }).filter((element): element is HighlightedElement => Boolean(element)).slice(0, 40);
}

function getStablePath(element: HTMLElement) {
  const parts: string[] = [];
  let current: HTMLElement | null = element;
  while (current && current !== document.body && parts.length < 8) {
    const tag = current.tagName.toLowerCase();
    const siblings = current.parentElement ? Array.from(current.parentElement.children).filter((item) => item.tagName === current!.tagName) : [];
    const index = Math.max(1, siblings.indexOf(current) + 1);
    parts.unshift(`${tag}:nth-of-type(${index})`);
    current = current.parentElement;
  }
  return parts.join(" > ");
}

function hashString(value: string) {
  let hash = 2166136261;
  for (const character of value) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
  return (hash >>> 0).toString(36);
}
