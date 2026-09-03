"use client";

import * as React from "react";
import { applyPatchOperations } from "@/lib/metaedit-client";
import type { Revision } from "@/types/metaedit";

export interface PatchComparison {
  revisionId: string;
  mode: "before" | "after";
}

export function PatchRuntime({ revisions, preview, comparison = null }: { revisions: Revision[]; preview: boolean; comparison?: PatchComparison | null }) {
  React.useLayoutEffect(() => {
    const applicable = revisions.filter((revision) => preview ? revision.status !== "rejected" : revision.status === "published");
    const comparedRevision = comparison ? revisions.find((revision) => revision.id === comparison.revisionId) : undefined;
    const visible = comparedRevision
      ? applicable.filter((revision) => revision.version < comparedRevision.version)
      : applicable;
    const frame = requestAnimationFrame(() => {
      revisions.slice().sort((a, b) => b.version - a.version).forEach((revision) => applyPatchOperations(revision.before));
      visible.slice().sort((a, b) => a.version - b.version).forEach((revision) => applyPatchOperations(revision.patch));
      if (comparedRevision && comparison?.mode === "after" && comparedRevision.status !== "rejected") {
        applyPatchOperations(comparedRevision.patch);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [revisions, preview, comparison]);
  return null;
}
