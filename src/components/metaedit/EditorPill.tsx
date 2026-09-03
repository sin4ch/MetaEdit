"use client";

import * as React from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/cn";
import { BANNER } from "@/lib/springs";
import type { Collaborator, TargetMetadata } from "@/types/metaedit";
import {
  Clock01Icon,
  Logout03Icon,
  LockKeyIcon,
  UserGroupIcon,
} from "hugeicons-react";

interface EditorPillProps {
  selectedTarget: TargetMetadata | null;
  onClearTarget: () => void;
  onRequestChange: (instruction: string) => void;
  onToggleActivity: () => void;
  activityButtonRef: React.RefObject<HTMLButtonElement | null>;
  activityOpen: boolean;
  collaborators: Collaborator[];
  currentCollaboratorId?: string;
  hasSoftLock?: { author: string; color: string } | null;
  busy?: boolean;
  onExitMetaEdit: () => void;
}

export function EditorPill({
  selectedTarget,
  onClearTarget,
  onRequestChange,
  onToggleActivity,
  activityButtonRef,
  activityOpen,
  collaborators,
  currentCollaboratorId,
  hasSoftLock,
  busy = false,
  onExitMetaEdit,
}: EditorPillProps) {
  const [instruction, setInstruction] = React.useState("");
  const [onlineOpen, setOnlineOpen] = React.useState(false);
  const onlineCloseTimer = React.useRef<number | null>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const activeCollaborators = React.useMemo(() => collaborators.filter((collaborator) => collaborator.displayName.trim()), [collaborators]);
  const currentCollaborator = React.useMemo(() => activeCollaborators.find((collaborator) => collaborator.id === currentCollaboratorId), [activeCollaborators, currentCollaboratorId]);
  const currentUserColor = currentCollaborator?.color ?? "#305dde";

  const openOnlineList = () => {
    if (onlineCloseTimer.current !== null) window.clearTimeout(onlineCloseTimer.current);
    setOnlineOpen(true);
  };

  const scheduleCloseOnlineList = () => {
    if (onlineCloseTimer.current !== null) window.clearTimeout(onlineCloseTimer.current);
    onlineCloseTimer.current = window.setTimeout(() => setOnlineOpen(false), 120);
  };

  React.useEffect(() => () => {
    if (onlineCloseTimer.current !== null) window.clearTimeout(onlineCloseTimer.current);
  }, []);
  const coords = React.useMemo(() => {
    if (!selectedTarget?.boundingRect || typeof window === "undefined") return null;
    const { top, left, width, height } = selectedTarget.boundingRect;
    const viewportWidth = window.innerWidth;
    const popoverWidth = Math.min(360, viewportWidth - 32);
    let targetLeft = left + width / 2 - popoverWidth / 2;
    if (targetLeft < 16) targetLeft = 16;
    if (targetLeft + popoverWidth > viewportWidth - 16) {
      targetLeft = viewportWidth - popoverWidth - 16;
    }
    return { top: top + height + 12, left: targetLeft };
  }, [selectedTarget]);

  React.useEffect(() => {
    if (!selectedTarget) return;
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
          className="fixed bottom-6 inset-x-0 z-[70] flex flex-col items-center pointer-events-none px-3"
        >
          <div className="pointer-events-auto relative max-w-full">
            <div className="flex items-center gap-0.5 rounded-full border border-[#191919]/10 bg-[#ffffff]/95 p-1.5 shadow-[0_4px_24px_rgba(0,0,0,0.08)] backdrop-blur-xl max-w-full overflow-x-auto select-none">
            {/* Activity Button */}
            <button
              type="button"
              ref={activityButtonRef}
              onClick={onToggleActivity}
              aria-label="Activity"
              aria-expanded={activityOpen}
              title="Activity"
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full text-[#191919] cursor-pointer transition-colors",
                activityOpen ? "bg-[#f6f6f6]" : "bg-transparent hover:bg-[#f6f6f6]"
              )}
            >
              <Clock01Icon className="size-4 text-[#6e6e6e]" />
            </button>

              {/* Active collaborator list */}
              <div className="relative flex shrink-0 items-center px-0 text-xs text-[#8f8f8f] whitespace-nowrap" onMouseEnter={openOnlineList} onMouseLeave={scheduleCloseOnlineList}>
                <button
                  type="button"
                  onFocus={openOnlineList}
                  onBlur={scheduleCloseOnlineList}
                  aria-expanded={onlineOpen}
                  aria-haspopup="dialog"
                  aria-label="Collaborators"
                  title="Collaborators"
                  className="flex size-8 items-center justify-center rounded-full text-[#6e6e6e] transition-colors hover:bg-[#f6f6f6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#305dde]/40"
                >
                  <span className="relative flex size-4 items-center justify-center">
                    <UserGroupIcon className="size-4" />
                    <span className="absolute -right-2 -top-2 flex min-w-4 items-center justify-center rounded-full px-1 text-[9px] font-semibold leading-4 text-white" style={{ backgroundColor: currentUserColor }} aria-hidden="true">
                      {activeCollaborators.length > 99 ? "99+" : activeCollaborators.length}
                    </span>
                  </span>
                </button>
              </div>

              {/* Exit Mode Button */}
              <button
                type="button"
                onClick={onExitMetaEdit}
                aria-label="Exit MetaEdit"
                title="Exit MetaEdit mode"
                className="flex size-8 shrink-0 items-center justify-center rounded-full bg-transparent text-[#6e6e6e] hover:bg-rose-50 hover:text-rose-600 cursor-pointer transition-colors"
              >
                <Logout03Icon className="size-4" />
              </button>
            </div>

            {onlineOpen && (
              <div
                role="dialog"
                aria-label="Active collaborators"
                onMouseEnter={openOnlineList}
                onMouseLeave={scheduleCloseOnlineList}
                className="absolute bottom-[calc(100%+0.75rem)] left-1/2 z-[60] w-60 max-w-[calc(100vw-1.5rem)] -translate-x-1/2 overflow-hidden rounded-2xl border border-[#191919]/10 bg-white shadow-[0_12px_36px_rgba(0,0,0,0.14)]"
              >
                <ul className="space-y-1 p-2" aria-label="Active collaborators">
                  {activeCollaborators.map((collaborator) => (
                    <li key={collaborator.id} className="flex items-center gap-1.5 rounded-xl px-2 py-1.5 text-sm text-[#191919]">
                      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: collaborator.color }} aria-hidden="true" />
                      <span className="min-w-0 truncate">{collaborator.displayName}</span>
                      {collaborator.id === currentCollaboratorId && <span className="shrink-0 text-xs text-[#8f8f8f]">you</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
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
                  {selectedTarget.selectionType === "region" ? "Freeform area" : selectedTarget.component}
                </span>
                <span className="font-mono text-[11px] text-[#8f8f8f]">
                  {selectedTarget.selectionType === "region" ? `${selectedTarget.highlightedElements?.length ?? 0} elements` : `#${selectedTarget.instanceId}`}
                </span>
              </div>

              {selectedTarget.selectionType === "region" && (
                <p className="px-2 text-[11px] leading-4 text-[#6e6e6e]">
                  {selectedTarget.description ?? "A freeform area of the page, including any elements and whitespace inside it."}
                </p>
              )}

              {/* Textarea: "Add an optional comment..." */}
              <textarea
                ref={textareaRef}
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                onKeyDown={handleKeyDown}
                rows={3}
                placeholder="Describe the change you want your agent to make..."
                disabled={busy}
                className="w-full resize-none bg-[#f6f6f6] rounded-md p-3 text-sm text-[#191919] placeholder-[#8f8f8f] outline-none font-normal leading-relaxed border border-transparent focus:border-[#305dde]/30 focus:bg-white transition-colors"
              />

              {/* Bottom Action Row with Concentric Inset */}
              <div className="flex items-center justify-end">
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
                    {busy ? "Saving..." : "Add annotation"}
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
