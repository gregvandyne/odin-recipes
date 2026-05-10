import { redirect } from "next/navigation";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { MessageSquare } from "lucide-react";
import { auth } from "@/lib/auth/config";
import { withTenant } from "@/lib/db/tenant-context";
import { decryptField, messageAad } from "@/lib/security/encryption";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

/**
 * Coordinator-side thread list. Pulls active threads where the current
 * coordinator is the assigned coordinator. Surfaces:
 *   - veteran display + week number
 *   - last-message preview (decrypted in tenant context)
 *   - last-message timestamp
 *   - unread dot when the last message is from the veteran and not yet
 *     marked read
 */
export default async function CoordinatorMessages() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const organizationId = (session?.user as { organizationId?: string } | undefined)
    ?.organizationId;
  const role = (session?.user as { role?: string } | undefined)?.role ?? "COORDINATOR";
  if (!userId || !organizationId) redirect("/auth/sign-in");

  const threads = await withTenant(
    { organizationId, userId, userRole: role, isOrgAdmin: false },
    async (tx) => {
      const rows = await tx.messageThread.findMany({
        where: {
          organizationId,
          coordinatorId: userId,
          status: { not: "ARCHIVED" },
        },
        orderBy: { lastMessageAt: "desc" },
        take: 50,
        select: {
          id: true,
          veteranId: true,
          lastMessageAt: true,
          veteran: { select: { displayName: true, email: true } },
          messages: {
            orderBy: { sentAt: "desc" },
            take: 1,
            select: {
              id: true,
              senderId: true,
              sentAt: true,
              readAt: true,
              bodyEncrypted: true,
            },
          },
        },
      });

      const veteranIds = rows.map((t) => t.veteranId);
      const profiles = veteranIds.length
        ? await tx.veteranProfile.findMany({
            where: { userId: { in: veteranIds } },
            select: { userId: true, programStartDate: true },
          })
        : [];
      const profileById = new Map(profiles.map((p) => [p.userId, p]));

      return rows.map((t) => {
        const last = t.messages[0];
        let preview: string | null = null;
        if (last) {
          try {
            preview = decryptField(
              last.bodyEncrypted,
              messageAad(organizationId, t.id, last.id),
            );
          } catch {
            preview = "(unable to decrypt)";
          }
        }
        const profile = profileById.get(t.veteranId);
        const week = profile
          ? Math.max(
              1,
              Math.floor(
                (Date.now() - profile.programStartDate.getTime()) /
                  (7 * 24 * 60 * 60 * 1000),
              ) + 1,
            )
          : null;
        return {
          id: t.id,
          veteranName: t.veteran.displayName ?? t.veteran.email,
          week,
          preview,
          lastAt: last?.sentAt ?? t.lastMessageAt ?? null,
          unread: !!last && last.senderId !== userId && !last.readAt,
        };
      });
    },
  );

  const unreadCount = threads.filter((t) => t.unread).length;

  return (
    <div className="space-y-6 px-6 py-6">
      <header>
        <p className="text-caption uppercase tracking-wide text-ink-tertiary">Messages</p>
        <h1 className="mt-1 text-display font-semibold text-ink-primary">Threads</h1>
        <p className="mt-2 text-body text-ink-secondary">
          {unreadCount} unread · {threads.length} active
        </p>
      </header>

      {threads.length === 0 ? (
        <EmptyState
          icon={<MessageSquare className="h-5 w-5" aria-hidden />}
          title="No threads yet."
          description="When a veteran in your caseload sends a message — or you start one from their timeline — it'll appear here."
        />
      ) : (
        <ul
          className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-canvas-card"
          role="list"
        >
          {threads.map((t) => {
            const initials = t.veteranName
              .split(/\s+/)
              .map((s) => s[0])
              .join("")
              .slice(0, 2)
              .toUpperCase();
            return (
              <li key={t.id}>
                <Link
                  href={`/coordinator/messages/${t.id}`}
                  className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-canvas-banded focus-visible:bg-canvas-banded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                >
                  <Avatar initials={initials} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-body font-semibold text-ink-primary">
                        {t.veteranName}
                      </span>
                      {t.week !== null && (
                        <Badge variant="outline" className="shrink-0">
                          Wk {t.week}
                        </Badge>
                      )}
                      {t.unread && (
                        <span
                          className="ml-auto h-2 w-2 shrink-0 rounded-full bg-primary"
                          aria-label="Unread"
                        />
                      )}
                    </div>
                    <p
                      className={`mt-0.5 line-clamp-1 text-caption ${
                        t.unread ? "font-semibold text-ink-primary" : "text-ink-secondary"
                      }`}
                    >
                      {t.preview ?? "No messages yet."}
                    </p>
                    <p className="mt-0.5 text-caption text-ink-tertiary">
                      {t.lastAt ? formatDistanceToNow(t.lastAt, { addSuffix: true }) : "—"}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
