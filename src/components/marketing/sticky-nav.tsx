"use client";

/**
 * Sticky marketing nav — premium, minimal design.
 * - Always sticky at the top so the brand + sign-in are always reachable.
 * - Switches from translucent to a subtle backdrop-blurred bar with a hairline
 *   border once the user has scrolled past ~32px.
 */

import Link from "next/link";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/sentinel/theme-toggle";

export function StickyNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 32);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={[
        "sticky top-0 z-40 transition-all duration-500 ease-out",
        scrolled
          ? "border-b border-border/60 bg-canvas-veteran/85 backdrop-blur-xl supports-[backdrop-filter]:bg-canvas-veteran/70"
          : "border-b border-transparent bg-transparent",
      ].join(" ")}
    >
      <div className="container flex h-16 max-w-6xl items-center justify-between px-6">
        <Link
          href="/"
          className="flex items-center gap-2.5 rounded text-[17px] font-semibold text-ink-primary transition-colors hover:text-ink-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span aria-hidden className="grid h-8 w-8 place-items-center rounded-lg bg-ink-primary text-canvas-card shadow-soft">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M12 2L4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6l-8-4z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            </svg>
          </span>
          Sentinel
        </Link>
        <nav className="flex items-center gap-1">
          <Link
            href="#approach"
            className="hidden rounded-lg px-3.5 py-2 text-[15px] font-medium text-ink-secondary transition-colors hover:bg-canvas-card/60 hover:text-ink-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:inline-block"
          >
            Approach
          </Link>
          <Link
            href="#product"
            className="hidden rounded-lg px-3.5 py-2 text-[15px] font-medium text-ink-secondary transition-colors hover:bg-canvas-card/60 hover:text-ink-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:inline-block"
          >
            Product
          </Link>
          <Link
            href="#sources"
            className="hidden rounded-lg px-3.5 py-2 text-[15px] font-medium text-ink-secondary transition-colors hover:bg-canvas-card/60 hover:text-ink-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:inline-block"
          >
            Sources
          </Link>
          <div className="ml-1">
            <ThemeToggle />
          </div>
          <Link
            href="/auth/sign-in"
            className="ml-2 inline-flex h-10 items-center gap-1.5 rounded-xl bg-ink-primary px-5 text-[15px] font-semibold text-canvas-card shadow-soft transition-all hover:shadow-warm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            Sign in
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function MobileBottomDock() {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-canvas-veteran/85 backdrop-blur-xl sm:hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <Link
          href="/auth/sign-in"
          className="inline-flex h-11 flex-1 items-center justify-center rounded-lg bg-primary text-body font-semibold text-primary-foreground shadow-warm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Sign in
        </Link>
        <Link
          href="#approach"
          className="inline-flex h-11 items-center justify-center rounded-lg border border-border bg-canvas-card px-5 text-caption font-semibold text-ink-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          How it works
        </Link>
      </div>
    </div>
  );
}
