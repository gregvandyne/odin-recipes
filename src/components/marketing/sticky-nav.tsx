"use client";

/**
 * Sticky marketing nav. Top-level layout choice:
 * - Always sticky at the top so the brand + sign-in are always reachable.
 * - Switches from translucent (over the hero) to a subtle backdrop-blurred
 *   bar with a hairline border once the user has scrolled past ~64px.
 * - Becomes a bottom sticky dock on mobile with the primary CTA always
 *   one tap away.
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
        "sticky top-0 z-40 transition-all duration-300",
        scrolled
          ? "border-b border-border bg-canvas-veteran/80 backdrop-blur-xl supports-[backdrop-filter]:bg-canvas-veteran/65"
          : "border-b border-transparent",
      ].join(" ")}
    >
      <div className="container flex h-14 max-w-6xl items-center justify-between px-6">
        <Link
          href="/"
          className="flex items-center gap-2 rounded text-body font-semibold text-ink-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span aria-hidden className="grid h-7 w-7 place-items-center rounded-md bg-ink-primary text-canvas-card">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M12 2L4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6l-8-4z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            </svg>
          </span>
          Sentinel
        </Link>
        <nav className="flex items-center gap-1 text-body">
          <Link
            href="#approach"
            className="hidden rounded px-3 py-2 text-ink-secondary hover:text-ink-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:inline-block"
          >
            Approach
          </Link>
          <Link
            href="#product"
            className="hidden rounded px-3 py-2 text-ink-secondary hover:text-ink-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:inline-block"
          >
            Product
          </Link>
          <Link
            href="#sources"
            className="hidden rounded px-3 py-2 text-ink-secondary hover:text-ink-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:inline-block"
          >
            Sources
          </Link>
          <ThemeToggle />
          <Link
            href="/auth/sign-in"
            className="inline-flex h-9 items-center gap-1 rounded-lg bg-ink-primary px-4 text-caption font-semibold text-canvas-card shadow-soft transition-all hover:shadow-warm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
