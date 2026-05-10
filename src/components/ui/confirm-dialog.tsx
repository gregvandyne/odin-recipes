"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog";
import { Button } from "./button";

/**
 * Promise-based confirm dialog.
 *
 * Replaces every `window.confirm(...)` in the app — those bring up the
 * browser-native dialog which (a) breaks the calm visual language of the
 * design system and (b) is inaccessible in iOS PWAs in some configurations.
 *
 * Usage:
 *   const ok = await confirm({ title, body, confirmLabel, tone: "destructive" });
 *   if (!ok) return;
 *
 * The dialog focuses the cancel button by default so a stray Enter doesn't
 * commit a destructive action. Tone "destructive" colors the confirm button
 * with the crisis token. Pressing Escape resolves to false.
 */

interface ConfirmOptions {
  title: string;
  body?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "primary" | "destructive";
  /** When true, the confirm button is the default focus target. Off by default. */
  defaultFocusConfirm?: boolean;
}

interface ResolverState extends ConfirmOptions {
  open: boolean;
  resolve?: (ok: boolean) => void;
}

let setState: ((state: ResolverState) => void) | null = null;
let lastFocused: HTMLElement | null = null;

export function ConfirmDialogHost() {
  const [state, set] = React.useState<ResolverState>({ open: false, title: "" });
  React.useEffect(() => {
    setState = set;
    return () => {
      if (setState === set) setState = null;
    };
  }, []);

  function close(ok: boolean) {
    state.resolve?.(ok);
    set((s) => ({ ...s, open: false }));
    // Restore focus on close. Defer one frame so Radix has a chance to
    // remove its inert attributes first.
    requestAnimationFrame(() => {
      lastFocused?.focus?.();
      lastFocused = null;
    });
  }

  const tone = state.tone ?? "primary";
  return (
    <Dialog
      open={state.open}
      onOpenChange={(open) => {
        if (!open) close(false);
      }}
    >
      <DialogContent
        className="max-w-sm"
        onOpenAutoFocus={(e) => {
          if (!state.defaultFocusConfirm) {
            e.preventDefault();
            // Focus the cancel button explicitly. The DialogContent ref isn't
            // exposed, so look it up by data-attribute.
            requestAnimationFrame(() => {
              document
                .querySelector<HTMLButtonElement>('[data-confirm-cancel="true"]')
                ?.focus();
            });
          }
        }}
      >
        <DialogHeader>
          <DialogTitle>{state.title}</DialogTitle>
          {state.body && <DialogDescription>{state.body}</DialogDescription>}
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => close(false)}
            data-confirm-cancel="true"
          >
            {state.cancelLabel ?? "Cancel"}
          </Button>
          <Button
            variant={tone === "destructive" ? "crisis" : "primary"}
            onClick={() => close(true)}
          >
            {state.confirmLabel ?? "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Show a confirm dialog. Returns a promise that resolves true (confirmed)
 * or false (cancelled / escape / overlay click).
 *
 * If the host hasn't been mounted yet (e.g. during SSR or before hydration),
 * the call falls back to a resolved-true so server-side render paths can
 * still guard their actions during tests.
 */
export function confirm(options: ConfirmOptions): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (!setState) {
    // No host mounted — surface a console warning and resolve true so the
    // caller's "are you sure?" branch fires without breaking the action.
    if (process.env.NODE_ENV !== "production") {
      console.warn("ConfirmDialogHost is not mounted; falling back to true.");
    }
    return Promise.resolve(true);
  }
  // Capture the currently focused element so we can restore on close.
  lastFocused = (document.activeElement as HTMLElement) ?? null;
  return new Promise<boolean>((resolve) => {
    setState!({ ...options, open: true, resolve });
  });
}
