"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/cn";
import { BANNER } from "@/lib/springs";
import { TargetMetadata } from "@/types/metaedit";
import {
  CursorPointer02Icon,
  Clock01Icon,
  Delete02Icon,
  Logout03Icon,
  LockKeyIcon,
} from "hugeicons-react";

interface EditorPillProps {
  isInspecting: boolean;
  onToggleInspect: () => void;
  selectedTarget: TargetMetadata | null;
  onClearTarget: () => void;
  onRequestChange: (instruction: string) => void;
  onToggleActivity: () => void;
  collaboratorCount: number;
  activityCount: number;
  hasSoftLock?: { author: string; color: string } | null;
  busy?: boolean;
  onExitMetaEdit: () => void;
}

export function EditorPill({
  isInspecting,
  onToggleInspect,
  selectedTarget,
  onClearTarget,
  onRequestChange,
  onToggleActivity,
  collaboratorCount,
  activityCount,
  hasSoftLock,
  busy = false,
  onExitMetaEdit,
}: EditorPillProps) {
  const [instruction, setInstruction] = React.useState("");
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const [coords, setCoords] = React.useState<{ top: number; left: number } | null>(null);

  // Compute position floating near the annotated element
  React.useEffect(() => {
    if (!selectedTarget?.boundingRect) {
      setCoords(null);
      return;
    }

    const { top, left, width, height } = selectedTarget.boundingRect;
    const viewportWidth = window.innerWidth;

    // Calculate ideal popover position
    const popoverWidth = Math.min(360, viewportWidth - 32);
    let targetLeft = left + width / 2 - popoverWidth / 2;
    if (targetLeft < 16) targetLeft = 16;
    if (targetLeft + popoverWidth > viewportWidth - 16) {
      targetLeft = viewportWidth - popoverWidth - 16;
    }

    let targetTop = top + height + 12; // 12px below the element
    setCoords({ top: targetTop, left: targetLeft });

    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [selectedTarget]);

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!instruction.trim() || !selectedTarget || busy) return;
    onRequestChange(instruction.trim());
    setInstruction("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="pointer-events-none" data-metaedit-chrome="true">
      {/* 1. COMPACT RESPONSIVE STATUS BAR AT THE BOTTOM WHEN NO TARGET IS SELECTED */}
      {!selectedTarget ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={BANNER}
          className="fixed bottom-6 inset-x-0 z-50 flex flex-col items-center pointer-events-none px-3"
        >
          <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-[#191919]/10 bg-[#ffffff]/95 backdrop-blur-xl p-1.5 shadow-[0_4px_24px_rgba(0,0,0,0.08)] max-w-full overflow-x-auto select-none">
            {/* Inspect / Target Button */}
            <button
              onClick={onToggleInspect}
              className={cn(
                "flex h-8 shrink-0 items-center gap-1.5 rounded-full px-3 sm:px-3.5 text-xs font-medium cursor-pointer transition-all outline-none whitespace-nowrap",
                isInspecting
                  ? "bg-primary text-white shadow-sm ring-2 ring-primary/30"
                  : "bg-[#f6f6f6] text-[#191919] hover:bg-[#eaeaea]"
              )}
            >
              <CursorPointer02Icon className="size-3.5 shrink-0" />
              <span className="hidden sm:inline">
                {isInspecting ? "Inspecting (active)" : "Click element to edit"}
              </span>
              <span className="sm:hidden">
                {isInspecting ? "Inspecting" : "Inspect"}
              </span>
            </button>

            {/* Activity Button */}
            <button
              onClick={onToggleActivity}
              className="flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-[#f6f6f6] px-2.5 sm:px-3 text-xs font-medium text-[#191919] hover:bg-[#eaeaea] cursor-pointer transition-colors whitespace-nowrap"
            >
              <Clock01Icon className="size-3.5 text-[#8f8f8f] shrink-0" />
              <span className="hidden sm:inline">Activity</span>
              {activityCount > 0 && (
                <span className="flex size-4 items-center justify-center rounded-full bg-primary text-[10px] text-white shrink-0">
                  {activityCount}
                </span>
              )}
            </button>

            {/* Collaborator Count Badge */}
            <div className="hidden sm:flex items-center gap-1.5 px-2 text-xs text-[#8f8f8f] shrink-0 whitespace-nowrap">
              <div className="mx-0.5 h-4 w-px bg-[#191919]/10" />
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="tabular-nums font-medium text-[#191919]">{collaboratorCount}</span>
              <span>online</span>
              <div className="mx-0.5 h-4 w-px bg-[#191919]/10" />
            </div>

            {/* Exit Mode Button */}
            <button
              onClick={onExitMetaEdit}
              className="flex h-8 shrink-0 items-center gap-1 rounded-full px-2.5 sm:px-3 text-xs font-medium text-[#8f8f8f] hover:bg-rose-50 hover:text-rose-600 cursor-pointer transition-colors whitespace-nowrap"
              title="Exit MetaEdit mode"
            >
              <Logout03Icon className="size-3.5 shrink-0" />
              <span className="hidden sm:inline">Exit</span>
            </button>
          </div>
        </motion.div>
      ) : (
        /* 2. LIGHT-MODE FLOATING CONTEXTUAL ANNOTATION BOX POSITIONED AT THE ELEMENT */
        <div
          style={{
            position: coords ? "absolute" : "fixed",
            top: coords ? coords.top : "auto",
            left: coords ? coords.left : "50%",
            bottom: coords ? "auto" : "32px",
            transform: coords ? "none" : "translateX(-50%)",
            zIndex: 99999,
          }}
          className="pointer-events-auto px-2 w-full max-w-[380px]"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 6 }}
            transition={BANNER}
            className="flex flex-col gap-2 w-full"
          >
            {/* Soft lock notice if another user is currently targeting */}
            {hasSoftLock && (
              <div className="flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-50 px-3.5 py-1 text-xs text-amber-900 shadow-sm whitespace-nowrap">
                <LockKeyIcon className="size-3 text-amber-600 shrink-0" />
                <span>
                  <strong style={{ color: hasSoftLock.color }}>{hasSoftLock.author}</strong> is editing this component.
                </span>
              </div>
            )}

            {/* Concentric, Symmetrically Padded Light Mode Popover Container */}
            <div className="w-full rounded-lg bg-[#ffffff] border border-[#191919]/10 p-2 shadow-[0_12px_36px_rgba(0,0,0,0.12)] flex flex-col gap-2">
              {/* Header Title Row: Component Name + Instance ID */}
              <div className="flex items-center justify-between text-xs px-2 pt-1">
                <span className="font-medium text-[#191919] truncate max-w-[200px]">
                  {selectedTarget.component}
                </span>
                <span className="font-mono text-[11px] text-[#8f8f8f]">
                  #{selectedTarget.instanceId}
                </span>
              </div>

              {/* Textarea: "Add an optional comment..." */}
              <textarea
                ref={textareaRef}
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={3}
                placeholder="Add an optional comment..."
                disabled={busy}
                className="w-full resize-none bg-[#f6f6f6] rounded-md p-3 text-sm text-[#191919] placeholder-[#8f8f8f] outline-none font-normal leading-relaxed border border-transparent focus:border-[#305dde]/30 focus:bg-white transition-colors"
              />

              {/* Bottom Action Row with Concentric Inset */}
              <div className="flex items-center justify-between">
                {/* Trash Button */}
                <button
                  type="button"
                  onClick={onClearTarget}
                  className="flex size-8 items-center justify-center rounded-full text-[#8f8f8f] hover:text-[#191919] hover:bg-[#f6f6f6] transition-colors cursor-pointer"
                  title="Discard comment"
                >
                  <Delete02Icon className="size-3.5" />
                </button>

                {/* Right Action Buttons */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={onClearTarget}
                    className="flex h-8 items-center justify-center rounded-full px-3.5 text-xs font-medium text-[#6e6e6e] bg-[#f6f6f6] hover:bg-[#eaeaea] hover:text-[#191919] transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSubmit()}
                    disabled={!instruction.trim() || busy}
                    className={cn(
                      "flex h-8 items-center justify-center rounded-full px-4 text-xs font-medium transition-colors cursor-pointer",
                      instruction.trim() && !busy
                        ? "bg-[#191919] text-white hover:bg-[#333333] shadow-sm"
                        : "bg-[#f6f6f6] text-[#8f8f8f] cursor-not-allowed"
                    )}
                  >
                    {busy ? "Saving..." : "Save"}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
