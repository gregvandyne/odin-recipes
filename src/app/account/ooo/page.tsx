import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { withTenant } from "@/lib/db/tenant-context";
import { OooClient } from "./ooo-client";

/**
 * Out-of-office management for staff. Future blocks reroute notifications to
 * coverage if set; otherwise to the program manager.
 */
export default async function OooPage() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const organizationId = (session?.user as { organizationId?: string } | undefined)?.organizationId;
  const role = (session?.user as { role?: string } | undefined)?.role ?? "COORDINATOR";
  if (!userId || !organizationId) redirect("/auth/sign-in");

  const [blocks, peers] = await withTenant(
    { organizationId, userId, userRole: role, isOrgAdmin: false },
    async (tx) => {
      const blocks = await tx.coordinatorOOO.findMany({
        where: { coordinatorId: userId, endAt: { gte: new Date() } },
        orderBy: { startAt: "asc" },
      });
      const peers = await tx.user.findMany({
        where: {
          organizationId,
          role: "COORDINATOR",
          accountState: "ACTIVE",
          id: { not: userId },
        },
        select: { id: true, displayName: true, email: true },
        orderBy: { displayName: "asc" },
      });
      return [blocks, peers] as const;
    },
  );

  return (
    <div className="mx-auto max-w-2xl px-6 py-8 space-y-6">
      <header>
        <p className="text-caption uppercase tracking-wide text-ink-tertiary">Account</p>
        <h1 className="mt-2 text-display font-semibold text-ink-primary">Out of office</h1>
        <p className="mt-2 text-body text-ink-secondary">
          New flags during these blocks route to your coverage automatically.
        </p>
      </header>
      <OooClient
        initial={blocks.map((b) => ({
          id: b.id,
          startAt: b.startAt.toISOString(),
          endAt: b.endAt.toISOString(),
          coverageCoordinatorId: b.coverageCoordinatorId,
          autoReplyMessage: b.autoReplyMessage,
        }))}
        peers={peers.map((p) => ({
          id: p.id,
          name: p.displayName ?? p.email,
        }))}
      />
    </div>
  );
}
