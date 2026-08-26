"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

const CARD_CLIP_PATH =
  "shape(from var(--card-clip-radius) 0px, line to calc(100% - var(--card-clip-radius)) 0px, curve to 100% var(--card-clip-radius) with calc(100% - var(--card-clip-handle)) 0px / 100% var(--card-clip-handle), line to 100% calc(100% - var(--card-clip-radius)), curve to calc(100% - var(--card-clip-radius)) 100% with 100% calc(100% - var(--card-clip-handle)) / calc(100% - var(--card-clip-handle)) 100%, line to var(--card-clip-radius) 100%, curve to 0px calc(100% - var(--card-clip-radius)) with var(--card-clip-handle) 100% / 0px calc(100% - var(--card-clip-handle)), line to 0px var(--card-clip-radius), curve to var(--card-clip-radius) 0px with 0px var(--card-clip-handle) / var(--card-clip-handle) 0px, close)";

type SquircleStyle = React.CSSProperties & {
  "--card-clip-handle"?: string;
  "--card-clip-path"?: string;
  "--card-clip-radius"?: string;
};

export function SquircleSurface({
  className,
  style,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="squircle-surface"
      className={cn(
        "relative flex min-w-0 flex-col rounded-[26px] bg-card text-card-foreground",
        "[--card-clip-handle:2.25px] [--card-clip-radius:14px] [clip-path:var(--card-clip-path)] [corner-shape:squircle]",
        "sm:rounded-[40px] sm:[--card-clip-handle:3px] sm:[--card-clip-radius:20px]",
        className
      )}
      style={{ "--card-clip-path": CARD_CLIP_PATH, ...style } as SquircleStyle}
      {...props}
    >
      {children}
    </div>
  );
}

export interface SquircleCardProps {
  title: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
  seeAllHref?: string;
  onSeeAll?: () => void;
  className?: string;
  contentClassName?: string;
}

export function SquircleCard({
  title,
  icon,
  children,
  action,
  seeAllHref,
  onSeeAll,
  className,
  contentClassName,
}: SquircleCardProps) {
  const seeAll =
    "group/seeall flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-muted-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/50 hover:bg-accent hover:text-foreground";
  const arrow = (
    <span
      aria-hidden="true"
      className="transition-transform duration-200 group-hover/seeall:translate-x-0.5"
    >
      ›
    </span>
  );
  return (
    <SquircleSurface
      className={cn(
        "border border-border p-1 shadow-[0_1px_2px_rgba(0,0,0,0.06)] bg-card",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 pb-2 pl-3.5 pr-2 pt-1.5">
        <h3 className="ml-1 flex min-w-0 items-center gap-2 text-sm font-medium text-foreground/80 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground">
          {icon}
          {title}
        </h3>
        {action ? (
          action
        ) : onSeeAll ? (
          <button type="button" onClick={onSeeAll} className={cn(seeAll, "cursor-pointer")}>
            See all {arrow}
          </button>
        ) : seeAllHref ? (
          <a href={seeAllHref} className={seeAll}>
            See all {arrow}
          </a>
        ) : null}
      </div>
      <SquircleSurface
        className={cn(
          "overflow-hidden rounded-[20px] border border-border bg-[#f6f6f6] py-2 shadow-[0_1px_2px_rgba(0,0,0,0.06)] [--card-clip-radius:12px] sm:rounded-[34px] sm:[--card-clip-radius:17px]",
          contentClassName
        )}
      >
        {children}
      </SquircleSurface>
    </SquircleSurface>
  );
}

export function SquircleCardRow({
  label,
  value,
  className,
}: {
  label: React.ReactNode;
  value?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex h-8 items-center justify-between gap-3 px-3.5 text-sm transition-colors hover:bg-accent",
        className
      )}
    >
      <span className="min-w-0 truncate">{label}</span>
      {value !== undefined ? (
        <span className="shrink-0 tabular-nums text-muted-foreground text-xs">
          {value}
        </span>
      ) : null}
    </div>
  );
}
