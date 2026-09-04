"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { PANEL } from "@/lib/springs";
import { cn } from "@/lib/cn";
import type { Annotation, Revision, WorkspaceState } from "@/types/metaedit";
import { Check, Eye, ExternalLink, LocateFixed, LoaderCircle, MessageSquareText, Rocket, X } from "lucide-react";

interface ActivityPanelProps {
  open: boolean;
  onClose: () => void;
  anchorRef: React.RefObject<HTMLButtonElement | null>;
  state: WorkspaceState | null;
  comparison: { revisionId: string; mode: "before" | "after" } | null;
  onFocus: (annotation: Annotation) => void;
  onCompare: (revisionId: string | null, mode: "before" | "after" | null) => void;
  onReview: (revisionId: string, decision: "approved" | "rejected") => void;
  onPublish: (revisionId: string) => void;
  publishingRevisionId?: string | null;
}

type ActivityEntry = {
  id: string;
  createdAt: string;
  annotation?: Annotation;
  revision?: Revision;
};

type CompareMode = "before" | "after";

export function ActivityPanel({ open, onClose, anchorRef, state, comparison, onFocus, onCompare, onReview, onPublish, publishingRevisionId }: ActivityPanelProps) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const [popoverStyle, setPopoverStyle] = React.useState<React.CSSProperties>({ left: "50%", bottom: 24, transform: "translateX(-50%)" });
  const compareId = comparison?.revisionId ?? null;
  const compareMode = comparison?.mode ?? null;
  const annotations = React.useMemo(() => state?.annotations ?? [], [state?.annotations]);
  const revisions = React.useMemo(() => state?.revisions ?? [], [state?.revisions]);
  const collaboratorById = React.useMemo(() => new Map((state?.collaborators ?? []).map((item) => [item.id, item])), [state?.collaborators]);
  const annotationById = React.useMemo(() => new Map(annotations.map((item) => [item.id, item])), [annotations]);
  const entries = React.useMemo<ActivityEntry[]>(() => {
    const revisionEntries = revisions.map((revision) => ({
      id: revision.id,
      createdAt: revision.createdAt,
      annotation: revision.annotationId ? annotationById.get(revision.annotationId) : undefined,
      revision,
    }));
    const revisedAnnotationIds = new Set(revisions.flatMap((revision) => revision.annotationId ? [revision.annotationId] : []));
    const annotationEntries = annotations
      .filter((annotation) => !revisedAnnotationIds.has(annotation.id))
      .map((annotation) => ({ id: annotation.id, createdAt: annotation.createdAt, annotation }));

    return [...revisionEntries, ...annotationEntries].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [annotations, revisions, annotationById]);

  const toggleComparison = (revisionId: string) => {
    if (compareId !== revisionId) {
      onCompare(revisionId, "before");
      return;
    }

    if (compareMode === "before") {
      onCompare(revisionId, "after");
      return;
    }

    onCompare(null, null);
  };

  const handleClose = React.useCallback(() => {
    if (comparison) onCompare(null, null);
    onClose();
  }, [comparison, onCompare, onClose]);

  const handleFocus = React.useCallback((annotation: Annotation) => {
    if (comparison) onCompare(null, null);
    onFocus(annotation);
  }, [comparison, onCompare, onFocus]);

  const updatePopoverPosition = React.useCallback(() => {
    if (typeof window === "undefined") return;
    const anchor = anchorRef.current;
    if (!anchor) {
      setPopoverStyle({ left: "50%", bottom: 24, transform: "translateX(-50%)" });
      return;
    }

    const rect = anchor.getBoundingClientRect();
    const width = Math.min(448, Math.max(240, window.innerWidth - 24));
    const left = Math.min(Math.max(12, rect.left + rect.width / 2 - width / 2), window.innerWidth - width - 12);
    setPopoverStyle({ left, bottom: Math.max(12, window.innerHeight - rect.top + 12), transform: "none" });
  }, [anchorRef]);

  React.useLayoutEffect(() => {
    if (!open) return;
    updatePopoverPosition();
    window.addEventListener("resize", updatePopoverPosition);
    window.addEventListener("scroll", updatePopoverPosition, { passive: true });
    return () => {
      window.removeEventListener("resize", updatePopoverPosition);
      window.removeEventListener("scroll", updatePopoverPosition);
    };
  }, [open, updatePopoverPosition]);

  React.useEffect(() => {
    if (!open) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") handleClose();
    };
    const handleOutsidePointer = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (!panelRef.current?.contains(target) && !anchorRef.current?.contains(target)) handleClose();
    };
    document.addEventListener("keydown", handleEscape);
    document.addEventListener("pointerdown", handleOutsidePointer, true);
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.removeEventListener("pointerdown", handleOutsidePointer, true);
    };
  }, [open, anchorRef, handleClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div ref={panelRef} initial={{ y: 8, scale: 0.98, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }} exit={{ y: 8, scale: 0.98, opacity: 0 }} transition={PANEL} style={popoverStyle} className="pointer-events-auto fixed z-[70] flex w-[calc(100vw-1.5rem)] max-h-[min(60vh,32rem)] max-w-sm flex-col overflow-hidden rounded-2xl border border-[#191919]/10 bg-white shadow-[0_16px_48px_rgba(0,0,0,0.16)]" data-metaedit-chrome="true" role="dialog" aria-label="MetaEdit activity">
          <button type="button" onClick={handleClose} className="absolute right-2 top-2 z-10 flex size-7 shrink-0 items-center justify-center rounded-full text-[#6e6e6e] transition hover:bg-[#f3f3f3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#305dde]/40" aria-label="Close activity"><X className="size-4" /></button>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-3 pt-10">
            {entries.length === 0 && <div className="grid min-h-48 place-items-center text-center"><div><MessageSquareText className="mx-auto size-6 text-[#b5b5b5]" /><p className="mt-2 text-sm font-medium">No activity yet</p><p className="mx-auto mt-1 max-w-56 text-xs leading-relaxed text-[#6e6e6e]">Select an element to leave the first annotation.</p></div></div>}
            {entries.map((entry, index) => {
              const previousEntry = entries[index - 1];
              const startsDay = !previousEntry || dayKey(previousEntry.createdAt) !== dayKey(entry.createdAt);
              return <React.Fragment key={entry.id}>
                {startsDay && <div className="px-1 pt-2 text-center text-[10px] font-medium text-[#8f8f8f]" role="separator">{formatDayLabel(entry.createdAt)}</div>}
                <ChangeCard
                  annotation={entry.annotation}
                  revision={entry.revision}
                  compareMode={entry.revision && compareId === entry.revision.id ? compareMode : null}
                  onCompare={entry.revision ? () => { if (entry.annotation) handleFocus(entry.annotation); toggleComparison(entry.revision!.id); } : undefined}
                  onFocus={handleFocus}
                  onReview={onReview}
                  onPublish={onPublish}
                  currentCollaboratorId={state?.currentCollaborator?.id}
                  authorColor={entry.revision?.authorColor ?? entry.annotation?.authorColor ?? collaboratorById.get(entry.revision?.authorId ?? entry.annotation?.authorId ?? "")?.color}
                  publishing={Boolean(entry.revision && (entry.revision.publishStatus === "creating" || publishingRevisionId === entry.revision.id))}
                />
              </React.Fragment>;
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ChangeCard({ annotation, revision, compareMode, onCompare, onFocus, onReview, onPublish, currentCollaboratorId, authorColor, publishing }: { annotation?: Annotation; revision?: Revision; compareMode: CompareMode | null; onCompare?: () => void; onFocus: (annotation: Annotation) => void; onReview: (id: string, decision: "approved" | "rejected") => void; onPublish: (id: string) => void; currentCollaboratorId?: string; authorColor?: string; publishing: boolean }) {
  const currentDecision = revision?.approvals.find((item) => item.collaboratorId === currentCollaboratorId)?.decision;
  const operations = compareMode === "before" ? revision?.before : revision?.patch;
  const authorName = revision?.authorName ?? annotation?.authorName ?? "Collaborator";
  const reaction = getReaction(annotation, revision);
  const targetLabel = annotation ? annotation.selectionType === "region" ? `Freeform area · ${annotation.highlightedElements?.length ?? 0} elements` : `${annotation.component} · #${annotation.targetId}` : null;
  const createdAt = revision?.createdAt ?? annotation?.createdAt;

  return <article className="space-y-2 pb-1">
    <div className="flex min-w-0 items-center gap-2">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white" style={{ backgroundColor: authorColor ?? "#305dde" }}>{authorName.slice(0, 1).toUpperCase()}</span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
        <p className="truncate text-sm font-semibold text-[#191919]">{authorName}</p>
        {annotation && targetLabel && <button type="button" onClick={() => onFocus(annotation)} className="flex min-w-0 max-w-full items-center gap-1 text-left text-[10px] text-[#6e6e6e] transition hover:text-[#191919] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#305dde]/40" aria-label={annotation.selectionType === "region" ? "Focus freeform area" : `Focus ${annotation.component} ${annotation.targetId}`}>
          <LocateFixed className="size-3 shrink-0" />
          <span className="truncate font-mono">{targetLabel}</span>
        </button>}
      </div>
    </div>

    {(annotation || revision) && <div className="flex flex-wrap items-end gap-2">
      {annotation ? (
        <div className="min-w-0 max-w-[min(100%,20rem)] rounded-2xl rounded-tl-sm bg-[#f3f3f3] px-2.5 py-2">
          <p className="text-sm leading-5 text-[#191919]">{annotation.comment}</p>
          <div className="mt-1.5 flex min-h-4 items-center justify-end gap-2">
            {reaction && <span className="inline-flex shrink-0 items-center rounded-full border border-[#191919]/10 bg-white px-1.5 py-0.5 text-xs leading-none shadow-sm" title={reaction.label} aria-label={reaction.label}>{reaction.emoji}</span>}
            {createdAt && <time className="text-right text-[10px] font-sans text-[#8f8f8f]">{formatTime(createdAt)}</time>}
          </div>
        </div>
      ) : (
        <div className="ml-auto max-w-[min(100%,20rem)] rounded-2xl rounded-tr-sm bg-[#305dde]/10 px-2.5 py-2">
          <p className="text-sm leading-5 text-[#191919]">{revision?.instruction}</p>
          <div className="mt-1.5 flex min-h-4 items-center justify-end gap-2">
            {reaction && <span className="inline-flex shrink-0 items-center rounded-full border border-[#191919]/10 bg-white px-1.5 py-0.5 text-xs leading-none shadow-sm" title={reaction.label} aria-label={reaction.label}>{reaction.emoji}</span>}
            {createdAt && <time className="text-right text-[10px] font-sans text-[#8f8f8f]">{formatTime(createdAt)}</time>}
          </div>
        </div>
      )}
      {revision && <RevisionActions revision={revision} compareMode={compareMode} onCompare={onCompare} currentDecision={currentDecision} onReview={onReview} onPublish={onPublish} publishing={publishing} />}
    </div>}

    {compareMode && operations && <div className="ml-4 rounded-2xl bg-[#f6f6f6] px-3 py-2"><p className="text-[10px] font-medium text-[#505050]">Showing {compareMode}</p><PatchSummary operations={operations} /></div>}
  </article>;
}

function RevisionActions({ revision, compareMode, onCompare, currentDecision, onReview, onPublish, publishing }: { revision: Revision; compareMode: CompareMode | null; onCompare?: () => void; currentDecision?: "approved" | "rejected"; onReview: (id: string, decision: "approved" | "rejected") => void; onPublish: (id: string) => void; publishing: boolean }) {
  const nextComparison = compareMode === "before" ? "after" : compareMode === "after" ? "preview" : "before";
  const hasApproval = revision.approvals.some((approval) => approval.decision === "approved");
  const canPublish = hasApproval && revision.status !== "published" && revision.status !== "rejected" && !publishing;
  return <div className="flex shrink-0 items-center gap-1">
    {onCompare && <button type="button" onClick={onCompare} className={cn("flex size-7 cursor-pointer items-center justify-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#305dde]/40", compareMode ? "bg-[#305dde] text-white" : "bg-[#f3f3f3] text-[#191919]")} aria-label={`Show ${nextComparison} for this revision`} title={`Show ${nextComparison}`}><Eye className="size-3" /></button>}
    {revision.status !== "published" && <>
      <button type="button" onClick={() => onReview(revision.id, "approved")} className={cn("flex size-7 cursor-pointer items-center justify-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#305dde]/40", currentDecision === "approved" ? "bg-emerald-100 text-emerald-800" : "bg-[#f3f3f3] text-[#191919]")} aria-label="Approve revision" title="Approve revision"><Check className="size-3" /></button>
      <button type="button" onClick={() => onReview(revision.id, "rejected")} className={cn("flex size-7 cursor-pointer items-center justify-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#305dde]/40", currentDecision === "rejected" ? "bg-rose-100 text-rose-700" : "bg-[#f3f3f3] text-[#505050]")} aria-label="Reject revision" title="Reject revision"><X className="size-3" /></button>
    </>}
    {hasApproval && revision.status !== "published" && revision.status !== "rejected" && <button type="button" onClick={() => canPublish && onPublish(revision.id)} disabled={!canPublish} className={cn("flex size-7 cursor-pointer items-center justify-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#305dde]/40", canPublish ? "bg-[#191919] text-white hover:bg-[#303030]" : "bg-[#f3f3f3] text-[#8f8f8f] cursor-not-allowed")} aria-label={publishing ? "Creating pull request" : canPublish ? "Publish revision" : "Waiting for approval"} title={publishing ? "Creating pull request" : canPublish ? "Publish revision" : "Waiting for approval"}>{publishing ? <LoaderCircle className="size-3 animate-spin" /> : <Rocket className="size-3" />}</button>}
    {revision.publishStatus === "ready" && revision.githubPrUrl && <a href={revision.githubPrUrl} target="_blank" rel="noreferrer" className="flex size-7 cursor-pointer items-center justify-center rounded-full bg-emerald-100 text-emerald-800 transition hover:bg-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#305dde]/40" aria-label={`Open pull request #${revision.githubPrNumber ?? ""}`} title={`Open pull request #${revision.githubPrNumber ?? ""}`}><ExternalLink className="size-3" /></a>}
  </div>;
}

function PatchSummary({ operations }: { operations: Revision["patch"] }) { return <p className="mt-1.5 text-[11px] leading-4 text-[#6e6e6e]">{operations.length === 0 ? "No UI updates" : operations.slice(0, 2).map(describeOperation).join(" · ")}{operations.length > 2 ? ` · +${operations.length - 2} more` : ""}</p>; }
function describeOperation(operation: Revision["patch"][number]) { return operation.op === "replace_text" ? "Text" : operation.op === "set_style" ? "Style" : "Visibility"; }
function getReaction(annotation?: Annotation, revision?: Revision) {
  if (revision?.status === "rejected") return null;
  if (revision?.status === "published" || revision?.status === "approved" || annotation?.agentState === "done" || annotation?.status === "resolved") return { emoji: "✅", label: "Changes complete" };
  if (revision?.status === "proposed" || annotation?.agentState === "in_progress") return { emoji: "⏳", label: "Changes in progress" };
  if (annotation?.agentState === "seen") return { emoji: "👀", label: "Seen by agent" };
  return null;
}
function formatTime(value: string) { return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
function dayKey(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}
function formatDayLabel(value: string) {
  const date = new Date(value);
  const now = new Date();
  const today = dayKey(now.toISOString());
  const yesterdayDate = new Date(now);
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = dayKey(yesterdayDate.toISOString());
  const key = dayKey(value);
  if (key === today) return "Today";
  if (key === yesterday) return "Yesterday";
  return date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric", year: date.getFullYear() === now.getFullYear() ? undefined : "numeric" });
}
