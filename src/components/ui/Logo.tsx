"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

export type LogoVariantType =
  | "hyper_m_cube"
  | "aperture_code_lens"
  | "duality_portal"
  | "quantum_cursor"
  | "isometric_stack"
  | "origami_prism"
  | "neural_brackets"
  | "vortex_ring"
  | "stepped_glyph"
  | "orbit_ast";

export function MetaEditLogo({
  className = "size-7",
  styleVariant = "origami_prism",
  tone = "primary",
}: {
  className?: string;
  styleVariant?: LogoVariantType;
  tone?: "primary" | "light" | "dark";
}) {
  const cPrimary = tone === "light" ? "#d1d5db" : tone === "dark" ? "#191919" : "#305dde";
  const cSecondary = tone === "light" ? "#9ca3af" : tone === "dark" ? "rgba(25,25,25,0.3)" : "rgba(48,93,222,0.35)";
  const cAccent = tone === "light" ? "#e5e7eb" : tone === "dark" ? "#6e6e6e" : "#3ba6f1";

  // 1. ORIGAMI PRISM (Scales and touches circle boundaries at sharp tips)
  if (styleVariant === "origami_prism") {
    return (
      <svg className={cn("shrink-0", className)} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Top apex at (50, 0), side wings at (7, 80) and (93, 80), bottom feet at (30, 100) and (70, 100) */}
        <polygon points="50,0 7,80 50,62" fill={cPrimary} />
        <polygon points="50,0 93,80 50,62" fill={cSecondary} />
        <polygon points="7,80 50,62 30,100" fill={cAccent} />
        <polygon points="93,80 50,62 70,100" fill={cPrimary} fillOpacity="0.75" />
        <circle cx="50" cy="34" r="6" fill={tone === "light" ? "#242424" : "#ffffff"} />
      </svg>
    );
  }

  // Fallback / default
  return (
    <svg className={cn("shrink-0", className)} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
      <polygon points="50,0 7,80 50,62" fill={cPrimary} />
      <polygon points="50,0 93,80 50,62" fill={cSecondary} />
      <polygon points="7,80 50,62 30,100" fill={cAccent} />
      <polygon points="93,80 50,62 70,100" fill={cPrimary} fillOpacity="0.75" />
      <circle cx="50" cy="34" r="6" fill={tone === "light" ? "#242424" : "#ffffff"} />
    </svg>
  );
}
