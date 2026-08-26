"use client";

import * as React from "react";
import { applyPatchOperations } from "@/lib/metaedit-client";
import type { Revision } from "@/types/metaedit";

export function PatchRuntime({ revisions, preview }: { revisions: Revision[]; preview: boolean }) {
  React.useLayoutEffect(() => {
    const applicable = revisions.filter((revision) => preview ? revision.status !== "rejected" : revision.status === "published");
    const frame = requestAnimationFrame(() => {
      revisions.slice().sort((a, b) => b.version - a.version).forEach((revision) => applyPatchOperations(revision.before));
      applicable.sort((a, b) => a.version - b.version).forEach((revision) => applyPatchOperations(revision.patch));
    });
    return () => cancelAnimationFrame(frame);
  }, [revisions, preview]);
  return null;
}
