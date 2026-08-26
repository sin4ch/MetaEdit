"use client";

import * as React from "react";
import { TargetMetadata } from "@/types/metaedit";

interface GlobalInspectorProps {
  isInspecting: boolean;
  selectedTarget: TargetMetadata | null;
  onSelectTarget: (target: TargetMetadata) => void;
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
}

export function GlobalInspector({
  isInspecting,
  selectedTarget,
  onSelectTarget,
}: GlobalInspectorProps) {
  const [hoverRect, setHoverRect] = React.useState<RectBox | null>(null);
  const [selectedRect, setSelectedRect] = React.useState<RectBox | null>(null);

  // Derive component name / context from ANY element
  const getElementMeta = (el: HTMLElement): RectBox => {
    const rect = el.getBoundingClientRect();
    const scrollY = window.scrollY || document.documentElement.scrollTop;
    const scrollX = window.scrollX || document.documentElement.scrollLeft;

    // Check data attributes or class/tag
    const customComponent = el.getAttribute("data-component");
    const customSource = el.getAttribute("data-source");
    const customId = el.getAttribute("data-instance-id") || el.id;

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
    const elementId = customId || `${componentName.toLowerCase()}-${Math.floor(rect.top)}`;

    return {
      top: rect.top + scrollY,
      left: rect.left + scrollX,
      width: rect.width,
      height: rect.height,
      tagName: el.tagName.toLowerCase(),
      componentName,
      elementId,
      sourceFile,
    };
  };

  React.useEffect(() => {
    if (!isInspecting) {
      setHoverRect(null);
      return;
    }

    const isIgnored = (target: HTMLElement | null): boolean => {
      if (!target) return true;
      if (
        target.closest("[data-metaedit-chrome]") ||
        target.closest("aside") ||
        target.closest("[role='dialog']")
      ) {
        return true;
      }
      if (target === document.body || target === document.documentElement) {
        return true;
      }
      return false;
    };

    const handleMouseMove = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
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
        boundingRect: {
          top: meta.top,
          left: meta.left,
          width: meta.width,
          height: meta.height,
        },
      });
    };

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (isIgnored(target)) return;

      e.preventDefault();
      e.stopPropagation();

      if (target) handleSelect(target);
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const touch = e.changedTouches[0];
      if (!touch) return;
      const target = document.elementFromPoint(touch.clientX, touch.clientY) as HTMLElement | null;
      if (isIgnored(target)) return;

      e.preventDefault();
      e.stopPropagation();

      if (target) handleSelect(target);
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    window.addEventListener("click", handleClick, { capture: true });
    window.addEventListener("touchend", handleTouchEnd, { capture: true });

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("click", handleClick, { capture: true });
      window.removeEventListener("touchend", handleTouchEnd, { capture: true });
    };
  }, [isInspecting, onSelectTarget]);

  // Update selected rect on scroll / window resize
  React.useEffect(() => {
    if (!selectedTarget) {
      setSelectedRect(null);
    }
  }, [selectedTarget]);

  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-visible" data-metaedit-chrome="true">
      {/* Hover Rect: Clean sharp bounding box precisely over the element */}
      {isInspecting && hoverRect && (
        <div
          style={{
            position: "absolute",
            top: hoverRect.top,
            left: hoverRect.left,
            width: hoverRect.width,
            height: hoverRect.height,
            border: "1.5px solid #305dde",
            backgroundColor: "rgba(48, 93, 222, 0.05)",
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
              backgroundColor: "#305dde",
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
      {selectedRect && (
        <div
          style={{
            position: "absolute",
            top: selectedRect.top,
            left: selectedRect.left,
            width: selectedRect.width,
            height: selectedRect.height,
            border: "2px solid #305dde",
            backgroundColor: "rgba(48, 93, 222, 0.08)",
            boxSizing: "border-box",
            pointerEvents: "none",
            zIndex: 9998,
          }}
        />
      )}
    </div>
  );
}
