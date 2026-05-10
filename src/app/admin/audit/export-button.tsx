"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";

/**
 * Triggers /api/admin/audit/export and saves the NDJSON locally.
 *
 * The export endpoint is gated behind `requireMfa: true`. If the user
 * isn't MFA-fresh we get a 403 back; we surface that as a toast and
 * direct them to /auth/mfa with the audit page as the next destination.
 */
export function ExportAuditButton({
  from,
  to,
  action,
}: {
  from: string;
  to: string;
  action: string | null;
}) {
  const [busy, setBusy] = useState(false);

  async function exportNdjson() {
    setBusy(true);
    try {
      const params = new URLSearchParams();
      params.set("from", from);
      params.set("to", to);
      if (action) params.set("action", action);
      const res = await fetch(`/api/admin/audit/export?${params.toString()}`);
      if (res.status === 403) {
        const j = await res.json().catch(() => ({}));
        if (j.error === "mfa_required") {
          toast.message("Verify with MFA to export.");
          window.location.href = "/auth/mfa?next=" + encodeURIComponent(window.location.pathname + window.location.search);
          return;
        }
        toast.error("Forbidden.");
        return;
      }
      if (!res.ok) {
        toast.error("Couldn't export — try again.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-${Date.now()}.ndjson`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Export complete.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button variant="secondary" onClick={exportNdjson} disabled={busy}>
      {busy ? (
        <>
          <Spinner size={16} /> Exporting…
        </>
      ) : (
        <>
          <Download className="h-4 w-4" aria-hidden /> Export NDJSON
        </>
      )}
    </Button>
  );
}
