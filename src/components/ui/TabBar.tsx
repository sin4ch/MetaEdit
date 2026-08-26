"use client";

import { motion } from "motion/react";
import * as React from "react";
import { cn } from "@/lib/cn";
import { LAYOUT } from "@/lib/springs";

export interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

export function TabBar({
  tabs,
  activeId,
  onChange,
  className,
}: {
  tabs: readonly Tab[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <nav
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-border bg-card p-1 shadow-sm",
        className
      )}
    >
      {tabs.map((tab) => {
        const selected = tab.id === activeId;
        return (
          <button
            key={tab.id}
            type="button"
            aria-current={selected ? "page" : undefined}
            onClick={() => onChange(tab.id)}
            className={cn(
              "relative flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-full px-3.5 text-xs font-medium outline-none",
              "transition-colors focus-visible:ring-[2px] focus-visible:ring-ring/50",
              selected
                ? "text-foreground font-medium"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {selected && (
              <motion.span
                layoutId="oa-nav-pill"
                transition={LAYOUT}
                className="absolute inset-0 rounded-full bg-secondary shadow-inner"
                aria-hidden="true"
              />
            )}
            {tab.icon && (
              <span className="relative z-10 size-3.5 flex items-center justify-center">
                {tab.icon}
              </span>
            )}
            <span className="relative z-10 whitespace-nowrap text-xs">
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
