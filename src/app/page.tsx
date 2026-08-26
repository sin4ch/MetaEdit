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
import { ToastContainer, ToastItem } from "@/components/ui/Toast";
import { TargetMetadata, ChangeRequest, Checkpoint, Collaborator } from "@/types/metaedit";
import {
  Activity01Icon,
  UserGroupIcon,
  ArrowRight01Icon,
  SecurityCheckIcon,
  GitCommitIcon,
  CpuIcon,
  ZapIcon,
  Clock01Icon,
  CursorPointer02Icon,
  Globe02Icon,
  Comment01Icon,
  Rocket01Icon,
  LockKeyIcon,
  CheckmarkCircle02Icon,
  Shield01Icon,
} from "hugeicons-react";

export default function MetaEditPage() {
  const [isMetaEditMode, setIsMetaEditMode] = React.useState(false);
  const [accessModalOpen, setAccessModalOpen] = React.useState(false);
  const [currentCollaborator, setCurrentCollaborator] = React.useState<{
    displayName: string;
    token: string;
    role: "editor" | "owner";
  } | null>(null);

  const [isInspecting, setIsInspecting] = React.useState(false);
  const [selectedTarget, setSelectedTarget] = React.useState<TargetMetadata | null>(null);
  const [activityOpen, setActivityOpen] = React.useState(false);
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [activeTab, setActiveTab] = React.useState("product");

  // Selected Brand Logo Variant (1 of 10)
  const [selectedLogoVariant, setSelectedLogoVariant] = React.useState<LogoVariantType>("origami_prism");

  // Dynamic interactive element states
  const [pricingAccent, setPricingAccent] = React.useState<"default" | "emerald">("default");
  const [pricingInterval, setPricingInterval] = React.useState<"monthly" | "yearly">("monthly");
  const [faqOpen, setFaqOpen] = React.useState<number | null>(0);

  const [collaborators, setCollaborators] = React.useState<Collaborator[]>([
    {
      id: "user_maya",
      sessionId: "session_hackathon_82k",
      displayName: "Maya Chen",
      role: "editor",
      color: "#8b5cf6",
      lastSeenAt: new Date().toISOString(),
      cursor: { x: 380, y: 460 },
      activeTarget: "pricing-pro-row",
    },
    {
      id: "user_alex",
      sessionId: "session_hackathon_82k",
      displayName: "Alex Rivera",
      role: "owner",
      color: "#305dde",
      lastSeenAt: new Date().toISOString(),
    },
  ]);

  const [requests, setRequests] = React.useState<ChangeRequest[]>([]);
  const [checkpoints, setCheckpoints] = React.useState<Checkpoint[]>([
    {
      id: "cp_init_17",
      sessionId: "session_hackathon_82k",
      version: 17,
      commit: "9f4a12b",
      parentCommit: "8b23ce1",
      requestId: "req_init",
      authorId: "user_maya",
      authorName: "Maya Chen",
      instruction: "Add prominent 10-logo visual gallery switcher with real icon previews",
      targetComponent: "LogoGallery",
      filesChanged: 2,
      diffSummary: "Updated logo switcher UI with large visual cards in page.tsx",
      diffCode: [
        {
          file: "src/app/page.tsx",
          oldCode: `<div className="mt-10 flex flex-col items-center">...`,
          newCode: `<div className="mt-12 w-full max-w-4xl rounded-lg bg-[#f6f6f6] p-6">...`,
        },
      ],
      createdAt: new Date(Date.now() - 1800000).toISOString(),
    },
  ]);

  const [busyRequest, setBusyRequest] = React.useState(false);

  React.useEffect(() => {
    if (!isMetaEditMode) return;
    const interval = setInterval(() => {
      setCollaborators((prev) =>
        prev.map((c) => {
          if (c.id === "user_maya" && c.cursor) {
            const dx = (Math.random() - 0.5) * 40;
            const dy = (Math.random() - 0.5) * 30;
            return {
              ...c,
              cursor: {
                x: Math.max(100, Math.min(window.innerWidth - 100, c.cursor.x + dx)),
                y: Math.max(150, Math.min(800, c.cursor.y + dy)),
              },
            };
          }
          return c;
        })
      );
    }, 2800);
    return () => clearInterval(interval);
  }, [isMetaEditMode]);

  const addToast = (title: string, description?: string, tone: "good" | "bad" | "info" = "good") => {
    const id = `toast_${Date.now()}_${Math.random()}`;
    setToasts((prev) => [...prev, { id, title, description, tone }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4500);
  };

  const handleAuthorizeSession = (sessionData: {
    displayName: string;
    token: string;
    role: "editor" | "owner";
  }) => {
    setCurrentCollaborator(sessionData);
    setIsMetaEditMode(true);
    setAccessModalOpen(false);
    setIsInspecting(true);

    addToast(
      "MetaEdit Authorized",
      `Welcome ${sessionData.displayName}! Click any element on the page to annotate and request changes.`,
      "good"
    );
  };

  const handleExitMetaEdit = () => {
    setIsMetaEditMode(false);
    setSelectedTarget(null);
    setIsInspecting(false);
    setActivityOpen(false);
    addToast("Visitor Mode", "Exited MetaEdit workspace. Back to visitor mode.", "info");
  };

  const handleSelectTarget = (target: TargetMetadata) => {
    setSelectedTarget(target);
    setIsInspecting(false);
  };

  const handleRequestChange = (instruction: string) => {
    if (!selectedTarget) return;

    const reqId = `req_${Date.now()}`;
    const authorName = currentCollaborator?.displayName || "Alex Rivera";
    const authorColor = "#305dde";

    const newReq: ChangeRequest = {
      id: reqId,
      sessionId: "session_hackathon_82k",
      authorId: "user_current",
      authorName,
      authorColor,
      baseVersion: checkpoints[0]?.version || 17,
      target: selectedTarget,
      instruction,
      status: "queued",
      createdAt: new Date().toISOString(),
    };

    setRequests((prev) => [newReq, ...prev]);
    setBusyRequest(true);
    setSelectedTarget(null);

    setTimeout(() => {
      setRequests((prev) =>
        prev.map((r) => (r.id === reqId ? { ...r, status: "inspecting_target" } : r))
      );
    }, 700);

    setTimeout(() => {
      setRequests((prev) =>
        prev.map((r) => (r.id === reqId ? { ...r, status: "editing_source" } : r))
      );
    }, 1800);

    setTimeout(() => {
      setRequests((prev) =>
        prev.map((r) => (r.id === reqId ? { ...r, status: "running_checks" } : r))
      );
    }, 3200);

    setTimeout(() => {
      const newVersion = (checkpoints[0]?.version || 17) + 1;
      const newCommit = Math.random().toString(16).substring(2, 9);

      const lower = instruction.toLowerCase();
      let diffCodeSnippet = {
        file: `${selectedTarget.source}`,
        oldCode: `// standard component configuration`,
        newCode: `// applied instruction: ${instruction}`,
      };

      if (lower.includes("green") || lower.includes("emerald")) {
        setPricingAccent("emerald");
        diffCodeSnippet = {
          file: "src/app/page.tsx",
          oldCode: `pricingAccent = "default"`,
          newCode: `pricingAccent = "emerald" /* applied green tint */`,
        };
      }

      const newCheckpoint: Checkpoint = {
        id: `cp_${Date.now()}`,
        sessionId: "session_hackathon_82k",
        version: newVersion,
        commit: newCommit,
        parentCommit: checkpoints[0]?.commit || "9f4a12b",
        requestId: reqId,
        authorId: "user_current",
        authorName,
        instruction,
        targetComponent: selectedTarget.component,
        filesChanged: 1,
        diffSummary: `Applied changes to ${selectedTarget.component} in ${selectedTarget.source}`,
        diffCode: [diffCodeSnippet],
        createdAt: new Date().toISOString(),
      };

      setCheckpoints((prev) => [newCheckpoint, ...prev]);
      setRequests((prev) =>
        prev.map((r) =>
          r.id === reqId ? { ...r, status: "applied", checkpointId: newCheckpoint.id } : r
        )
      );
      setBusyRequest(false);

      addToast(
        "Checkpoint Created",
        `Version v${newVersion} (${newCommit}) applied by Codex. Preview updated for all collaborators.`,
        "good"
      );
    }, 4500);
  };

  const handleRevertCheckpoint = (checkpointId: string) => {
    const targetCp = checkpoints.find((c) => c.id === checkpointId);
    if (!targetCp) return;

    const newVersion = (checkpoints[0]?.version || 17) + 1;
    const newCommit = Math.random().toString(16).substring(2, 9);

    setPricingAccent("default");

    const revertCheckpoint: Checkpoint = {
      id: `cp_rev_${Date.now()}`,
      sessionId: "session_hackathon_82k",
      version: newVersion,
      commit: newCommit,
      parentCommit: checkpoints[0]?.commit || "9f4a12b",
      requestId: `req_revert_${Date.now()}`,
      authorId: currentCollaborator?.displayName || "Alex Rivera",
      authorName: currentCollaborator?.displayName || "Alex Rivera",
      instruction: `Reverted checkpoint ${targetCp.commit}: "${targetCp.instruction}"`,
      targetComponent: targetCp.targetComponent,
      filesChanged: 1,
      diffSummary: `Reverted changes from ${targetCp.commit}`,
      createdAt: new Date().toISOString(),
      isRevert: true,
      revertedCheckpointId: checkpointId,
    };

    setCheckpoints((prev) => [revertCheckpoint, ...prev]);
    addToast(
      "Checkpoint Reverted",
      `New checkpoint v${newVersion} created to roll back state to v${targetCp.version - 1}.`,
      "info"
    );
  };

  const logoOptions: { id: LogoVariantType; name: string; tag: string }[] = [
    { id: "hyper_m_cube", name: "01. Hyper M-Cube", tag: "3D Isometric" },
    { id: "aperture_code_lens", name: "02. Iris Aperture", tag: "Shutter Lens" },
    { id: "duality_portal", name: "03. Duality Portal", tag: "Möbius Loop" },
    { id: "quantum_cursor", name: "04. Quantum Cursor", tag: "Orbital Focus" },
    { id: "isometric_stack", name: "05. Layer Stack", tag: "DOM to Git" },
    { id: "origami_prism", name: "06. Origami Prism", tag: "Light Facets" },
    { id: "neural_brackets", name: "07. Neural Code", tag: "Synaptic Brackets" },
    { id: "vortex_ring", name: "08. Vortex Ring", tag: "Fluid Aperture" },
    { id: "stepped_glyph", name: "09. Stepped Glyph", tag: "Bauhaus M" },
    { id: "orbit_ast", name: "10. Orbit AST", tag: "Atomic Tree" },
  ];

  return (
    <div className="relative min-h-screen bg-[#ffffff] text-[#191919]">
      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onDismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />

      {/* Global Element Inspector: allows inspecting & selecting ANY element */}
      <GlobalInspector
        isInspecting={isInspecting}
        selectedTarget={selectedTarget}
        onSelectTarget={handleSelectTarget}
      />

      {/* MetaEdit collaborator cursors in editor mode */}
      {isMetaEditMode && <PresenceOverlay collaborators={collaborators} />}

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
              <span className="size-2 rounded-full bg-primary animate-pulse" />
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
              Click anywhere on your live website to request changes. AI writes the code and commits directly to Git. MetaEdit stays hidden until you add the <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-[#305dde]/10 text-[#305dde] font-mono text-sm font-medium">metaedit.</span> subdomain.
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
                    <span className="text-[10px] text-[#8f8f8f] font-mono">Maya Chen</span>
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
                    <span className="font-mono text-[#059669] font-medium">commit 9f4a12b</span>
                    <span className="rounded-full bg-[#059669]/10 text-[#059669] text-[10px] font-medium px-2 py-0.5">v18</span>
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
                    Your code updates automatically in git.
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
                    <span>Instant Git commits & pull requests</span>
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
                q: "How does MetaEdit actually edit my codebase?",
                a: "When you click any element on your page, MetaEdit resolves its exact React component and source line in your repository. When you submit a change request, an AI agent writes clean code edits directly into your project files and commits them to Git in real time.",
              },
              {
                q: "Do regular visitors see the editor or cursors?",
                a: "No. Regular visitors browse your site normally. The editing tools, live cursors, and inspector overlays only appear when you visit your site via the metaedit. subdomain and authenticate with your workspace token.",
              },
              {
                q: "Does MetaEdit work with my existing Git repository?",
                a: "Yes. Every single edit creates a clean, linear Git commit with author attribution and diff records. You can inspect diffs, push branches, open pull requests, or roll back with a single click.",
              },
              {
                q: "What happens if two teammates edit the same element at once?",
                a: "MetaEdit uses automatic soft-locking. When someone selects or edits a component, their collaborator name and color appear on it, preventing accidental overlapping changes while keeping the rest of the page open for others to edit.",
              },
              {
                q: "Does MetaEdit add heavy JavaScript to my production site?",
                a: "None. The editing runtime and WebMCP server only load during active editing sessions. Your production bundle sent to public visitors remains 100% untouched and lightweight.",
              },
              {
                q: "Can I self-host MetaEdit on my own infrastructure?",
                a: "Yes. MetaEdit is built on open standards and WebMCP protocols. You can run the editing engine and session bridge locally, in Docker, or on your own private cloud servers.",
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

      {/* Access Token Gate Modal */}
      <AccessModal
        open={accessModalOpen}
        onClose={() => setAccessModalOpen(false)}
        onSuccess={handleAuthorizeSession}
      />

      {/* Floating Editor Pill in MetaEdit Mode — Contains the ONLY exit button */}
      {isMetaEditMode && (
        <EditorPill
          isInspecting={isInspecting}
          onToggleInspect={() => setIsInspecting(!isInspecting)}
          selectedTarget={selectedTarget}
          onClearTarget={() => setSelectedTarget(null)}
          onRequestChange={handleRequestChange}
          onToggleActivity={() => setActivityOpen(!activityOpen)}
          collaboratorCount={collaborators.length}
          activityCount={requests.filter((r) => r.status !== "applied").length}
          hasSoftLock={
            selectedTarget?.instanceId === "pricing-pro-row"
              ? { author: "Maya", color: "#8b5cf6" }
              : null
          }
          busy={busyRequest}
          onExitMetaEdit={handleExitMetaEdit}
        />
      )}

      {/* Activity & History Panel */}
      <ActivityPanel
        open={activityOpen}
        onClose={() => setActivityOpen(false)}
        requests={requests}
        checkpoints={checkpoints}
        onRevertCheckpoint={handleRevertCheckpoint}
        onPreviewCheckpoint={(cp) => {
          addToast("Previewing Checkpoint", `Viewing state from commit ${cp.commit}`, "info");
        }}
      />
    </div>
  );
}
