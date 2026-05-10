import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { auth } from "@/lib/auth/config";
import { withTenant } from "@/lib/db/tenant-context";
import { decryptField, messageAad } from "@/lib/security/encryption";
import { currentWeekNumber } from "@/lib/program/week";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { RiskBadge } from "@/components/sentinel/risk-badge";
import type { RiskLevel } from "@/lib/risk/types";
import { CoordinatorThreadClient } from "./thread-client";

/**
 * Coordinator thread page. Server-rendered:
 *   - Authorize: caller must be the assigned coordinator (or PM).
 *   - Load thread + last 50 messages, decrypt server-side under tenant
 *     context, hand to the client component.
 *   - Display veteran header info (name, week, current risk, latest
 *     unresolved-flag summary) so the coordinator has context above the
 *     conversation.
 */
export default async function CoordinatorThread({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const organizationId = (session?.user as { organizationId?: string } | undefined)
    ?.organizationId;
  const role = (session?.user as { role?: string } | undefined)?.role ?? "COORDINATOR";
  if (!userId || !organizationId) redirect("/auth/sign-in");

  const data = await withTenant(
    { organizationId, userId, userRole: role, isOrgAdmin: false },
    async (tx) => {
      const thread = await tx.messageThread.findUnique({
        where: { id: params.id },
        select: {
          id: true,
          organizationId: true,
          veteranId: true,
          coordinatorId: true,
          status: true,
          veteran: { select: { displayName: true, email: true } },
        },
      });
      if (!thread || thread.organizationId !== organizationId) return null;
      const isParticipant =
        thread.coordinatorId === userId || role === "PROGRAM_MANAGER";
      if (!isParticipant) return null;

      const [messages, profile, latestFlag] = await Promise.all([
        tx.message.findMany({
          where: { threadId: thread.id },
          orderBy: { sentAt: "asc" },
          take: 50,
          select: {
            id: true,
            senderId: true,
            sentAt: true,
            readAt: true,
            aiAssistedDraft: true,
            bodyEncrypted: true,
          },
        }),
        tx.veteranProfile.findUnique({
          where: { userId: thread.veteranId },
          select: {
            programStartDate: true,
            cohort: { select: { name: true } },
          },
        }),
        tx.flag.findFirst({
          where: { veteranId: thread.veteranId, resolvedAt: null },
          orderBy: [{ severity: "desc" }, { createdAt: "desc" }],
          select: { severity: true, explanation: true },
        }),
      ]);

      const decoded = messages.map((m) => {
        let body = "";
        try {
          body = decryptField(m.bodyEncrypted, messageAad(organizationId, thread.id, m.id));
        } catch {
          body = "[unable to decrypt]";
        }
        return {
          id: m.id,
          body,
          sentAt: m.sentAt.toISOString(),
          fromSelf: m.senderId === userId,
          read: !!m.readAt,
          aiAssisted: m.aiAssistedDraft,
        };
      });

      const week = profile ? currentWeekNumber(profile.programStartDate) : null;

      return {
        threadId: thread.id,
        veteranId: thread.veteranId,
        veteranName: thread.veteran.displayName ?? thread.veteran.email,
        cohortName: profile?.cohort.name ?? null,
        week,
        latestFlag: latestFlag
          ? { severity: latestFlag.severity as RiskLevel, summary: latestFlag.explanation }
          : null,
        archived: thread.status === "ARCHIVED",
        messages: decoded,
      };
    },
  );

  if (!data) notFound();

  const initials = data.veteranName
    .split(/\s+/)
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col [@supports(height:100dvh)]:h-[calc(100dvh-3rem)]">
      <header className="flex items-center gap-3 border-b border-border bg-canvas-card px-4 py-3">
        <Link
          href="/coordinator/messages"
          className="grid h-8 w-8 place-items-center rounded-md text-ink-tertiary hover:bg-canvas-banded hover:text-ink-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Back to threads"
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
        <Avatar initials={initials} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Link
              href={`/coordinator/veteran/${data.veteranId}`}
              className="truncate text-body font-semibold text-ink-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
            >
              {data.veteranName}
            </Link>
            {data.week !== null && <Badge variant="outline">Wk {data.week}</Badge>}
            {data.latestFlag && <RiskBadge level={data.latestFlag.severity} size="sm" />}
            {data.archived && <Badge variant="outline">Archived</Badge>}
          </div>
          {data.latestFlag && (
            <div className="line-clamp-1 text-caption text-ink-tertiary">
              {data.latestFlag.summary}
            </div>
          )}
        </div>
      </header>
      <CoordinatorThreadClient
        threadId={data.threadId}
        currentUserId={userId}
        initialMessages={data.messages}
      />
    </div>
  );
}
