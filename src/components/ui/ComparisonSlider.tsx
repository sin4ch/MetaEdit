"use client";

import * as React from "react";
import { cn } from "@/lib/cn";
import {
  ArrowLeftRightIcon,
  FilterIcon,
  Activity01Icon,
  Target02Icon,
  Share05Icon,
  Link02Icon,
  ViewIcon,
  Clock01Icon,
  Delete02Icon,
  Logout03Icon,
  CursorPointer02Icon,
} from "hugeicons-react";

const BROWSER_CANVAS_WIDTH = 1104;
const SLIDER_HANDLE_VISIBLE_RADIUS = 17;

export function ComparisonSlider() {
  const [sliderPos, setSliderPos] = React.useState(35);
  const outerWrapperRef = React.useRef<HTMLDivElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const isDragging = React.useRef(false);
  const rafRef = React.useRef<number | null>(null);

  // Maximum allowed position of dragger to guarantee it never extends beyond the visible viewport
  const [maxVisiblePercent, setMaxVisiblePercent] = React.useState(100);

  const updateMaxVisible = () => {
    if (outerWrapperRef.current && containerRef.current) {
      const visibleWidth = outerWrapperRef.current.clientWidth;
      const totalWidth = BROWSER_CANVAS_WIDTH;
      const maxPct = visibleWidth < totalWidth
        ? ((visibleWidth - SLIDER_HANDLE_VISIBLE_RADIUS) / totalWidth) * 100
        : 98;
      const clampedMaxPct = Math.max(2, maxPct);
      setMaxVisiblePercent(clampedMaxPct);
      setSliderPos((prev) => Math.min(prev, clampedMaxPct));
    }
  };

  React.useEffect(() => {
    updateMaxVisible();
    const wrapper = outerWrapperRef.current;
    if (!wrapper) return;

    const observer = new ResizeObserver(updateMaxVisible);
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, []);

  const handleMove = (clientX: number) => {
    if (!containerRef.current) return;
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
    }
    rafRef.current = requestAnimationFrame(() => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      const rawPct = (x / rect.width) * 100;
      const clampedPct = Math.max(2, Math.min(maxVisiblePercent, rawPct));
      setSliderPos(clampedPct);
    });
  };

  React.useEffect(() => {
    const handleGlobalEnd = () => {
      isDragging.current = false;
    };
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isDragging.current) {
        handleMove(e.clientX);
      }
    };
    const handleGlobalTouchMove = (e: TouchEvent) => {
      if (isDragging.current && e.touches[0]) {
        handleMove(e.touches[0].clientX);
      }
    };

    window.addEventListener("mouseup", handleGlobalEnd);
    window.addEventListener("mousemove", handleGlobalMouseMove);
    window.addEventListener("touchend", handleGlobalEnd);
    window.addEventListener("touchmove", handleGlobalTouchMove, { passive: true });

    return () => {
      window.removeEventListener("mouseup", handleGlobalEnd);
      window.removeEventListener("mousemove", handleGlobalMouseMove);
      window.removeEventListener("touchend", handleGlobalEnd);
      window.removeEventListener("touchmove", handleGlobalTouchMove);
    };
  }, [maxVisiblePercent]);

  return (
    <div className="@container w-full flex flex-col items-center">
      {/* Outer Non-Scrollable Overflow Wrapper */}
      <div
        ref={outerWrapperRef}
        className="w-full overflow-hidden rounded-l-lg shadow-2xl @min-[1104px]:rounded-lg"
      >
        {/* Strictly fixed, non-responsive desktop browser canvas */}
        <div
          ref={containerRef}
          className="relative w-[1104px] h-[690px] rounded-lg border border-[#191919]/10 bg-[#ffffff] overflow-hidden select-none cursor-default"
        >
          {/* ========================================================================= */}
          {/* 1. BASE LAYER: REGULAR PUBLIC SITE (example.com) ON THE LEFT */}
          {/* ========================================================================= */}
          <div className="absolute inset-0 bg-[#ffffff] pointer-events-none overflow-hidden flex flex-col">
            {/* Top URL Bar: Public example.com */}
            <div className="h-11 border-b border-[#191919]/10 bg-[#f6f6f6] px-4 md:px-6 flex items-center justify-start gap-3 z-10 shrink-0">
              <div className="flex items-center gap-2 shrink-0">
                <div className="size-3 rounded-full bg-[#ff5f56]" />
                <div className="size-3 rounded-full bg-[#ffbd2e]" />
                <div className="size-3 rounded-full bg-[#27c93f]" />
              </div>

              {/* URL Box: Positioned close to traffic lights on mobile so address is visible */}
              <div className="h-7.5 w-60 md:w-88 rounded-md bg-white border border-[#191919]/10 px-3 flex items-center text-xs font-mono text-[#6e6e6e] shrink-0">
                <span className="text-[#8f8f8f]">https://</span>
                <span className="font-medium text-[#191919] ml-1">example.com</span>
              </div>
            </div>

            {/* Public Body Content: Identical 16:10 Desktop Layout */}
            <div className="flex-1 px-6 py-8 flex flex-col justify-between overflow-hidden">
              {/* Heading */}
              <div className="text-left max-w-2xl space-y-1">
                <h2 className="text-3xl font-medium text-[#191919] leading-tight">
                  Nothing here is an add-on, <br />
                  <span className="text-[#8f8f8f] font-normal">and none of it costs extra.</span>
                </h2>
              </div>

              {/* Fixed 3-column grid spanning the browser canvas */}
              <div className="w-full grid grid-cols-3 gap-5 text-left my-auto py-2">
                {/* Card 1: Funnels */}
                <div className="w-full rounded-xl bg-[#f6f6f6] p-5 flex flex-col justify-start items-start gap-2.5">
                  <div className="flex size-8 items-center justify-center rounded-full bg-white shadow-xs">
                    <FilterIcon className="size-4 text-[#0ea5e9]" />
                  </div>
                  <h3 className="text-sm font-medium text-[#0ea5e9]">Funnels</h3>
                  <p className="text-xs text-[#6e6e6e] leading-relaxed line-clamp-3">
                    Save the steps that matter and watch where people fall out of them, counted by visitor or by session.
                  </p>
                </div>

                {/* Card 2: Web vitals */}
                <div className="w-full rounded-xl bg-[#f6f6f6] p-5 flex flex-col justify-start items-start gap-2.5">
                  <div className="flex size-8 items-center justify-center rounded-full bg-white shadow-xs">
                    <Activity01Icon className="size-4 text-[#f97316]" />
                  </div>
                  <h3 className="text-sm font-medium text-[#f97316]">Web vitals</h3>
                  <p className="text-xs text-[#6e6e6e] leading-relaxed line-clamp-3">
                    LCP, INP, CLS and TTFB measured on real visits and split by device, so a slow phone never hides.
                  </p>
                </div>

                {/* Card 3: Custom events */}
                <div className="w-full rounded-xl bg-[#f6f6f6] p-5 flex flex-col justify-start items-start gap-2.5">
                  <div className="flex size-8 items-center justify-center rounded-full bg-white shadow-xs">
                    <Target02Icon className="size-4 text-[#a855f7]" />
                  </div>
                  <h3 className="text-sm font-medium text-[#a855f7]">Custom events</h3>
                  <p className="text-xs text-[#6e6e6e] leading-relaxed line-clamp-3">
                    Send anything you want counted (signups, plays, exports) and read them back broken down by value.
                  </p>
                </div>

                {/* Card 4: Visitor journeys */}
                <div className="w-full rounded-xl bg-[#f6f6f6] p-5 flex flex-col justify-start items-start gap-2.5">
                  <div className="flex size-8 items-center justify-center rounded-full bg-white shadow-xs">
                    <Share05Icon className="size-4 text-[#10b981]" />
                  </div>
                  <h3 className="text-sm font-medium text-[#10b981]">Visitor journeys</h3>
                  <p className="text-xs text-[#6e6e6e] leading-relaxed line-clamp-3">
                    Follow one anonymous visitor through every page of their session, in order, with full context.
                  </p>
                </div>

                {/* Card 5: Campaigns and UTMs */}
                <div className="w-full rounded-xl bg-[#f6f6f6] p-5 flex flex-col justify-start items-start gap-2.5">
                  <div className="flex size-8 items-center justify-center rounded-full bg-white shadow-xs">
                    <Link02Icon className="size-4 text-[#f43f5e]" />
                  </div>
                  <h3 className="text-sm font-medium text-[#f43f5e]">Campaigns and UTMs</h3>
                  <p className="text-xs text-[#6e6e6e] leading-relaxed line-clamp-3">
                    Referrers, campaigns, sources and mediums, each as its own cut, so tagged traffic never lands in Direct.
                  </p>
                </div>

                {/* Card 6: Public dashboards */}
                <div className="w-full rounded-xl bg-[#f6f6f6] p-5 flex flex-col justify-start items-start gap-2.5">
                  <div className="flex size-8 items-center justify-center rounded-full bg-white shadow-xs">
                    <ViewIcon className="size-4 text-[#6366f1]" />
                  </div>
                  <h3 className="text-sm font-medium text-[#6366f1]">Public dashboards</h3>
                  <p className="text-xs text-[#6e6e6e] leading-relaxed line-clamp-3">
                    Share a read-only board with a link that needs no account and no seat, and reaches nothing else.
                  </p>
                </div>
              </div>

              {/* Match the MetaEdit toolbar's flow height so both grids align */}
              <div className="h-[46px] shrink-0" />
            </div>
          </div>

          {/* ========================================================================= */}
          {/* 2. REVEAL LAYER: METAEDIT ACTIVATED (metaedit.example.com) ON THE RIGHT */}
          {/* CLIPPED FROM LEFT VIA clipPath: inset(0 0 0 ${sliderPos}%) */}
          {/* ========================================================================= */}
          <div
            style={{ clipPath: `inset(0 0 0 ${sliderPos}%)` }}
            className="absolute inset-0 bg-[#ffffff] pointer-events-none z-20 overflow-hidden flex flex-col will-change-[clip-path] transform-gpu translate-z-0 backface-hidden"
          >
            {/* Top URL Bar: metaedit.example.com */}
            <div className="h-11 border-b border-[#191919]/10 bg-[#f6f6f6] px-4 md:px-6 flex items-center justify-start gap-3 z-10 shrink-0">
              <div className="flex items-center gap-2 shrink-0">
                <div className="size-3 rounded-full bg-[#ff5f56]" />
                <div className="size-3 rounded-full bg-[#ffbd2e]" />
                <div className="size-3 rounded-full bg-[#27c93f]" />
              </div>

              {/* URL Box: Positioned close to traffic lights on mobile so subdomain is visible */}
              <div className="h-7.5 w-60 md:w-88 rounded-md bg-white border border-[#191919]/10 px-3 flex items-center text-xs font-mono text-[#6e6e6e] shrink-0">
                <span className="text-[#8f8f8f]">https://</span>
                <div className="flex items-center ml-1">
                  <span className="font-semibold text-[#305dde]">metaedit.</span>
                  <span className="font-medium text-[#191919]">example.com</span>
                </div>
              </div>
            </div>

            {/* MetaEdit Editing Body Content */}
            <div className="flex-1 px-6 py-8 flex flex-col justify-between relative overflow-hidden">
              {/* Heading */}
              <div className="text-left max-w-2xl space-y-1">
                <h2 className="text-3xl font-medium text-[#191919] leading-tight">
                  Nothing here is an add-on, <br />
                  <span className="text-[#8f8f8f] font-normal">and none of it costs extra.</span>
                </h2>
              </div>

              {/* Cards grid spanning the browser canvas */}
              <div className="w-full grid grid-cols-3 gap-5 relative text-left my-auto py-2">
                {/* Card 1: Funnels (ACTIVELY TARGETED ON THE LEFT EDGE) */}
                <div className="w-full relative rounded-xl bg-[#305dde]/5 p-5 flex flex-col justify-start items-start gap-2.5 shadow-sm ring-2 ring-inset ring-[#305dde]">
                  {/* Target AST Badge */}
                  <div className="absolute -top-3 left-3 bg-[#305dde] text-white px-2 py-0.5 rounded text-[10px] font-mono font-medium shadow-sm flex items-center gap-1 whitespace-nowrap">
                    <span>FunnelsCard.tsx</span>
                    <span className="opacity-75">#card-1</span>
                  </div>

                  <div className="flex size-8 items-center justify-center rounded-full bg-white shadow-xs">
                    <FilterIcon className="size-4 text-[#0ea5e9]" />
                  </div>
                  <h3 className="text-sm font-medium text-[#0ea5e9]">Funnels</h3>
                  <p className="text-xs text-[#6e6e6e] leading-relaxed line-clamp-3">
                    Save the steps that matter and watch where people fall out of them, counted by visitor or by session.
                  </p>

                  {/* Real In-App Annotation Popover positioned DIRECTLY BENEATH Card 1 */}
                  <div className="absolute top-[106%] left-0 z-50 w-[270px] rounded-lg bg-[#ffffff] border border-[#191919]/10 p-2.5 shadow-[0_12px_36px_rgba(0,0,0,0.14)] flex flex-col gap-2 text-left">
                    <div className="flex items-center justify-between text-xs px-1 pt-0.5">
                      <span className="font-medium text-[#191919]">FunnelsCard</span>
                      <span className="font-mono text-[10px] text-[#8f8f8f]">#card-1</span>
                    </div>
                    <div className="w-full bg-[#f6f6f6] rounded-md p-2 text-xs text-[#191919] font-normal leading-relaxed">
                      Add conversion threshold badge
                    </div>
                    <div className="flex items-center justify-between pt-0.5">
                      <button
                        type="button"
                        className="flex size-6 items-center justify-center rounded-full text-[#8f8f8f] hover:bg-[#f6f6f6] cursor-pointer"
                      >
                        <Delete02Icon className="size-3.5" />
                      </button>
                      <div className="flex items-center gap-1.5">
                        <span className="flex h-6.5 items-center justify-center rounded-full px-2.5 text-xs font-medium text-[#6e6e6e] bg-[#f6f6f6]">
                          Cancel
                        </span>
                        <span className="flex h-6.5 items-center justify-center rounded-full px-3 text-xs font-medium bg-[#191919] text-white shadow-sm">
                          Save
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Card 2: Web vitals */}
                <div className="w-full relative rounded-xl bg-[#f6f6f6] p-5 flex flex-col justify-start items-start gap-2.5 opacity-90">
                  <div className="flex size-8 items-center justify-center rounded-full bg-white shadow-xs">
                    <Activity01Icon className="size-4 text-[#f97316]" />
                  </div>
                  <h3 className="text-sm font-medium text-[#f97316]">Web vitals</h3>
                  <p className="text-xs text-[#6e6e6e] leading-relaxed line-clamp-3">
                    LCP, INP, CLS and TTFB measured on real visits and split by device, so a slow phone never hides.
                  </p>
                </div>

                {/* Card 3: Custom events */}
                <div className="w-full relative rounded-xl bg-[#f6f6f6] p-5 flex flex-col justify-start items-start gap-2.5">
                  <div className="flex size-8 items-center justify-center rounded-full bg-white shadow-xs">
                    <Target02Icon className="size-4 text-[#a855f7]" />
                  </div>
                  <h3 className="text-sm font-medium text-[#a855f7]">Custom events</h3>
                  <p className="text-xs text-[#6e6e6e] leading-relaxed line-clamp-3">
                    Send anything you want counted (signups, plays, exports) and read them back broken down by value.
                  </p>
                </div>

                {/* Card 4: Visitor journeys */}
                <div className="w-full relative rounded-xl bg-[#f6f6f6] p-5 flex flex-col justify-start items-start gap-2.5">
                  <div className="flex size-8 items-center justify-center rounded-full bg-white shadow-xs">
                    <Share05Icon className="size-4 text-[#10b981]" />
                  </div>
                  <h3 className="text-sm font-medium text-[#10b981]">Visitor journeys</h3>
                  <p className="text-xs text-[#6e6e6e] leading-relaxed line-clamp-3">
                    Follow one anonymous visitor through every page of their session, in order, with full context.
                  </p>
                </div>

                {/* Card 5: Campaigns and UTMs */}
                <div className="w-full relative rounded-xl bg-[#f6f6f6] p-5 flex flex-col justify-start items-start gap-2.5">
                  <div className="flex size-8 items-center justify-center rounded-full bg-white shadow-xs">
                    <Link02Icon className="size-4 text-[#f43f5e]" />
                  </div>
                  <h3 className="text-sm font-medium text-[#f43f5e]">Campaigns and UTMs</h3>
                  <p className="text-xs text-[#6e6e6e] leading-relaxed line-clamp-3">
                    Referrers, campaigns, sources and mediums, each as its own cut, so tagged traffic never lands in Direct.
                  </p>
                </div>

                {/* Card 6: Public dashboards */}
                <div className="w-full relative rounded-xl bg-[#f6f6f6] p-5 flex flex-col justify-start items-start gap-2.5">
                  <div className="flex size-8 items-center justify-center rounded-full bg-white shadow-xs">
                    <ViewIcon className="size-4 text-[#6366f1]" />
                  </div>
                  <h3 className="text-sm font-medium text-[#6366f1]">Public dashboards</h3>
                  <p className="text-xs text-[#6e6e6e] leading-relaxed line-clamp-3">
                    Share a read-only board with a link that needs no account and no seat, and reaches nothing else.
                  </p>
                </div>
              </div>

              {/* ========================================================================= */}
              {/* COLLABORATOR POINTERS */}
              {/* ========================================================================= */}

              {/* Maya Chen follows the visible right edge and reaches "here" at the narrow layout */}
              <div
                style={{
                  left: "clamp(132px, calc(88.784cqw - 186.734px), 72%)",
                  top: "clamp(8px, calc(17.944cqw - 56.418px), 22%)",
                }}
                className="absolute flex items-start gap-1.5 z-40 pointer-events-none"
              >
                <svg
                  className="size-5 drop-shadow-md -translate-x-0.5 -translate-y-0.5"
                  viewBox="0 0 24 24"
                  fill="#8b5cf6"
                  stroke="white"
                  strokeWidth="1.5"
                >
                  <path d="M5.653 4.295A1 1 0 004 5.12v13.76a1 1 0 001.653.825l3.963-3.303a1 1 0 01.64-.236h6.744a1 1 0 00.707-1.707L5.653 4.295z" />
                </svg>
                <div className="rounded-full bg-[#8b5cf6] px-3 py-1 text-xs font-medium text-white shadow-sm whitespace-nowrap">
                  Maya Chen
                </div>
              </div>

              {/* Alex Rivera follows the visible right edge and reaches the existing mobile position */}
              <div
                style={{
                  left: "clamp(160px, calc(70.234cqw - 92.138px), 62%)",
                  top: "clamp(68%, calc(544.734px - 9.675cqw), 510px)",
                }}
                className="absolute flex items-start gap-1.5 z-40 pointer-events-none"
              >
                <svg
                  className="size-5 drop-shadow-md -translate-x-0.5 -translate-y-0.5"
                  viewBox="0 0 24 24"
                  fill="#eab308"
                  stroke="white"
                  strokeWidth="1.5"
                >
                  <path d="M5.653 4.295A1 1 0 004 5.12v13.76a1 1 0 001.653.825l3.963-3.303a1 1 0 01.64-.236h6.744a1 1 0 00.707-1.707L5.653 4.295z" />
                </svg>
                <div className="rounded-full bg-[#eab308] px-3 py-1 text-xs font-medium text-[#191919] shadow-sm whitespace-nowrap">
                  Alex Rivera
                </div>
              </div>

              {/* Exact Live In-App Toolbar Pill: Centered across all viewports */}
              <div className="self-center mx-auto flex items-center gap-1 rounded-full border border-[#191919]/10 bg-[#ffffff]/95 backdrop-blur-xl p-1.5 shadow-[0_4px_24px_rgba(0,0,0,0.08)] z-30 select-none">
                {/* Active Inspecting Blue Pill */}
                <div className="flex h-8 items-center gap-1.5 rounded-full bg-[#305dde] px-3.5 text-xs font-medium text-white shadow-sm ring-2 ring-[#305dde]/30">
                  <CursorPointer02Icon className="size-3.5 shrink-0" />
                  <span>Inspecting (active)</span>
                </div>

                {/* Activity Pill */}
                <div className="flex h-8 items-center gap-1.5 rounded-full bg-[#f6f6f6] px-3 text-xs font-medium text-[#191919]">
                  <Clock01Icon className="size-3.5 text-[#8f8f8f] shrink-0" />
                  <span>Activity</span>
                </div>

                {/* Divider */}
                <div className="mx-1 h-4 w-px bg-[#191919]/10" />

                {/* 2 Online Badge */}
                <div className="flex items-center gap-1.5 px-2 text-xs text-[#8f8f8f] whitespace-nowrap">
                  <span className="size-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                  <span className="tabular-nums font-medium text-[#191919]">2</span>
                  <span>online</span>
                </div>

                {/* Divider */}
                <div className="mx-1 h-4 w-px bg-[#191919]/10" />

                {/* Exit Pill */}
                <div className="flex h-8 items-center gap-1 rounded-full px-3 text-xs font-medium text-[#8f8f8f]">
                  <Logout03Icon className="size-3.5 shrink-0" />
                  <span>Exit</span>
                </div>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* 3. INTERACTIVE SLIDER DIVIDER & HANDLE (Clamped to Visible Viewport Edge) */}
          {/* ========================================================================= */}
          <div
            style={{ left: `${sliderPos}%` }}
            className="absolute inset-y-0 -translate-x-1/2 flex items-center justify-center pointer-events-none z-30 will-change-[left] transform-gpu translate-z-0 backface-hidden"
          >
            {/* Vertical Divider Line */}
            <div className="h-full w-0.5 bg-[#305dde] shadow-[0_0_8px_rgba(48,93,222,0.5)]" />

            {/* Touch-Friendly Grab Area & Central Blue Dragger Pill Handle */}
            <div
              onMouseDown={(e) => {
                e.stopPropagation();
                isDragging.current = true;
              }}
              onTouchStart={(e) => {
                e.stopPropagation();
                isDragging.current = true;
              }}
              className="absolute -inset-y-0 -inset-x-6 flex items-center justify-center cursor-ew-resize pointer-events-auto touch-none"
            >
              <div className="flex size-7 items-center justify-center rounded-full bg-[#305dde] text-white shadow-[0_2px_10px_rgba(48,93,222,0.4)] ring-2 ring-white cursor-ew-resize">
                <ArrowLeftRightIcon className="size-3" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
