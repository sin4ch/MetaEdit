"use client";

import { ComparisonSlider } from "@/components/ui/ComparisonSlider";

import * as React from "react";
import { HeaderMorph } from "@/components/ui/HeaderMorph";
import { Button } from "@/components/ui/Button";
import { MetaEditLogo, LogoVariantType } from "@/components/ui/Logo";
import { cn } from "@/lib/cn";
import { AccessModal } from "@/components/metaedit/AccessModal";
import { EditorPill } from "@/components/metaedit/EditorPill";
import { ActivityPanel } from "@/components/metaedit/ActivityPanel";
import { PresenceOverlay } from "@/components/metaedit/PresenceOverlay";
import { Inspectable } from "@/components/metaedit/Inspectable";
import { GlobalInspector } from "@/components/metaedit/GlobalInspector";
import { Modal } from "@/components/ui/Modal";
import { ToastContainer, ToastItem } from "@/components/ui/Toast";
import type { Annotation, TargetMetadata, MetaEditSession, WorkspaceState } from "@/types/metaedit";
import { fetchWorkspaceState, focusMetaEditRegion, focusMetaEditTarget, metaEditRequest } from "@/lib/metaedit-client";
import { annotationToScreenshotTarget, captureMetaEditScreenshot } from "@/lib/metaedit-screenshot";
import { PatchRuntime } from "@/components/metaedit/PatchRuntime";
import { WebMCPRegistry } from "@/components/metaedit/WebMCPRegistry";
import {
  CursorPointer02Icon,
  Globe02Icon,
  Comment01Icon,
  Rocket01Icon,
} from "hugeicons-react";

