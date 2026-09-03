"use client";

import * as React from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { MetaEditLogo } from "@/components/ui/Logo";
import { ArrowRight01Icon, Cancel01Icon } from "hugeicons-react";
import { metaEditRequest } from "@/lib/metaedit-client";
import type { MetaEditSession, WorkspaceState } from "@/types/metaedit";

interface AccessModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: (result: { session: MetaEditSession; state: WorkspaceState }) => void;
}

export function AccessModal({ open, onClose, onSuccess }: AccessModalProps) {
  const [displayName, setDisplayName] = React.useState("Alex Rivera");
  const [token, setToken] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setError("Please enter a collaborator name.");
      return;
    }
    if (!token.trim()) {
      setError("Please enter an access token.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await metaEditRequest<{ session: MetaEditSession; state: WorkspaceState }>("login", {
        displayName: displayName.trim(),
        token: token.trim(),
      });
      setLoading(false);
      setToken("");
      onSuccess(result);
    } catch (caught) {
      setLoading(false);
      setError(caught instanceof Error ? caught.message : "Could not enter the workspace.");
    }
  };

  return (
    <Modal open={open} onClose={onClose} className="max-w-md rounded-lg bg-[#ffffff] border border-[#191919]/10 p-7 shadow-[0_20px_50px_rgba(0,0,0,0.14)]">
      <div className="flex flex-col gap-6">
        {/* Header: Clean Logo + Title + Close Button */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <MetaEditLogo className="size-8 text-primary" styleVariant="origami_prism" tone="primary" />
            <div>
              <h2 className="text-xl font-medium text-[#191919]">Enter MetaEdit</h2>
              <p className="text-sm text-[#6e6e6e] mt-0.5">
                Switch to live in-app collaborative editing.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 items-center justify-center rounded-full text-[#8f8f8f] hover:text-[#191919] hover:bg-[#f6f6f6] transition-colors cursor-pointer"
            aria-label="Close"
          >
            <Cancel01Icon className="size-4" />
          </button>
        </div>

        {/* Inputs Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Display Name Field */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-[#191919]">
              Your name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="e.g. Maya Chen"
              className="h-11 w-full rounded-md bg-[#f6f6f6] px-4 text-base text-[#191919] placeholder-[#8f8f8f] outline-none transition-colors border border-transparent focus:border-[#305dde]/40 focus:bg-white"
            />
          </div>

          {/* Access Token Field */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-[#191919]">
                Session token
              </label>
              <button
                type="button"
                onClick={() => setToken("WEBMCP")}
                className="text-xs text-primary hover:underline cursor-pointer font-medium"
              >
                Use local demo token
              </button>
            </div>
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="WEBMCP"
              className="h-11 w-full rounded-md bg-[#f6f6f6] px-4 font-mono text-base text-[#191919] placeholder-[#8f8f8f] outline-none transition-colors border border-transparent focus:border-[#305dde]/40 focus:bg-white"
            />
          </div>

          {error && (
            <div className="rounded-md bg-rose-50 p-3 text-sm text-rose-600">
              {error}
            </div>
          )}

          {/* Action Row */}
          <div className="mt-2 flex items-center justify-end gap-2.5 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="h-10 pl-4 pr-4 rounded-full text-sm font-medium text-[#6e6e6e] hover:bg-[#f6f6f6] hover:text-[#191919] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <Button
              type="submit"
              loading={loading}
              size="md"
              variant="primary"
              className="h-10 pl-5 pr-4 rounded-full text-sm font-medium shadow-sm gap-1.5"
            >
              <span>Enter Workspace</span>
              <ArrowRight01Icon className="size-4 shrink-0 -mr-0.5" />
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
