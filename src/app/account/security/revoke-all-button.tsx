"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { confirm } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";

export function RevokeAllButton({ count }: { count: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function revoke() {
    const ok = await confirm({
      title: "Sign out of every device?",
      body:
        "This signs out every active session — including this one. You'll need to sign in again.",
      confirmLabel: "Sign out everywhere",
      tone: "destructive",
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch("/api/auth/sessions/revoke-all", { method: "POST" });
      if (res.ok) {
        const j = await res.json().catch(() => ({}));
        toast.success(`Signed out ${j.revoked ?? count} session${j.revoked === 1 ? "" : "s"}.`);
        router.push("/auth/sign-in");
      } else {
        toast.error("Couldn't sign out — try again.");
      }
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      type="button"
      onClick={revoke}
      disabled={busy || count === 0}
      className="rounded px-1 text-caption font-semibold text-crisis underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
    >
      {busy ? "Signing out…" : "Sign out everywhere"}
    </button>
  );
}