export default function MetaEditPage() {
  const [isMetaEditMode, setIsMetaEditMode] = React.useState(false);
  const [accessModalOpen, setAccessModalOpen] = React.useState(false);
  const [workspaceState, setWorkspaceState] = React.useState<WorkspaceState | null>(null);
  const [webMCPAvailable, setWebMCPAvailable] = React.useState(false);
  const [comparison, setComparison] = React.useState<{ revisionId: string; mode: "before" | "after" } | null>(null);

  const [isInspecting, setIsInspecting] = React.useState(false);
  const [selectedTarget, setSelectedTarget] = React.useState<TargetMetadata | null>(null);
  const [activityOpen, setActivityOpen] = React.useState(false);
  const [exitConfirmOpen, setExitConfirmOpen] = React.useState(false);
  const [publishConfirmRevisionId, setPublishConfirmRevisionId] = React.useState<string | null>(null);
  const [publishingRevisionId, setPublishingRevisionId] = React.useState<string | null>(null);
  const [inspectTipDismissed, setInspectTipDismissed] = React.useState(false);
  const activityButtonRef = React.useRef<HTMLButtonElement>(null);
  const cursorRef = React.useRef<{ x: number; y: number } | null>(null);
  const presenceSocketRef = React.useRef<WebSocket | null>(null);
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);
  const seenActivityIdsRef = React.useRef<Set<string>>(new Set());
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState("product");

  // Selected Brand Logo Variant (1 of 10)
  const selectedLogoVariant: LogoVariantType = "origami_prism";

  // Dynamic interactive element states
  const [pricingInterval, setPricingInterval] = React.useState<"monthly" | "yearly">("monthly");
  const [faqOpen, setFaqOpen] = React.useState<number | null>(0);

  const [busyRequest, setBusyRequest] = React.useState(false);

  React.useEffect(() => {
    const requested = window.location.hostname.startsWith("metaedit.") || new URLSearchParams(window.location.search).get("metaedit") === "1";
    fetchWorkspaceState("public").then(setWorkspaceState).catch(() => undefined);
    if (!requested) return;
    fetchWorkspaceState("workspace")
      .then((state) => { setWorkspaceState(state); setIsMetaEditMode(true); setIsInspecting(true); setInspectTipDismissed(false); })
      .catch(() => setAccessModalOpen(true));
  }, []);

  React.useEffect(() => {
    if (!isMetaEditMode) return;
    const timeout = window.setTimeout(() => setInspectTipDismissed(true), 7000);
    return () => window.clearTimeout(timeout);
  }, [isMetaEditMode]);

  React.useEffect(() => {
    if (!isMetaEditMode) return;
    let requestInFlight = false;
    let socket: WebSocket | null = null;
    let sendFrame: number | null = null;

    const mergePresence = (payload: {
      type?: string;
      collaborators?: Array<{ collaboratorId: string; displayName: string; color: string; cursor: { x: number; y: number } | null }>;
      collaborator?: { collaboratorId: string; displayName: string; color: string; cursor: { x: number; y: number } | null };
      collaboratorId?: string;
    }) => {
      setWorkspaceState((previous) => {
        if (!previous) return previous;
        const currentId = previous.currentCollaborator?.id;
        const byId = new Map(previous.collaborators.map((item) => [item.id, item]));
        const upsert = (item: { collaboratorId: string; displayName: string; color: string; cursor: { x: number; y: number } | null }) => {
          if (!item.collaboratorId || item.collaboratorId === currentId) return;
          const existing = byId.get(item.collaboratorId);
          byId.set(item.collaboratorId, {
            id: item.collaboratorId,
            displayName: item.displayName,
            role: existing?.role ?? "editor",
            color: item.color,
            email: existing?.email ?? null,
            lastSeenAt: new Date().toISOString(),
            cursor: item.cursor ?? undefined,
          });
        };

        if (payload.type === "presence.snapshot") payload.collaborators?.forEach(upsert);
        if (payload.type === "presence.joined" || payload.type === "cursor") {
          if (payload.collaborator) upsert(payload.collaborator);
        }
        if (payload.type === "presence.left" && payload.collaboratorId) {
          const existing = byId.get(payload.collaboratorId);
          if (existing) byId.set(payload.collaboratorId, { ...existing, cursor: undefined, lastSeenAt: new Date(0).toISOString() });
        }

        return { ...previous, collaborators: Array.from(byId.values()).filter((item) => item.id === currentId || item.lastSeenAt !== new Date(0).toISOString()) };
      });
    };

    const sendCursor = () => {
      sendFrame = null;
      if (!socket || socket.readyState !== WebSocket.OPEN) return;
      const cursor = cursorRef.current;
      socket.send(JSON.stringify(cursor ? { type: "cursor", x: cursor.x, y: cursor.y } : { type: "cursor", x: null, y: null }));
    };
    const sendCursorSoon = () => {
      if (sendFrame !== null) return;
      sendFrame = window.requestAnimationFrame(sendCursor);
    };
    const refresh = () => {
      if (requestInFlight) return;
      requestInFlight = true;
      const cursor = cursorRef.current;
      metaEditRequest<{ state: WorkspaceState }>("heartbeat", { cursor })
        .then((response) => setWorkspaceState(response.state))
        .catch(() => undefined)
        .finally(() => { requestInFlight = false; });
    };
    const updateCursor = (event: PointerEvent) => {
      cursorRef.current = { x: event.clientX, y: event.clientY };
      sendCursorSoon();
    };
    const clearCursor = () => {
      if (cursorRef.current === null) return;
      cursorRef.current = null;
      sendCursorSoon();
      refresh();
    };

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    try {
      socket = new WebSocket(`${protocol}//${window.location.host}/api/metaedit/presence`);
      presenceSocketRef.current = socket;
      socket.addEventListener("open", sendCursorSoon);
      socket.addEventListener("message", (event) => {
        if (typeof event.data !== "string") return;
        try { mergePresence(JSON.parse(event.data) as Parameters<typeof mergePresence>[0]); } catch { /* ignore malformed presence frames */ }
      });
      socket.addEventListener("close", () => {
        if (presenceSocketRef.current === socket) presenceSocketRef.current = null;
      });
    } catch {
      socket = null;
    }
    window.addEventListener("pointermove", updateCursor, { passive: true });
    window.addEventListener("pointerleave", clearCursor, { passive: true });
    window.addEventListener("blur", clearCursor, { passive: true });
    document.addEventListener("visibilitychange", clearCursor);
    const interval = window.setInterval(refresh, 750);
    refresh();
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("pointermove", updateCursor);
      window.removeEventListener("pointerleave", clearCursor);
      window.removeEventListener("blur", clearCursor);
      document.removeEventListener("visibilitychange", clearCursor);
      if (sendFrame !== null) window.cancelAnimationFrame(sendFrame);
      if (socket?.readyState === WebSocket.OPEN) {
        try { socket.send(JSON.stringify({ type: "cursor", x: null, y: null })); } catch { /* socket is closing */ }
      }
      socket?.close(1000, "MetaEdit session ended.");
      if (presenceSocketRef.current === socket) presenceSocketRef.current = null;
    };
  }, [isMetaEditMode]);

  const addToast = React.useCallback((title: string, description?: string, tone: "good" | "bad" | "info" = "good") => {
    const id = `toast_${Date.now()}_${Math.random()}`;
    setToasts((prev) => [...prev, { id, title, description, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  }, []);

  React.useEffect(() => {
    if (!isMetaEditMode || !workspaceState) return;
    const currentId = workspaceState.currentCollaborator?.id;
    const recentEvents = workspaceState.activity.slice().reverse();
    for (const event of recentEvents) {
      if (seenActivityIdsRef.current.has(event.id)) continue;
      seenActivityIdsRef.current.add(event.id);
      if (event.actorId === currentId) continue;
      if (event.kind === "revision.publish_requested") window.setTimeout(() => addToast("Publish requested", `${event.actorName} is asking to send an approved revision to GitHub.`, "info"), 0);
      if (event.kind === "revision.publish_failed") window.setTimeout(() => addToast("Publish failed", `${event.actorName}'s pull request could not be created.`, "bad"), 0);
    }
    if (seenActivityIdsRef.current.size > 500) seenActivityIdsRef.current = new Set(workspaceState.activity.map((event) => event.id));
  }, [addToast, isMetaEditMode, workspaceState]);

  const handleAuthorizeSession = ({ session, state }: { session: MetaEditSession; state: WorkspaceState }) => {
    setWorkspaceState(state);
    setIsMetaEditMode(true);
    setAccessModalOpen(false);
    setIsInspecting(true);
    setInspectTipDismissed(false);

    addToast(
      "MetaEdit Authorized",
      `Welcome ${session.collaborator.displayName}. Click any element to leave an annotation for your browser agent.`,
      "good"
    );
  };

  const requestExitMetaEdit = () => setExitConfirmOpen(true);

  const handleExitMetaEdit = async () => {
    setExitConfirmOpen(false);
    await metaEditRequest("logout").catch(() => undefined);
    setIsMetaEditMode(false);
    setSelectedTarget(null);
    setIsInspecting(false);
    setActivityOpen(false);
    setComparison(null);
    const visitorUrl = getVisitorUrl(window.location.href);
    if (visitorUrl) {
      window.location.replace(visitorUrl);
      return;
    }
    addToast("Visitor Mode", "Exited MetaEdit workspace. Back to visitor mode.", "info");
  };

  const handleCompareRevision = React.useCallback((revisionId: string | null, mode: "before" | "after" | null) => {
    setComparison(revisionId && mode ? { revisionId, mode } : null);
  }, []);

  const handleSelectTarget = (target: TargetMetadata) => {
    setSelectedTarget(target);
    setIsInspecting(false);
  };

  const handleSelectRegion = (target: TargetMetadata) => {
    setSelectedTarget(target);
    setIsInspecting(false);
  };

  const handleClearTarget = () => {
    setSelectedTarget(null);
    setIsInspecting(true);
  };

  const handleRequestChange = async (instruction: string) => {
    if (!selectedTarget) return;
    const beforeScreenshot = captureMetaEditScreenshot(selectedTarget);
    setBusyRequest(true);
    try {
      const response = await metaEditRequest<{ state: WorkspaceState }>("create_annotation", { target: selectedTarget, comment: instruction, beforeScreenshot });
      setWorkspaceState(response.state);
      setSelectedTarget(null);
      setIsInspecting(true);
      setActivityOpen(true);
      addToast("Annotation saved", webMCPAvailable ? "Your browser agent can now inspect it and propose a revision." : "Saved for collaborators. Open this page in a WebMCP-capable browser to ask an agent to change it.", "good");
    } catch (error) {
      addToast("Could not save annotation", error instanceof Error ? error.message : "Try again.", "bad");
    } finally {
      setBusyRequest(false);
    }
  };

  const handleReviewRevision = async (revisionId: string, decision: "approved" | "rejected") => {
    try {
      const response = await metaEditRequest<{ state: WorkspaceState }>("review_revision", { revisionId, decision });
      setWorkspaceState(response.state);
      addToast(decision === "approved" ? "Revision approved" : "Revision rejected", "Your review is visible to every collaborator.", decision === "approved" ? "good" : "info");
    } catch (error) { addToast("Review failed", error instanceof Error ? error.message : "Try again.", "bad"); }
  };

  const handlePublishRevision = (revisionId: string) => {
    setPublishConfirmRevisionId(revisionId);
  };

  const confirmPublishRevision = async () => {
    const revisionId = publishConfirmRevisionId;
    if (!revisionId || publishingRevisionId) return;
    const revision = workspaceState?.revisions.find((item) => item.id === revisionId);
    const annotation = revision?.annotationId ? workspaceState?.annotations.find((item) => item.id === revision.annotationId) : undefined;
    if (!revision || !annotation) {
      setPublishConfirmRevisionId(null);
      addToast("Publish blocked", "The annotated target is no longer available.", "bad");
      return;
    }
    setPublishingRevisionId(revisionId);
    setPublishConfirmRevisionId(null);
    setComparison({ revisionId, mode: "after" });
    try {
      await waitForPaint();
      const afterScreenshot = captureMetaEditScreenshot(annotationToScreenshotTarget(annotation));
      const response = await metaEditRequest<{ state: WorkspaceState; pullRequest?: { url: string; number: number } | null }>("publish_revision", { revisionId, afterScreenshot });
      setWorkspaceState(response.state);
      const pullRequest = response.pullRequest;
      addToast(pullRequest ? "Pull request created" : "Published", pullRequest ? `Review PR #${pullRequest.number} in GitHub.` : "The approved revision is now visible on the public page.", "good");
    } catch (error) { addToast("Publish blocked", error instanceof Error ? error.message : "Try again.", "bad"); }
    finally {
      setPublishingRevisionId(null);
      setComparison(null);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#ffffff] text-[#191919]">
      <PatchRuntime revisions={workspaceState?.revisions ?? []} preview={isMetaEditMode} comparison={comparison} />
      <WebMCPRegistry enabled={isMetaEditMode} state={workspaceState} onState={setWorkspaceState} onStatus={setWebMCPAvailable} />
      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onDismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />

      {/* Global Element Inspector: allows inspecting & selecting ANY element */}
      <GlobalInspector
        isInspecting={isInspecting}
        selectedTarget={selectedTarget}
        onSelectTarget={handleSelectTarget}
        onSelectRegion={handleSelectRegion}
        selectionColor={workspaceState?.currentCollaborator?.color}
      />

      {/* MetaEdit collaborator cursors in editor mode */}
      {isMetaEditMode && <PresenceOverlay collaborators={workspaceState?.collaborators ?? []} currentUserId={workspaceState?.currentCollaborator?.id} />}

      {/* Header with Morphing Glass Pill */}
      <HeaderMorph>
        {/* Left: Logomark + Adjacent Nav Items */}
        <div className="flex items-center gap-8 z-10">
          {/* Logomark */}
          <div className="flex size-8 items-center justify-center rounded-full border border-transparent bg-transparent p-0.5 overflow-hidden shrink-0">
            <MetaEditLogo className="size-full text-primary" styleVariant={selectedLogoVariant} tone="primary" />
          </div>

          {/* Desktop Left-Aligned Nav Items */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium">
            {[
              { id: "product", label: "Product" },
              { id: "workflow", label: "Workflow" },
              { id: "pricing", label: "Pricing" },
              { id: "faq", label: "FAQ" },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id);
                  const targetElement = document.getElementById(`${item.id}-section`);
                  if (targetElement) {
                    targetElement.scrollIntoView({ behavior: "smooth", block: "start" });
                  }
                }}
                className={cn(
                  "cursor-pointer transition-colors duration-150 outline-none hover:text-[#191919]",
                  activeTab === item.id ? "text-[#191919] font-medium" : "text-[#8f8f8f]"
                )}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Right CTA + Mobile Hamburger Menu */}
        <div className="flex items-center gap-2 z-10">
          {!isMetaEditMode ? (
            <Button
              size="sm"
              variant="primary"
              onClick={() => setAccessModalOpen(true)}
              className="shadow-sm"
            >
              <span>Enter MetaEdit</span>
            </Button>
          ) : (
            <div className="flex items-center gap-2 rounded-full bg-primary/10 px-3.5 py-1 text-sm font-medium text-primary border border-primary/20">
              <span className="size-2 rounded-full bg-primary" />
              <span>MetaEdit Active</span>
            </div>
          )}

          {/* Hamburger Menu Toggle (Mobile only) */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="flex md:hidden size-8 items-center justify-center rounded-full bg-[#f6f6f6] hover:bg-[#eaeaea] text-[#191919] cursor-pointer transition-colors"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? (
              <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </HeaderMorph>

      {/* Full Page Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 bg-[#ffffff] flex flex-col p-6 md:hidden animate-in fade-in duration-200">
          {/* Top Bar inside Menu */}
          <div className="flex items-center justify-between pb-6">
            <div className="flex items-center gap-2.5">
              <MetaEditLogo className="size-7 text-primary shrink-0" styleVariant={selectedLogoVariant} tone="primary" />
              <span className="text-lg font-medium text-[#191919]">MetaEdit</span>
            </div>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="flex size-9 items-center justify-center rounded-full bg-[#f6f6f6] text-[#191919] cursor-pointer"
            >
              <svg className="size-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Navigation Links */}
          <div className="flex flex-col gap-6 py-8 flex-1">
            {[
              { id: "product", label: "Product" },
              { id: "workflow", label: "Workflow" },
              { id: "pricing", label: "Pricing" },
              { id: "faq", label: "FAQ" },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileMenuOpen(false);
                  const targetElement = document.getElementById(`${item.id}-section`);
                  if (targetElement) {
                    targetElement.scrollIntoView({ behavior: "smooth", block: "start" });
                  }
                }}
                className="text-left text-2xl font-medium text-[#191919] hover:text-[#305dde] transition-colors"
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Bottom CTA Button */}
          <div className="pt-6">
            <Button
              variant="primary"
              onClick={() => {
                setMobileMenuOpen(false);
                setAccessModalOpen(true);
              }}
              className="w-full h-12 text-base rounded-full justify-center shadow-sm"
            >
              <span>Enter MetaEdit</span>
            </Button>
          </div>
        </div>
      )}

      {/* Main Page Container: Open spacing without divider lines */}
      <main className="mx-auto flex max-w-6xl flex-col gap-28 px-4 py-8 sm:gap-36 sm:px-6 sm:py-16">
        {/* Section 1: Hero with UI Showcase Comparison Slider as Hero Graphic */}
        <section id="product-section" className="flex flex-col items-center text-center scroll-mt-28 pt-4 gap-12">
          <div className="flex flex-col items-center">
            <h1 className="max-w-4xl text-4xl font-medium text-[#191919] sm:text-6xl md:text-7xl text-balance">
              Edit software from <span className="text-[#8f8f8f]">inside the software.</span>
            </h1>

            <p className="mt-5 max-w-2xl text-base sm:text-lg leading-relaxed text-[#6e6e6e] text-balance font-normal">
              Annotate any part of your website, let your browser agent propose the change, and publish it after review. MetaEdit stays hidden until you add the <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-[#305dde]/10 text-[#305dde] font-mono text-sm font-medium">metaedit.</span> subdomain.
            </p>

            <div className="mt-8 flex items-center justify-center">
              <Button
                variant="primary"
                onClick={() => setAccessModalOpen(true)}
                className="h-[38px] px-4 text-base font-medium shadow-sm gap-2"
              >
                <span>Get Started Free</span>
                <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14" />
                  <path d="M13 18l6-6" />
                  <path d="M13 6l6 6" />
                </svg>
              </Button>
            </div>
          </div>

          <div className="w-[calc(100%+1rem)] max-w-[1104px] self-start sm:w-[calc(100%+1.5rem)]">
            <ComparisonSlider />
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 3: WORKFLOW */}
        {/* ========================================================================= */}
        <section id="workflow-section" className="scroll-mt-28">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-medium text-[#191919]">How MetaEdit works</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-stretch">
            {/* Card 0: Subdomain Workspace Switch */}
            <div className="rounded-lg bg-[#f6f6f6] p-6 flex flex-col justify-start gap-6 h-full">
              {/* Top Media Slot (Strict Fixed Box: h-40) */}
              <div className="w-full h-40 flex items-center justify-center shrink-0">
                <div className="w-full rounded-xl bg-[#e5e5e5] p-2 shadow-sm flex flex-col gap-1.5">
                  {/* Chrome Tab */}
                  <div className="inline-flex items-center gap-1.5 bg-white rounded-t-md px-2.5 py-1 text-[11px] text-[#191919] font-medium self-start shadow-sm">
                    <div className="size-3 rounded-full border border-[#191919] flex items-center justify-center">
                      <div className="size-1 rounded-full bg-[#191919]" />
                    </div>
                    <span>New Tab</span>
                    <span className="text-[#8f8f8f] hover:text-[#191919] text-[9px] ml-1">×</span>
                  </div>

                  {/* Omnibox Bar */}
                  <div className="bg-white rounded-lg p-1.5 flex items-center gap-1.5 shadow-sm">
                    <span className="text-[#8f8f8f] text-[11px]">←</span>
                    <span className="text-[#8f8f8f] text-[11px]">⟳</span>
                    <div className="flex-1 min-w-0 rounded-full border-2 border-[#305dde] bg-white px-2 py-0.5 flex items-center gap-1 text-[11px] font-mono">
                      <span className="text-[#305dde] text-[10px] shrink-0">🌐</span>
                      <div className="flex items-center truncate">
                        <span className="bg-[#305dde] text-white px-1 py-0.2 rounded-sm font-medium shrink-0">metaedit</span>
                        <span className="text-[#191919] truncate">.example.com</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Content Area */}
              <div className="flex flex-col gap-3">
                <div className="flex size-9 items-center justify-center rounded-full bg-white shrink-0">
                  <Globe02Icon className="size-4.5 text-[#305dde]" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-medium text-[#305dde]">Open the editor</h3>
                  <p className="text-base text-[#6e6e6e] leading-relaxed">
                    Add <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-[#305dde]/10 text-[#305dde] font-mono text-sm font-medium">metaedit.</span> in front of your website link to begin.
                  </p>
                </div>
              </div>
            </div>

            {/* Card 1: Element Inspector */}
            <div className="rounded-lg bg-[#f6f6f6] p-6 flex flex-col justify-start gap-6 h-full">
              {/* Top Media Slot (Strict Fixed Box: h-40) */}
              <div className="w-full h-40 flex items-center justify-center shrink-0">
                <div className="w-full h-[132px] rounded-xl bg-white p-3 shadow-sm flex flex-col justify-center relative overflow-hidden select-none">
                  {/* Surrounding Context Hint */}
                  <div className="text-lg font-bold text-[#191919]/30 tracking-tight leading-none -mt-1 pl-1">
                    inside the software.
                  </div>

                  {/* Targeted Rectangular Blue Bounding Box */}
                  <div className="relative rounded-none border border-[#1f57e7] bg-[#f4f7fe]/50 px-2.5 py-2 mt-2">
                    {/* Compact Top-Left Pill Badge */}
                    <div className="absolute -top-4 -left-px bg-[#1f57e7] text-white px-1.5 py-0.5 rounded-t text-[9px] font-mono whitespace-nowrap leading-none flex items-center gap-1">
                      <span className="font-medium">ParagraphText</span>
                      <span className="opacity-70 text-[8px]">#paragraphtext-303</span>
                    </div>

                    {/* Target Content */}
                    <p className="text-[10px] text-[#333333] leading-relaxed line-clamp-2">
                      MetaEdit turns any live website into a collaborative development workspace...
                    </p>
                  </div>
                </div>
              </div>

              {/* Bottom Content Area */}
              <div className="flex flex-col gap-3">
                <div className="flex size-9 items-center justify-center rounded-full bg-white shrink-0">
                  <CursorPointer02Icon className="size-4.5 text-[#305dde]" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-medium text-[#305dde]">Click anything</h3>
                  <p className="text-base text-[#6e6e6e] leading-relaxed">
                    Click any text, button, or section on your page.
                  </p>
                </div>
              </div>
            </div>

            {/* Card 2: Real Annotation Popover UI */}
            <div className="rounded-lg bg-[#f6f6f6] p-6 flex flex-col justify-start gap-6 h-full">
              {/* Top Media Slot (Strict Fixed Box: h-40) */}
              <div className="w-full h-40 flex items-center justify-center shrink-0">
                <div className="w-full rounded-xl bg-white border border-[#191919]/10 p-3 shadow-sm flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs px-0.5">
                    <span className="font-medium text-[#191919]">HeroHeadline</span>
                    <span className="font-mono text-[10px] text-[#8f8f8f]">#hero-title</span>
                  </div>
                  <div className="rounded-lg bg-[#f6f6f6] p-2 text-xs text-[#191919]">
                    Make headline shorter & bold
                  </div>
                  <div className="flex items-center justify-between pt-0.5">
                    <span className="text-[10px] text-[#8f8f8f] font-mono">You</span>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-[#6e6e6e] px-2 py-0.5 rounded-full bg-[#f6f6f6]">Cancel</span>
                      <span className="text-[10px] text-white px-2.5 py-0.5 rounded-full bg-[#191919] font-medium">Save</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Content Area */}
              <div className="flex flex-col gap-3">
                <div className="flex size-9 items-center justify-center rounded-full bg-white shrink-0">
                  <Comment01Icon className="size-4.5 text-[#305dde]" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-medium text-[#305dde]">Say what to change</h3>
                  <p className="text-base text-[#6e6e6e] leading-relaxed">
                    Type what you want changed and hit save.
                  </p>
                </div>
              </div>
            </div>

            {/* Card 3: Commit Diff Preview */}
            <div className="rounded-lg bg-[#f6f6f6] p-6 flex flex-col justify-start gap-6 h-full">
              {/* Top Media Slot (Strict Fixed Box: h-40) */}
              <div className="w-full h-40 flex items-center justify-center shrink-0">
                <div className="w-full rounded-xl bg-white border border-[#191919]/10 p-3 shadow-sm flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-mono text-[#059669] font-medium">Proposed change</span>
                  </div>
                  <div className="rounded-lg bg-[#f6f6f6] p-2 font-mono text-[11px] space-y-0.5">
                    <div className="text-rose-600 truncate">- text-4xl leading-tight</div>
                    <div className="text-emerald-600 truncate">+ text-5xl font-bold</div>
                  </div>
                </div>
              </div>

              {/* Bottom Content Area */}
              <div className="flex flex-col gap-3">
                <div className="flex size-9 items-center justify-center rounded-full bg-white shrink-0">
                  <Rocket01Icon className="size-4.5 text-[#305dde]" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-medium text-[#305dde]">Ship it live</h3>
                  <p className="text-base text-[#6e6e6e] leading-relaxed">
                    Approved revisions publish from the same workspace.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>



        {/* ========================================================================= */}
        {/* SECTION 5: PRICING */}
        {/* ========================================================================= */}
        <section id="pricing-section" className="scroll-mt-28">
          <div className="flex flex-col items-center text-center gap-5 mb-12">
            <h2 className="text-3xl font-medium text-[#191919]">Simple, transparent pricing</h2>

            <div className="inline-flex items-center rounded-full bg-[#f6f6f6] p-1 text-sm font-medium">
              <button
                type="button"
                onClick={() => setPricingInterval("monthly")}
                className={cn("px-4 py-1.5 rounded-full cursor-pointer transition-colors", pricingInterval === "monthly" ? "bg-[#191919] text-white shadow-sm" : "text-[#6e6e6e]")}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setPricingInterval("yearly")}
                className={cn("px-4 py-1.5 rounded-full cursor-pointer transition-colors", pricingInterval === "yearly" ? "bg-[#191919] text-white shadow-sm" : "text-[#6e6e6e]")}
              >
                Yearly (save 20%)
              </button>
            </div>
          </div>

          <div className="w-full max-w-2xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-6 items-stretch">
            {/* Free Tier Card (Vertical Layout, Taller & Spaced) */}
            <div className="rounded-lg bg-[#f6f6f6] p-8 flex flex-col justify-between gap-10 min-h-[520px] h-full">
              <div className="space-y-6">
                <div className="space-y-2">
                  <h3 className="text-xl font-medium text-[#191919]">Dev</h3>
                  <p className="text-base text-[#6e6e6e] leading-relaxed">For solo builders and public experiments testing in-app editing.</p>
                </div>

                <div className="flex items-baseline gap-1.5 pt-2">
                  <span className="text-5xl font-medium text-[#191919]">$0</span>
                  <span className="text-base text-[#8f8f8f]">/ free forever</span>
                </div>

                <div className="pt-6 border-t border-[#191919]/10 space-y-4 text-base text-[#6e6e6e]">
                  <div className="flex items-center gap-3">
                    <span className="text-[#305dde] font-medium">✓</span>
                    <span>Direct in-browser visual editing</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[#305dde] font-medium">✓</span>
                    <span>Versioned previews and approvals</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[#305dde] font-medium">✓</span>
                    <span>Single workspace session</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[#305dde] font-medium">✓</span>
                    <span>Community support</span>
                  </div>
                </div>
              </div>

              <Button
                size="md"
                variant="outline"
                onClick={() => setAccessModalOpen(true)}
                className="w-full h-11 rounded-full text-sm font-medium bg-white border-[#191919]/10 hover:bg-[#f6f6f6] text-[#191919] shadow-sm cursor-pointer"
              >
                Start Free
              </Button>
            </div>

            {/* Pro Team Card (Vertical Layout, Taller & Spaced) */}
            <Inspectable
              id="pricing-pro-row"
              component="PricingProRow"
              source="src/app/page.tsx"
              description="Pro team subscription row"
              isInspecting={isInspecting}
              isSelected={selectedTarget?.instanceId === "pricing-pro-row"}
              remoteOutlineColor="#8b5cf6"
              remoteCollaboratorName="Maya"
              onSelect={handleSelectTarget}
            >
              <div className="rounded-lg bg-[#f6f6f6] p-8 flex flex-col justify-between gap-10 min-h-[520px] h-full">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <h3 className="text-xl font-medium text-[#191919]">Teams</h3>
                    <p className="text-base text-[#6e6e6e] leading-relaxed">For product teams wanting live in-app collaborative source mutation.</p>
                  </div>

                  <div className="flex items-baseline gap-1.5 pt-2">
                    <span className="text-5xl font-medium text-[#191919]">
                      {pricingInterval === "monthly" ? "$29" : "$24"}
                    </span>
                    <span className="text-base text-[#8f8f8f]">/ editor / month</span>
                  </div>

                  <div className="pt-6 border-t border-[#191919]/10 space-y-4 text-base text-[#191919]">
                    <div className="flex items-center gap-3">
                      <span className="text-[#305dde] font-medium">✓</span>
                      <span>Multiplayer cursors & live presence</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[#305dde] font-medium">✓</span>
                      <span>AI code generation & prompt history</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[#305dde] font-medium">✓</span>
                      <span>One-click checkpoint rollbacks</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[#305dde] font-medium">✓</span>
                      <span>Component soft-locking to prevent collisions</span>
                    </div>
                  </div>
                </div>

                <Button
                  size="md"
                  variant="primary"
                  onClick={() => setAccessModalOpen(true)}
                  className="w-full h-11 rounded-full text-sm font-medium shadow-sm cursor-pointer"
                >
                  Get Started with Teams
                </Button>
              </div>
            </Inspectable>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 6: FAQ */}
        {/* ========================================================================= */}
        <section id="faq-section" className="flex flex-col items-center scroll-mt-28">
          <h2 className="text-3xl font-medium text-[#191919] text-center mb-12">
            Fair questions, <span className="text-[#8f8f8f] font-normal">straight answers.</span>
          </h2>

          <div className="w-full max-w-2xl flex flex-col gap-3">
            {[
              {
                q: "How does MetaEdit actually change my site?",
                a: "When you annotate an element, MetaEdit records a stable selector plus its text and style snapshot. Your WebMCP-capable browser agent reads that context and proposes a constrained UI revision. The revision stays in preview until collaborators approve it and the owner publishes it.",
              },
              {
                q: "Do regular visitors see the editor or cursors?",
                a: "No. Regular visitors browse your site normally. The editing tools, live cursors, and inspector overlays only appear when you visit your site via the metaedit. subdomain and authenticate with your workspace token.",
              },
              {
                q: "Does MetaEdit push changes to my Git repository?",
                a: "Yes, but only after review. The owner confirms publication, then MetaEdit creates a branch, commits the structured patch and before/after evidence, and opens a GitHub pull request. The preview remains visible in the workspace while the pull request goes through your normal engineering review.",
              },
              {
                q: "What happens if two teammates edit the same element at once?",
                a: "Each annotation and revision has an author, timestamp, target, and version. Conflicting proposals remain separate so collaborators can compare them and approve the one they want to publish.",
              },
              {
                q: "Does MetaEdit add heavy JavaScript to my production site?",
                a: "Public visitors receive the small patch runtime needed to apply published revisions. The inspector, collaboration panel, and WebMCP tools only activate after MetaEdit authentication.",
              },
              {
                q: "Can I self-host MetaEdit on my own infrastructure?",
                a: "Yes. MetaEdit uses the WebMCP browser API and a durable SQLite-compatible store. This demo is configured for OpenAI Sites and Cloudflare D1, and the application code remains portable.",
              },
            ].map((faq, idx) => {
              const isOpen = faqOpen === idx;
              return (
                <div
                  key={idx}
                  className="overflow-hidden rounded-2xl bg-[#f6f6f6] transition-all"
                >
                  <button
                    type="button"
                    onClick={() => setFaqOpen(isOpen ? null : idx)}
                    className="flex w-full items-center justify-between px-6 py-5 text-left text-base font-medium text-[#191919] cursor-pointer outline-none hover:text-[#191919]/80 transition-colors"
                  >
                    <span>{faq.q}</span>
                    <span className="text-[#8f8f8f] ml-4 transition-transform duration-200">
                      {isOpen ? (
                        <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M5 15l7-7 7 7" />
                        </svg>
                      ) : (
                        <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 9l-7 7-7-7" />
                        </svg>
                      )}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="px-6 pb-6 pt-1 text-base text-[#6e6e6e] leading-relaxed">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ========================================================================= */}
        {/* SECTION 7: CALL-TO-ACTION FOOTER CARD (CLEAN LIGHT PLATE) */}
        {/* ========================================================================= */}
        <footer className="pb-12">
          <div className="relative overflow-hidden rounded-lg bg-[#f6f6f6] p-10 sm:p-16 text-center text-[#191919] flex flex-col items-center justify-center gap-8">
            {/* Brand Logo in Theme Color */}
            <MetaEditLogo className="size-20 sm:size-24" styleVariant={selectedLogoVariant} tone="primary" />

            <div className="max-w-2xl space-y-4">
              <h2 className="text-3xl sm:text-5xl font-medium tracking-tight text-[#191919] text-balance leading-tight">
                Edit and ship software <span className="text-[#8f8f8f] font-normal">directly from your browser.</span>
              </h2>
            </div>

            <Button
              variant="primary"
              onClick={() => setAccessModalOpen(true)}
              className="h-[38px] px-4 text-base font-medium shadow-sm gap-2"
            >
              <span>Get Started Free</span>
              <svg className="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="M13 18l6-6" />
                <path d="M13 6l6 6" />
              </svg>
            </Button>
          </div>
        </footer>
      </main>

      {isMetaEditMode && !inspectTipDismissed && (
        <div
          data-metaedit-chrome="true"
          className="pointer-events-auto fixed left-1/2 top-20 z-[70] flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-full border border-[#191919]/10 bg-white px-3.5 py-2 text-xs text-[#505050] shadow-[0_8px_28px_rgba(0,0,0,0.12)]"
          role="status"
        >
          <span>Click an element to annotate it, or drag over a section.</span>
          <button type="button" onClick={() => setInspectTipDismissed(true)} className="shrink-0 rounded-full px-1.5 py-0.5 font-medium text-[#6e6e6e] transition hover:bg-[#f3f3f3] hover:text-[#191919]" aria-label="Dismiss editing tip">Got it</button>
        </div>
      )}

      {/* Access Token Gate Modal */}
      <AccessModal
        open={accessModalOpen}
        onClose={() => setAccessModalOpen(false)}
        onSuccess={handleAuthorizeSession}
      />

      {/* Floating Editor Pill in MetaEdit Mode — Contains the ONLY exit button */}
      {isMetaEditMode && (
        <EditorPill
          selectedTarget={selectedTarget}
          onClearTarget={handleClearTarget}
          onRequestChange={handleRequestChange}
          onToggleActivity={() => setActivityOpen(!activityOpen)}
          activityButtonRef={activityButtonRef}
          activityOpen={activityOpen}
          collaborators={workspaceState?.collaborators ?? []}
          currentCollaboratorId={workspaceState?.currentCollaborator?.id}
          hasSoftLock={null}
          busy={busyRequest}
          onExitMetaEdit={requestExitMetaEdit}
        />
      )}

      <Modal open={exitConfirmOpen} onClose={() => setExitConfirmOpen(false)} className="max-w-sm rounded-2xl bg-white p-6">
        <div className="space-y-5">
          <div className="space-y-1">
            <h2 className="text-lg font-medium text-[#191919]">Exit MetaEdit?</h2>
            <p className="text-sm leading-relaxed text-[#6e6e6e]">Your annotations and previews stay saved, but you will return to visitor mode.</p>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={() => setExitConfirmOpen(false)} className="h-9 rounded-full px-4 text-sm font-medium text-[#6e6e6e] transition hover:bg-[#f3f3f3] hover:text-[#191919]">Stay</button>
            <button type="button" onClick={handleExitMetaEdit} className="h-9 rounded-full bg-[#191919] px-4 text-sm font-medium text-white transition hover:bg-[#303030]">Exit MetaEdit</button>
          </div>
        </div>
      </Modal>

      <Modal open={Boolean(publishConfirmRevisionId)} onClose={() => { if (!publishingRevisionId) setPublishConfirmRevisionId(null); }} className="max-w-sm rounded-2xl bg-white p-6">
        <div className="space-y-5">
          <div className="space-y-1">
            <h2 className="text-lg font-medium text-[#191919]">Create a pull request?</h2>
            <p className="text-sm leading-relaxed text-[#6e6e6e]">This sends the approved preview to GitHub with its structured patch and before/after screenshots. Other collaborators will see that publishing has started.</p>
          </div>
          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={() => setPublishConfirmRevisionId(null)} className="h-9 rounded-full px-4 text-sm font-medium text-[#6e6e6e] transition hover:bg-[#f3f3f3] hover:text-[#191919]">Cancel</button>
            <button type="button" onClick={confirmPublishRevision} className="h-9 rounded-full bg-[#191919] px-4 text-sm font-medium text-white transition hover:bg-[#303030]">Create pull request</button>
          </div>
        </div>
      </Modal>

      {/* Activity & History Panel */}
      <ActivityPanel
        open={activityOpen}
        onClose={() => setActivityOpen(false)}
        anchorRef={activityButtonRef}
        state={workspaceState}
        comparison={comparison}
        onCompare={handleCompareRevision}
        onFocus={(annotation: Annotation) => { const color = annotation.authorColor ?? workspaceState?.currentCollaborator?.color; if (annotation.selectionType === "region" && annotation.region) focusMetaEditRegion(annotation.region, color); else focusMetaEditTarget(annotation.selector, color); setActivityOpen(false); }}
        onReview={handleReviewRevision}
        onPublish={handlePublishRevision}
        publishingRevisionId={publishingRevisionId}
      />
    </div>
  );
}

function waitForPaint() {
  return new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

function getVisitorUrl(currentHref: string): string | null {
  const url = new URL(currentHref);
  let changed = false;
  if (url.hostname.startsWith("metaedit.")) {
    url.hostname = url.hostname.slice("metaedit.".length);
    changed = true;
  }
  if (url.searchParams.has("metaedit")) {
    url.searchParams.delete("metaedit");
    changed = true;
  }
  return changed ? url.toString() : null;
}
