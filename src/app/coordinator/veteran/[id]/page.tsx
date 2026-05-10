import { redirect } from "next/navigation";
import { DomainSparkline } from "@/components/sentinel/domain-sparkline";
import { RiskBadge } from "@/components/sentinel/risk-badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { DomainCode, RiskLevel, CheckInRecord, CheckInResponse } from "@/lib/risk/types";
import { DOMAIN_CODES } from "@/lib/risk/types";
import { computeDomainScores, score as scoreFn } from "@/lib/risk/engine";
import { AlertTriangle, AlertCircle, Sparkles, MessageCircleWarning } from "lucide-react";
import { auth } from "@/lib/auth/config";
import { withTenant } from "@/lib/db/tenant-context";
import { currentWeekNumber } from "@/lib/program/week";
import { ActionPanel } from "./action-panel";

interface PageProps { params: { id: string } }

const ACTION_BY_LEVEL: Record<RiskLevel, { label: string; deadline: string }> = {
  RED: { label: "Immediate action", deadline: "1 hour" },
  ORANGE: { label: "Outreach within 24h", deadline: "24 hours" },
  YELLOW: { label: "Note and follow", deadline: "48 hours" },
  GREEN: { label: "Routine", deadline: "—" },
};

export default async function VeteranTimelinePage({ params }: PageProps) {
  const session = await auth();
  const orgId = (session?.user as { organizationId?: string } | undefined)?.organizationId;
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const role = (session?.user as { role?: string } | undefined)?.role ?? "COORDINATOR";
  if (!orgId || !userId) redirect("/auth/sign-in");
  if (role === "VETERAN") redirect("/v");

  const data = await withTenant(
    { organizationId: orgId, userId, userRole: role, isOrgAdmin: false },
    async (tx) => {
      const profile = await tx.veteranProfile.findUnique({
        where: { userId: params.id },
        select: {
          userId: true,
          branchOfService: true,
          programStartDate: true,
          timezone: true,
          assignedCoordinatorId: true,
          cohort: { select: { name: true } },
          user: { select: { displayName: true, email: true } },
        },
      });
      if (!profile) return null;

      const checkIns = await tx.checkIn.findMany({
        where: { veteranId: params.id },
        orderBy: { submittedAt: "desc" },
        take: 12,
        select: {
          id: true,
          weekNumber: true,
          submittedAt: true,
          responses: true,
          riskLevel: true,
          aiPending: true,
          aiAnalysisFailedAt: true,
          aiAnalysisFailureReason: true,
        },
      });

      const flags = await tx.flag.findMany({
        where: { veteranId: params.id, resolvedAt: null },
        orderBy: { createdAt: "desc" },
        take: 12,
        select: {
          id: true,
          severity: true,
          explanation: true,
          domainsInvolved: true,
          createdAt: true,
          acknowledgedAt: true,
          severityOverrideAt: true,
        },
      });

      const contacts = await tx.contact.findMany({
        where: { veteranId: params.id },
        orderBy: { createdAt: "desc" },
        take: 12,
        select: {
          id: true,
          contactType: true,
          direction: true,
          createdAt: true,
          followUpRequired: true,
          followUpBy: true,
          coordinator: { select: { displayName: true, email: true } },
        },
      });

      const feedback = await tx.checkInFeedback.findMany({
        where: { veteranId: params.id, acknowledgedAt: null },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: { id: true, createdAt: true, body: true, checkInId: true },
      });

      const coordinator = profile.assignedCoordinatorId
        ? await tx.user.findUnique({
            where: { id: profile.assignedCoordinatorId },
            select: { displayName: true, email: true },
          })
        : null;

      // Latest check-in's open thread (if any) — used for the "Send message" button.
      const thread = await tx.messageThread.findFirst({
        where: { veteranId: params.id, coordinatorId: userId },
        select: { id: true },
      });

      return { profile, checkIns, flags, contacts, feedback, coordinator, threadId: thread?.id ?? null };
    },
  );

  if (!data) redirect("/coordinator");

  const veteranName = data.profile.user.displayName ?? data.profile.user.email;
  const initials = veteranName
    .split(/\s+/)
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const week = currentWeekNumber(data.profile.programStartDate, new Date(), data.profile.timezone);
  const topFlag = data.flags[0];
  const overallRisk: RiskLevel = topFlag?.severity ?? data.checkIns[0]?.riskLevel ?? "GREEN";
  const action = ACTION_BY_LEVEL[overallRisk];

  // Domain sparklines from real check-ins (oldest → newest for the chart).
  const ordered = data.checkIns.slice().reverse();
  const sparklines: { domain: DomainCode; values: (number | null)[] }[] = DOMAIN_CODES.map((d) => ({
    domain: d,
    values: ordered.map((c) => {
      const record: CheckInRecord = {
        id: c.id,
        weekNumber: c.weekNumber,
        submittedAt: c.submittedAt,
        responses: (c.responses as unknown as CheckInResponse[]) ?? [],
        openEndedResponse: null,
      };
      const ds = computeDomainScores(record).find((x) => x.domain === d);
      if (!ds || ds.responseCount === 0) return null;
      return Math.round(ds.score);
    }),
  }));

  // Build a unified activity timeline (check-ins + contacts + flags) ordered
  // newest first.
  const activity = [
    ...data.checkIns.map((c) => ({
      kind: "checkin" as const,
      time: c.submittedAt,
      week: c.weekNumber,
      riskLevel: c.riskLevel,
      summary:
        c.riskLevel === "GREEN"
          ? "Stable check-in across domains."
          : `Check-in submitted${c.riskLevel ? ` (${c.riskLevel})` : ""}.`,
    })),
    ...data.contacts.map((k) => ({
      kind: "contact" as const,
      time: k.createdAt,
      week: 0,
      riskLevel: null as RiskLevel | null,
      summary: `${k.coordinator.displayName ?? "Coordinator"} — ${k.contactType.replace(/_/g, " ").toLowerCase()} (${k.direction.toLowerCase()})${k.followUpRequired ? " · follow-up required" : ""}.`,
    })),
    ...data.flags.map((f) => ({
      kind: "flag" as const,
      time: f.createdAt,
      week: 0,
      riskLevel: f.severity,
      summary: f.explanation,
    })),
  ]
    .sort((a, b) => b.time.getTime() - a.time.getTime())
    .slice(0, 20);

  const aiFailed = data.checkIns.filter((c) => c.aiAnalysisFailedAt);
  const aiPending = data.checkIns.filter((c) => c.aiPending);

  return (
    <div className="px-6 py-6">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Avatar initials={initials} size="lg" />
          <div>
            <p className="text-caption text-ink-tertiary">
              {data.profile.branchOfService} · Week {week} · Coord{" "}
              {data.coordinator?.displayName ?? data.coordinator?.email ?? "Unassigned"}
            </p>
            <h1 className="mt-1 text-display font-semibold text-ink-primary">{veteranName}</h1>
            <div className="mt-2 flex items-center gap-2">
              <Badge>52-week program</Badge>
              <Badge variant="outline">Cohort: {data.profile.cohort.name}</Badge>
            </div>
          </div>
        </div>
        <RiskBadge level={overallRisk} />
      </header>

      {(aiFailed.length > 0 || aiPending.length > 0) && (
        <div className="mb-4 space-y-2">
          {aiFailed.map((c) => (
            <div
              key={c.id}
              className="flex items-start gap-3 rounded-md border border-risk-orange/40 bg-risk-orange/5 p-4 text-body"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-risk-orange" aria-hidden />
              <div>
                <p className="font-semibold text-ink-primary">
                  Language analysis unavailable for week {c.weekNumber}
                </p>
                <p className="mt-0.5 text-ink-secondary">
                  Review the open-ended response manually.
                  {c.aiAnalysisFailureReason ? ` (${c.aiAnalysisFailureReason})` : ""}
                </p>
              </div>
            </div>
          ))}
          {aiPending.map((c) => (
            <div
              key={c.id}
              className="flex items-start gap-3 rounded-md border border-border bg-canvas-banded p-4 text-body"
            >
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-ink-tertiary" aria-hidden />
              <div>
                <p className="font-semibold text-ink-primary">
                  Layer-4 analysis pending for week {c.weekNumber}
                </p>
                <p className="mt-0.5 text-ink-secondary">
                  Risk score will refresh automatically when analysis completes.
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {data.feedback.length > 0 && (
        <Card className="mb-4 border-primary/30 bg-primary/5">
          <CardHeader>
            <div className="flex items-start gap-3">
              <MessageCircleWarning className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
              <div>
                <CardTitle className="text-body-lg">Veteran adds context</CardTitle>
                <CardDescription className="mt-1">
                  This veteran disagrees with how a recent check-in was interpreted. Acknowledge it
                  before next outreach.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.feedback.map((f) => (
              <blockquote
                key={f.id}
                className="border-l-2 border-primary/40 pl-3 text-body text-ink-primary"
              >
                "{f.body}"
                <footer className="mt-1 text-caption text-ink-tertiary">
                  {f.createdAt.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </footer>
              </blockquote>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 space-y-4 lg:col-span-8">
          {data.flags.map((f) => (
            <Card
              key={f.id}
              className={
                f.severity === "RED"
                  ? "border-risk-red/30 bg-risk-red/5"
                  : f.severity === "ORANGE"
                  ? "border-risk-orange/30 bg-risk-orange/5"
                  : "border-risk-yellow/30 bg-risk-yellow/5"
              }
            >
              <CardHeader>
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-ink-secondary" aria-hidden />
                  <div className="flex-1">
                    <CardTitle className="text-body-lg">
                      Flag · {timeAgo(f.createdAt)}
                      {f.severityOverrideAt && (
                        <Badge variant="outline" className="ml-2">override</Badge>
                      )}
                      {f.acknowledgedAt && (
                        <Badge variant="outline" className="ml-2">acknowledged</Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="mt-1.5">{f.explanation}</CardDescription>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {f.domainsInvolved.map((d) => (
                        <Badge key={d} variant="outline">{d}</Badge>
                      ))}
                    </div>
                  </div>
                  <RiskBadge level={f.severity} size="sm" />
                </div>
              </CardHeader>
            </Card>
          ))}

          <Card>
            <CardHeader>
              <CardTitle className="text-body-lg">Domain trends · last 12 weeks</CardTitle>
              <CardDescription>Higher = more concerning. Tick marks = missed weeks.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {sparklines.map((d) => (
                <DomainSparkline key={d.domain} {...d} width={420} height={36} />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-body-lg">Recent activity</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="relative space-y-5 border-l border-border pl-5">
                {activity.length === 0 && (
                  <li className="text-body text-ink-tertiary">No activity yet.</li>
                )}
                {activity.map((t, i) => (
                  <li key={i} className="relative">
                    <span
                      className={`absolute -left-[1.6rem] top-1 grid h-3 w-3 place-items-center rounded-full border-2 border-canvas-card ${
                        t.kind === "contact"
                          ? "bg-primary"
                          : t.kind === "flag"
                          ? "bg-risk-orange"
                          : "bg-ink-tertiary"
                      }`}
                      aria-hidden
                    />
                    <div className="flex items-baseline gap-2">
                      <span className="text-caption font-semibold text-ink-secondary">
                        {t.kind === "checkin" ? `Week ${t.week}` : t.time.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                      </span>
                      {t.riskLevel && <RiskBadge level={t.riskLevel} size="sm" />}
                      {t.kind === "contact" && <Badge variant="primary">Contact</Badge>}
                      {t.kind === "flag" && <Badge variant="outline">Flag</Badge>}
                    </div>
                    <p className="mt-1 text-body text-ink-primary">{t.summary}</p>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>

        <aside className="col-span-12 lg:col-span-4">
          <ActionPanel
            veteranId={params.id}
            riskLevel={overallRisk}
            actionLabel={action.label}
            actionDeadline={action.deadline}
            topFlagId={topFlag?.id ?? null}
            topFlagAcknowledged={!!topFlag?.acknowledgedAt}
            existingThreadId={data.threadId}
          />
        </aside>
      </div>
    </div>
  );
}

function timeAgo(d: Date): string {
  const ms = Date.now() - d.getTime();
  const minutes = Math.round(ms / 60_000);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}
