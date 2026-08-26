"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import { PANEL } from "@/lib/springs";
import { ChangeRequest, Checkpoint, RequestStatus } from "@/types/metaedit";
import {
  Cancel01Icon,
  Clock01Icon,
  ArrowTurnBackwardIcon,
  SparklesIcon,
  GitCommitIcon,
  CheckmarkCircle02Icon,
  AlertCircleIcon,
  Loading03Icon,
  SourceCodeIcon,
  FilterIcon,
  ArrowDown01Icon,
  ArrowRight01Icon,
} from "hugeicons-react";

interface ActivityPanelProps {
  open: boolean;
  onClose: () => void;
  requests: ChangeRequest[];
  checkpoints: Checkpoint[];
  onRevertCheckpoint: (checkpointId: string) => void;
  onPreviewCheckpoint: (checkpoint: Checkpoint) => void;
}

export function ActivityPanel({
  open,
  onClose,
  requests,
  checkpoints,
  onRevertCheckpoint,
}: ActivityPanelProps) {
  const [filter, setFilter] = React.useState<"all" | "active" | "applied">("all");
  const [expandedDiffId, setExpandedDiffId] = React.useState<string | null>(null);

  const getStatusBadge = (status: RequestStatus) => {
    switch (status) {
      case "queued":
        return (
          <span className="flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground font-medium">
            <Clock01Icon className="size-3" /> Queued
          </span>
        );
      case "inspecting_target":
        return (
          <span className="flex items-center gap-1 rounded-full bg-info/10 px-2 py-0.5 text-[10px] text-info-foreground font-medium animate-pulse">
            <Loading03Icon className="size-3 animate-spin" /> WebMCP Inspecting
          </span>
        );
      case "editing_source":
        return (
          <span className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary font-medium animate-pulse">
            <SparklesIcon className="size-3 animate-spin" /> Codex Editing
          </span>
        );
      case "running_checks":
        return (
          <span className="flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-[10px] text-warning-foreground font-medium">
            <Loading03Icon className="size-3 animate-spin" /> Running Checks
          </span>
        );
      case "applied":
        return (
          <span className="flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] text-success-foreground font-medium">
            <CheckmarkCircle02Icon className="size-3" /> Applied
          </span>
        );
      case "reverted":
        return (
          <span className="flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground font-medium">
            <ArrowTurnBackwardIcon className="size-3" /> Reverted
          </span>
        );
      case "failed":
        return (
          <span className="flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] text-destructive font-medium">
            <AlertCircleIcon className="size-3" /> Failed
          </span>
        );
      default:
        return null;
    }
  };

  const filteredItems = React.useMemo(() => {
    const combined = [
      ...requests.map((r) => ({ type: "request" as const, item: r, timestamp: r.createdAt })),
      ...checkpoints.map((c) => ({ type: "checkpoint" as const, item: c, timestamp: c.createdAt })),
    ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (filter === "active") {
      return combined.filter(
        (x) => x.type === "request" && ["queued", "inspecting_target", "editing_source", "running_checks"].includes((x.item as ChangeRequest).status)
      );
    }
    if (filter === "applied") {
      return combined.filter(
        (x) => (x.type === "request" && (x.item as ChangeRequest).status === "applied") || x.type === "checkpoint"
      );
    }
    return combined;
  }, [requests, checkpoints, filter]);

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={{ x: "100%", opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "100%", opacity: 0 }}
          transition={PANEL}
          className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-border bg-card shadow-2xl"
          data-metaedit-chrome="true"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border p-4">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Clock01Icon className="size-4" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-foreground">Session Activity</h3>
                <p className="text-[11px] text-muted-foreground">
                  Real-time prompt queue & git checkpoints
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground cursor-pointer transition-colors"
            >
              <Cancel01Icon className="size-4" />
            </button>
          </div>

          {/* Filter Bar */}
          <div className="flex items-center justify-between border-b border-border bg-[#fbfbfb] px-4 py-2 text-xs">
            <div className="flex items-center gap-1">
              <FilterIcon className="size-3 text-muted-foreground mr-1" />
              {(["all", "active", "applied"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-xs font-medium capitalize cursor-pointer transition-colors",
                    filter === f
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {f}
                </button>
              ))}
            </div>
            <span className="text-[11px] text-muted-foreground tabular-nums">
              {filteredItems.length} items
            </span>
          </div>

          {/* Feed List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Clock01Icon className="size-8 text-muted-foreground/40 mb-2" />
                <p className="text-xs font-medium text-foreground">No activity yet</p>
                <p className="text-[11px] text-muted-foreground mt-1 max-w-xs">
                  Select a component in the view and submit a change instruction to start.
                </p>
              </div>
            ) : (
              filteredItems.map((entry) => {
                if (entry.type === "request") {
                  const req = entry.item as ChangeRequest;
                  return (
                    <div
                      key={req.id}
                      className={cn(
                        "group relative flex flex-col gap-2 rounded-lg border border-border bg-[#f8f8f8] p-3.5 shadow-sm transition-all",
                        req.status === "editing_source" && "border-primary/40 ring-1 ring-primary/20 bg-primary/[0.02]"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="size-2 rounded-full"
                            style={{ backgroundColor: req.authorColor }}
                          />
                          <span className="text-xs font-medium text-foreground">
                            {req.authorName}
                          </span>
                        </div>
                        {getStatusBadge(req.status)}
                      </div>

                      <p className="text-xs text-foreground font-normal leading-relaxed">
                        "{req.instruction}"
                      </p>

                      <div className="flex items-center justify-between text-[10px] text-muted-foreground border-t border-border/60 pt-2">
                        <div className="flex items-center gap-1.5 font-mono">
                          <SourceCodeIcon className="size-3 text-muted-foreground" />
                          <span>{req.target.component}</span>
                        </div>
                        <span className="tabular-nums">
                          {new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  );
                } else {
                  const cp = entry.item as Checkpoint;
                  const isDiffOpen = expandedDiffId === cp.id;
                  return (
                    <div
                      key={cp.id}
                      className="group relative flex flex-col gap-2.5 rounded-lg border border-border bg-card p-3.5 shadow-sm transition-all"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <div className="flex size-5 items-center justify-center rounded-full bg-success/15 text-success-foreground">
                            <GitCommitIcon className="size-3" />
                          </div>
                          <span className="font-mono text-xs font-medium text-foreground">
                            {cp.commit}
                          </span>
                          <span className="rounded bg-secondary px-1.5 py-0.2 text-[10px] font-mono text-muted-foreground">
                            v{cp.version}
                          </span>
                        </div>

                        <div className="flex items-center gap-1">
                          <Button
                            size="xs"
                            variant="secondary"
                            onClick={() => onRevertCheckpoint(cp.id)}
                            className="h-6 gap-1 px-2 text-[10px]"
                          >
                            <ArrowTurnBackwardIcon className="size-2.5" /> Revert
                          </Button>
                        </div>
                      </div>

                      <div>
                        <p className="text-xs font-medium text-foreground">
                          {cp.instruction}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Author: <strong className="font-medium text-foreground">{cp.authorName}</strong> · {cp.filesChanged} file changed
                        </p>
                      </div>

                      {/* Diff Toggle */}
                      {cp.diffSummary && (
                        <div className="flex flex-col gap-1.5 pt-1">
                          <button
                            onClick={() => setExpandedDiffId(isDiffOpen ? null : cp.id)}
                            className="flex items-center gap-1 text-[11px] font-medium text-primary hover:underline cursor-pointer"
                          >
                            {isDiffOpen ? <ArrowDown01Icon className="size-3" /> : <ArrowRight01Icon className="size-3" />}
                            <span>{isDiffOpen ? "Hide source diff" : "Inspect source diff"}</span>
                          </button>

                          {isDiffOpen && cp.diffCode && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              className="overflow-hidden rounded-lg border border-border bg-[#191919] p-3 text-[11px] font-mono text-emerald-400"
                            >
                              <div className="text-[10px] text-muted-foreground pb-1 border-b border-white/10 mb-2">
                                {cp.diffCode[0].file}
                              </div>
                              <pre className="text-red-400 bg-red-950/30 p-1.5 rounded mb-1 whitespace-pre-wrap">
                                - {cp.diffCode[0].oldCode}
                              </pre>
                              <pre className="text-emerald-400 bg-emerald-950/30 p-1.5 rounded whitespace-pre-wrap">
                                + {cp.diffCode[0].newCode}
                              </pre>
                            </motion.div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                }
              })
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
