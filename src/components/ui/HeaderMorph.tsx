"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

export function HeaderMorph({
  threshold = 8,
  stickyTop = "top-3 sm:top-4",
  children,
  className,
}: {
  threshold?: number;
  stickyTop?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [scrolled, setScrolled] = React.useState(false);

  React.useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          setScrolled(window.scrollY > threshold);
          ticking = false;
        });
        ticking = true;
      }
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  return (
    <header
      data-scrolled={scrolled}
      className={cn(
        "group sticky z-50 w-full flex justify-center px-4 will-change-[transform,opacity] transform-gpu translate-z-0 backface-hidden",
        stickyTop,
        className
      )}
    >
      <div
        className={cn(
          "relative flex h-14 w-full max-w-5xl items-center justify-between rounded-full px-4 border border-transparent",
          // Hardware-accelerated transitions
          "will-change-[max-width,height,padding,background-color,border-color,box-shadow,backdrop-filter,transform]",
          "transform-gpu translate-z-0 backface-hidden",
          "transition-[max-width,height,padding,background-color,border-color,box-shadow,backdrop-filter] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
          // The morphing glass pill on scroll
          "group-data-[scrolled=true]:h-12 group-data-[scrolled=true]:max-w-3xl",
          "group-data-[scrolled=true]:border-[#8f8f8f]/30 group-data-[scrolled=true]:bg-white/90",
          "group-data-[scrolled=true]:p-2",
          "group-data-[scrolled=true]:backdrop-blur-xl group-data-[scrolled=true]:backdrop-saturate-125",
          "group-data-[scrolled=true]:shadow-[inset_0_1px_0_rgba(255,255,255,0.7),inset_0_-1px_0_rgba(0,0,0,0.05),0_1px_2px_rgba(0,0,0,0.06),0_8px_24px_rgba(0,0,0,0.08)]"
        )}
      >
        {children}
      </div>
    </header>
  );
}
