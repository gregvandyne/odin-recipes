"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const current = (resolvedTheme ?? theme) === "dark" ? "dark" : "light";

  return (
    <button
      type="button"
      aria-label={`Switch to ${current === "dark" ? "light" : "dark"} mode`}
      onClick={() => setTheme(current === "dark" ? "light" : "dark")}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-canvas-card text-ink-secondary hover:text-ink-primary ${className ?? ""}`}
    >
      {mounted ? (current === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />) : <Moon className="h-4 w-4" />}
    </button>
  );
}
