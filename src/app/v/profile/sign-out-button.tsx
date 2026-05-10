"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { confirm } from "@/components/ui/confirm-dialog";
import { Spinner } from "@/components/ui/spinner";

export function SignOutButton() {
  const [busy, setBusy] = useState(false);

  async function handle() {
    const ok = await confirm({
      title: "Sign out?",
      body: "You'll need to use your sign-in link again next time.",
      confirmLabel: "Sign out",
    });
    if (!ok) return;
    setBusy(true);
    try {
      await signOut({ callbackUrl: "/auth/sign-in" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      variant="secondary"
      size="lg"
      className="w-full justify-center"
      onClick={handle}
      disabled={busy}
    >
      {busy ? (
        <>
          <Spinner size={16} /> Signing out…
        </>
      ) : (
        <>
          <LogOut className="h-4 w-4" aria-hidden /> Sign out
        </>
      )}
    </Button>
  );
}
