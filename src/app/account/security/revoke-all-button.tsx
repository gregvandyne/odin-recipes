"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function RevokeAllButton({ count }: { count: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function revoke() {
    if (!confirm("Sign out everywhere, including this device?")) return;
    setBusy(true);
    try {
      await fetch("/api/auth/sessions/revoke-all", { method: "POST" });
      router.push("/auth/sign-in");
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      type="button"
      onClick={revoke}
      disabled={busy || count === 0}
      className="text-caption text-crisis hover:underline disabled:opacity-50"
    >
      {busy ? "Signing out…" : "Sign out everywhere"}
    </button>
  );
}
