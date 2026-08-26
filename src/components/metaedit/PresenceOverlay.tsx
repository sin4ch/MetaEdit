"use client";

import * as React from "react";
import { motion } from "motion/react";
import { Collaborator } from "@/types/metaedit";

interface PresenceOverlayProps {
  collaborators: Collaborator[];
  currentUserId?: string;
}

export function PresenceOverlay({ collaborators, currentUserId }: PresenceOverlayProps) {
  const remoteCollaborators = collaborators.filter((c) => c.id !== currentUserId && c.cursor);

  return (
    <div className="pointer-events-none fixed inset-0 z-40 overflow-hidden">
      {remoteCollaborators.map((collaborator) => {
        if (!collaborator.cursor) return null;
        return (
          <motion.div
            key={collaborator.id}
            initial={{ opacity: 0, x: collaborator.cursor.x, y: collaborator.cursor.y }}
            animate={{ opacity: 1, x: collaborator.cursor.x, y: collaborator.cursor.y }}
            transition={{ type: "spring", damping: 30, stiffness: 200 }}
            className="absolute top-0 left-0 flex items-start gap-1"
          >
            <svg
              className="size-5 drop-shadow-md -translate-x-1 -translate-y-1"
              viewBox="0 0 24 24"
              fill={collaborator.color}
              stroke="white"
              strokeWidth="1.5"
            >
              <path d="M5.653 4.295A1 1 0 004 5.12v13.76a1 1 0 001.653.825l3.963-3.303a1 1 0 01.64-.236h6.744a1 1 0 00.707-1.707L5.653 4.295z" />
            </svg>
            <div
              style={{ backgroundColor: collaborator.color }}
              className="rounded-full px-2 py-0.5 text-[10px] font-medium text-white shadow-sm whitespace-nowrap"
            >
              {collaborator.displayName}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
