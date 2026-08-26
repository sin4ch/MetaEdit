"use client";

import { AnimatePresence, motion } from "motion/react";
import * as React from "react";
import { cn } from "@/lib/cn";
import { CheckmarkCircle02Icon, AlertCircleIcon, InformationCircleIcon, Cancel01Icon } from "hugeicons-react";

export interface ToastItem {
  id: string;
  title: string;
  description?: string;
  tone?: "good" | "bad" | "info";
}

export function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2.5 pointer-events-none max-w-sm w-full" data-metaedit-chrome="true">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97, transition: { duration: 0.15 } }}
            className="pointer-events-auto relative flex items-start gap-3 rounded-lg border border-[#191919]/10 bg-[#ffffff] p-4 shadow-[0_8px_30px_rgba(0,0,0,0.08)]"
          >
            <span className="shrink-0 mt-0.5">
              {t.tone === "good" ? (
                <CheckmarkCircle02Icon className="size-4 text-[#305dde]" />
              ) : t.tone === "bad" ? (
                <AlertCircleIcon className="size-4 text-rose-600" />
              ) : (
                <InformationCircleIcon className="size-4 text-[#6e6e6e]" />
              )}
            </span>
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-medium text-[#191919]">{t.title}</h4>
              {t.description && (
                <p className="mt-1 text-sm font-medium text-[#6e6e6e] leading-relaxed line-clamp-2">
                  {t.description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(t.id)}
              className="shrink-0 text-[#8f8f8f] hover:text-[#191919] hover:bg-[#f6f6f6] cursor-pointer rounded-full p-1 transition-colors"
              aria-label="Dismiss toast"
            >
              <Cancel01Icon className="size-3.5" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
