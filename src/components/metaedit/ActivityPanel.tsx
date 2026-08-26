"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { PANEL } from "@/lib/springs";
import { cn } from "@/lib/cn";
import type { Annotation, Revision, WorkspaceState } from "@/types/metaedit";
import { Check, Clock3, Eye, LocateFixed, MessageSquareText, Rocket, X } from "lucide-react";

interface ActivityPanelProps {
  open: boolean;
  onClose: () => void;
  state: WorkspaceState | null;
  preview: boolean;
  onTogglePreview: () => void;
  onFocus: (selector: string) => void;
  onReview: (revisionId: string, decision: "approved" | "rejected") => void;
  onPublish: (revisionId: string) => void;
}

export function ActivityPanel({ open, onClose, state, preview, onTogglePreview, onFocus, onReview, onPublish }: ActivityPanelProps) {
  const [filter, setFilter] = React.useState<"all" | "annotations" | "revisions">("all");
  const [compareId, setCompareId] = React.useState<string | null>(null);
  const annotations = React.useMemo(() => state?.annotations ?? [], [state?.annotations]);
  const revisions = React.useMemo(() => state?.revisions ?? [], [state?.revisions]);
  const annotationById = React.useMemo(() => new Map(annotations.map((item) => [item.id, item])), [annotations]);
  const entries = React.useMemo(() => [
    ...(filter !== "revisions" ? annotations.map((item) => ({ kind: "annotation" as const, createdAt: item.createdAt, item })) : []),
    ...(filter !== "annotations" ? revisions.map((item) => ({ kind: "revision" as const, createdAt: item.createdAt, item })) : []),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [annotations, revisions, filter]);

  return (
    <AnimatePresence>
      {open && (
        <motion.aside initial={{ x: "100%", opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: "100%", opacity: 0 }} transition={PANEL} className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-[#191919]/10 bg-white shadow-2xl" data-metaedit-chrome="true" aria-label="MetaEdit activity">
          <header className="border-b border-[#191919]/10 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-full bg-[#305dde]/10 text-[#305dde]"><Clock3 className="size-4" /></span>
                <div><h2 className="text-sm font-semibold text-[#191919]">Workspace activity</h2><p className="mt-0.5 text-[11px] text-[#6e6e6e]">Annotations, preview revisions, approvals, and publishing</p></div>
              </div>
              <button onClick={onClose} className="flex size-8 items-center justify-center rounded-full text-[#6e6e6e] hover:bg-[#f3f3f3]" aria-label="Close activity"><X className="size-4" /></button>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="flex rounded-full bg-[#f3f3f3] p-1">
                {(["all", "annotations", "revisions"] as const).map((value) => <button key={value} onClick={() => setFilter(value)} className={cn("rounded-full px-3 py-1 text-[11px] font-medium capitalize", filter === value ? "bg-[#191919] text-white" : "text-[#6e6e6e]")}>{value}</button>)}
              </div>
              <button onClick={onTogglePreview} className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-medium", preview ? "bg-[#305dde] text-white" : "bg-[#f3f3f3] text-[#505050]")}><Eye className="size-3.5" />{preview ? "Preview on" : "Published"}</button>
            </div>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {entries.length === 0 && <div className="grid min-h-72 place-items-center text-center"><div><MessageSquareText className="mx-auto size-8 text-[#b5b5b5]" /><p className="mt-3 text-sm font-medium">No activity yet</p><p className="mx-auto mt-1 max-w-64 text-xs leading-relaxed text-[#6e6e6e]">Inspect an element and leave a comment. Your browser agent can then propose a revision.</p></div></div>}
            {entries.map((entry) => entry.kind === "annotation" ? (
              <AnnotationCard key={entry.item.id} annotation={entry.item} onFocus={onFocus} />
            ) : (
              <RevisionCard key={entry.item.id} revision={entry.item} annotation={entry.item.annotationId ? annotationById.get(entry.item.annotationId) : undefined} comparing={compareId === entry.item.id} onCompare={() => setCompareId(compareId === entry.item.id ? null : entry.item.id)} onFocus={onFocus} onReview={onReview} onPublish={onPublish} isOwner={state?.currentCollaborator?.role === "owner"} currentCollaboratorId={state?.currentCollaborator?.id} />
            ))}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

function AnnotationCard({ annotation, onFocus }: { annotation: Annotation; onFocus: (selector: string) => void }) {
  return <button onClick={() => onFocus(annotation.selector)} className="w-full rounded-lg border border-[#191919]/10 bg-[#f7f7f7] p-4 text-left shadow-sm transition hover:border-[#305dde]/30">
    <div className="flex items-center justify-between gap-2"><span className="flex items-center gap-2 text-xs font-semibold"><span className="size-2 rounded-full bg-[#305dde]" />{annotation.authorName}</span><span className="rounded-full bg-white px-2 py-1 text-[10px] text-[#6e6e6e]">{annotation.status}</span></div>
    <p className="mt-3 text-sm leading-relaxed text-[#191919]">“{annotation.comment}”</p>
    <div className="mt-3 flex items-center justify-between border-t border-[#191919]/8 pt-2 text-[10px] text-[#6e6e6e]"><span className="flex min-w-0 items-center gap-1.5 font-mono"><LocateFixed className="size-3 shrink-0" /><span className="truncate">{annotation.component} · #{annotation.targetId}</span></span><time>{formatTime(annotation.createdAt)}</time></div>
  </button>;
}

function RevisionCard({ revision, annotation, comparing, onCompare, onFocus, onReview, onPublish, isOwner, currentCollaboratorId }: { revision: Revision; annotation?: Annotation; comparing: boolean; onCompare: () => void; onFocus: (selector: string) => void; onReview: (id: string, decision: "approved" | "rejected") => void; onPublish: (id: string) => void; isOwner: boolean; currentCollaboratorId?: string }) {
  const currentDecision = revision.approvals.find((item) => item.collaboratorId === currentCollaboratorId)?.decision;
  return <article className="rounded-lg border border-[#191919]/10 bg-white p-4 shadow-sm">
    <button onClick={() => annotation && onFocus(annotation.selector)} className="w-full text-left">
      <div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold">{revision.authorName} <span className="font-mono font-normal text-[#8f8f8f]">v{revision.version}</span></span><Status status={revision.status} /></div>
      <p className="mt-3 text-sm leading-relaxed">{revision.instruction}</p>
      <p className="mt-2 truncate text-[10px] font-mono text-[#6e6e6e]">{annotation ? `${annotation.component} · #${annotation.targetId}` : "Workspace revision"}</p>
    </button>
    <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-[#191919]/8 pt-3">
      <button onClick={onCompare} className="flex h-8 items-center gap-1.5 rounded-full bg-[#f3f3f3] px-3 text-[11px] font-medium"><Eye className="size-3.5" />{comparing ? "Hide" : "Before / after"}</button>
      {revision.status !== "published" && <><button onClick={() => onReview(revision.id, "approved")} className={cn("flex h-8 items-center gap-1 rounded-full px-3 text-[11px] font-medium", currentDecision === "approved" ? "bg-emerald-100 text-emerald-800" : "bg-[#f3f3f3]")}><Check className="size-3.5" />Approve</button><button onClick={() => onReview(revision.id, "rejected")} className={cn("flex size-8 items-center justify-center rounded-full", currentDecision === "rejected" ? "bg-rose-100 text-rose-700" : "bg-[#f3f3f3]")} aria-label="Reject revision"><X className="size-3.5" /></button></>}
      {isOwner && revision.status === "approved" && <button onClick={() => onPublish(revision.id)} className="ml-auto flex h-8 items-center gap-1.5 rounded-full bg-[#191919] px-3 text-[11px] font-medium text-white"><Rocket className="size-3.5" />Publish</button>}
    </div>
    {comparing && <div className="mt-3 grid gap-2 rounded-md bg-[#f7f7f7] p-2 text-[10px] sm:grid-cols-2"><PatchList title="Before" operations={revision.before} /><PatchList title="After" operations={revision.patch} /></div>}
    {revision.approvals.length > 0 && <p className="mt-2 text-[10px] text-[#6e6e6e]">Reviewed by {revision.approvals.map((item) => `${item.collaboratorName} (${item.decision})`).join(", ")}</p>}
  </article>;
}

function PatchList({ title, operations }: { title: string; operations: Revision["patch"] }) { return <div className="min-w-0 rounded bg-white p-2"><p className="mb-1 font-semibold text-[#505050]">{title}</p>{operations.map((operation, index) => <pre key={`${operation.selector}-${index}`} className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-[#6e6e6e]">{operation.op === "replace_text" ? operation.value || "(empty)" : operation.op === "set_style" ? `${operation.property}: ${operation.value || "(default)"}` : operation.visible ? "visible" : "hidden"}</pre>)}</div>; }
function Status({ status }: { status: Revision["status"] }) { const colors = status === "published" ? "bg-emerald-100 text-emerald-800" : status === "approved" ? "bg-blue-100 text-blue-800" : status === "rejected" ? "bg-rose-100 text-rose-700" : "bg-amber-100 text-amber-800"; return <span className={cn("rounded-full px-2 py-1 text-[10px] font-medium", colors)}>{status}</span>; }
function formatTime(value: string) { return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
