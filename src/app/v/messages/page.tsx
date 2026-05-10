import { redirect } from "next/navigation";
import { Phone } from "lucide-react";
import { auth } from "@/lib/auth/config";
import { withTenant } from "@/lib/db/tenant-context";
import { decryptField, messageAad } from "@/lib/security/encryption";
import { ensureMessageThread } from "@/lib/messaging/ensure-thread";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/empty-state";
import { MessageThreadClient } from "./thread-client";

/**
 * Veteran messaging — single thread with assigned coordinator.
 *
 * Server component: ensures the thread exists, decrypts the last 50
 * messages in tenant context, hands them to the client component for
 * rendering + composing. If the veteran has no assigned coordinator yet
 * (e.g. just accepted), we render a calm empty state instead of forcing
 * thread creation.
 */
export default async function VeteranMessages() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const organizationId = (session?.user as { organizationId?: string } | undefined)
    ?.organizationId;
  if (!userId || !organizationId) redirect("/auth/sign-in");

  const data = await withTenant(
    { organizationId, userId, userRole: "VETERAN", isOrgAdmin: false },
    async (tx) => {
      const profile = await tx.veteranProfile.findUnique({
        where: { userId },
        select: { assignedCoordinatorId: true },
      });
      if (!profile?.assignedCoordinatorId) {
        return { kind: "no-coordinator" as const };
      }
      const coordinator = await tx.user.findUnique({
        where: { id: profile.assignedCoordinatorId },
        select: { id: true, displayName: true, email: true },
      });
      if (!coordinator) return { kind: "no-coordinator" as const };

      const thread = await ensureMessageThread(
        tx,
        organizationId,
        userId,
        profile.assignedCoordinatorId,
      );

      const messages = await tx.message.findMany({
        where: { threadId: thread.id },
        orderBy: { sentAt: "asc" },
        take: 50,
        select: {
          id: true,
          senderId: true,
          sentAt: true,
          readAt: true,
          bodyEncrypted: true,
        },
      });

      const decoded = messages.map((m) => {
        let body = "";
        try {
          body = decryptField(m.bodyEncrypted, messageAad(organizationId, thread.id, m.id));
        } catch {
          body = "[unable to decrypt this message]";
        }
        return {
          id: m.id,
          body,
          sentAt: m.sentAt.toISOString(),
          fromSelf: m.senderId === userId,
          read: !!m.readAt,
        };
      });

      return {
        kind: "ok" as const,
        threadId: thread.id,
        coordinatorName: coordinator.displayName ?? coordinator.email,
        messages: decoded,
      };
    },
  );

  if (data.kind === "no-coordinator") {
    return (
      <EmptyState
        icon={<Phone className="h-5 w-5" aria-hidden />}
        title="No coordinator assigned yet."
        description="Once your coordinator is assigned, you'll be able to message them here. In a crisis, call 988 and press 1."
      />
    );
  }

  const initials = data.coordinatorName
    .split(/\s+/)
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="-mx-6 -my-6 flex h-[calc(100dvh-8rem)] flex-col">
      <header className="sticky top-0 z-10 border-b border-border bg-canvas-card px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar initials={initials} size="md" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-body font-semibold text-ink-primary">
              {data.coordinatorName}
            </div>
            <div className="flex items-center gap-1.5 text-caption text-ink-tertiary">
              <span className="h-1.5 w-1.5 rounded-full bg-risk-green" aria-hidden />
              Usually replies within 4 hours
            </div>
          </div>
        </div>
      </header>
      <MessageThreadClient threadId={data.threadId} initialMessages={data.messages} />
    </div>
  );
}
