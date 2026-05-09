"use client";

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

/**
 * "Add to Home Screen" prompt.
 *
 * Calm, dismissible. Stored opt-out in localStorage so dismissal sticks.
 * On iOS where beforeinstallprompt isn't available, shows a static hint
 * with the Share-button instruction.
 */
export function InstallPrompt() {
  const [evt, setEvt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(true);
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(localStorage.getItem("sentinel-install-dismissed") === "1");
    const ua = window.navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(ua) && !("standalone" in window.navigator && (window.navigator as { standalone?: boolean }).standalone);
    setIsIos(ios);
    const handler = (e: Event) => {
      e.preventDefault();
      setEvt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (dismissed) return null;
  if (!evt && !isIos) return null;

  function dismiss() {
    setDismissed(true);
    if (typeof window !== "undefined") {
      localStorage.setItem("sentinel-install-dismissed", "1");
    }
  }

  return (
    <div className="mx-4 mt-4 flex items-start gap-3 rounded-md border border-border bg-canvas-card p-3 shadow-soft">
      <Download className="mt-0.5 h-4 w-4 shrink-0 text-ink-secondary" aria-hidden />
      <div className="flex-1 text-body text-ink-primary">
        {isIos ? (
          <>
            Add Sentinel to your home screen. Tap <span className="font-semibold">Share</span>, then{" "}
            <span className="font-semibold">Add to Home Screen</span>.
          </>
        ) : (
          <>
            Install Sentinel on this device. Quick, no app store.
            <button
              type="button"
              onClick={async () => {
                if (!evt) return;
                await evt.prompt();
                await evt.userChoice;
                dismiss();
              }}
              className="ml-2 font-semibold text-primary underline-offset-2 hover:underline"
            >
              Install
            </button>
          </>
        )}
      </div>
      <button type="button" onClick={dismiss} aria-label="Dismiss" className="rounded p-1 text-ink-tertiary hover:text-ink-primary">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
