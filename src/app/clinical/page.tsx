import { redirect } from "next/navigation";
import { RiskBadge } from "@/components/sentinel/risk-badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";
import { auth } from "@/lib/auth/config";
import { withTenant } from "@/lib/db/tenant-context";
import { ClinicalActions } from "./clinical-actions";

export default async function ClinicalEscalations() {
  const session = await auth();
  const orgId = (session?.user as { organizationId?: string } | undefined)?.organizationId;
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const role = (session?.user as { role?: string } | undefined)?.role ?? "CLINICAL_LEAD";
  if (!orgId || !userId) redirect("/auth/sign-in");

  const escalations = await withTenant(
    { organizationId: orgId, userId, userRole: role, isOrgAdmin: false },
    async (tx) =>
      tx.clinicalEscalation.findMany({
        where: {
          organizationId: orgId,
          status: { not: "CLOSED" },
          OR: [{ clinicalLeadId: null }, { clinicalLeadId: userId }],
        },
        orderBy: [{ status: "asc" }, { createdAt: "asc" }],
        take: 50,
        select: {
          id: true,
          veteranId: true,
          status: true,
          createdAt: true,
          recommendedAction: true,
          clinicalLeadId: true,
          escalatingCoordinator: { select: { displayName: true, email: true } },
          triggeredByFlagId: true,
        },
      }),
  );

  // Hydrate veteran display + matching flag severity for the row.
  const veteranIds = [...new Set(escalations.map((e) => e.veteranId))];
  const flagIds = escalations
    .map((e) => e.triggeredByFlagId)
    .filter((id): id is string => !!id);
  const [veterans, flags] = veteranIds.length
    ? await withTenant(
        { organizationId: orgId, userId, userRole: role, isOrgAdmin: false },
        async (tx) => {
          const vs = await tx.veteranProfile.findMany({
            where: { userId: { in: veteranIds } },
            select: { userId: true, user: { select: { displayName: true, email: true } } },
          });
          const fs = flagIds.length
            ? await tx.flag.findMany({
                where: { id: { in: flagIds } },
                select: { id: true, severity: true, explanation: true },
              })
            : [];
          return [vs, fs] as const;
        },
      )
    : [[], []];

  const veteranById = new Map(veterans.map((v) => [v.userId, v]));
  const flagById = new Map(flags.map((f) => [f.id, f]));

  return (
    <div className="px-6 py-6 space-y-6">
      <header>
        <p className="text-caption uppercase tracking-wide text-ink-tertiary">Clinical</p>
        <h1 className="mt-1 text-display font-semibold text-ink-primary">Escalations</h1>
        <p className="mt-2 max-w-2xl text-body text-ink-secondary">
          Cases requiring clinical consultation. Real-time updates while you're on this page.
        </p>
      </header>

      {escalations.length === 0 && (
        <p className="rounded-lg border border-border bg-canvas-card p-8 text-center text-body text-ink-secondary">
          No active escalations.
        </p>
      )}

      <div className="space-y-3">
        {escalations.map((e) => {
          const v = veteranById.get(e.veteranId);
          const flag = e.triggeredByFlagId ? flagById.get(e.triggeredByFlagId) : null;
          const veteranName = v?.user.displayName ?? v?.user.email ?? "Unknown";
          const initials = veteranName.split(/\s+/).map((s) => s[0]).join("").slice(0, 2).toUpperCase();
          const isMine = e.clinicalLeadId === userId;
          return (
            <Card
              key={e.id}
              className={flag?.severity === "RED" ? "border-risk-red/30 bg-risk-red/[0.03]" : ""}
            >
              <CardHeader>
                <div className="flex items-start gap-4">
                  <Avatar initials={initials} size="lg" />
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <CardTitle className="text-body-lg">{veteranName}</CardTitle>
                      {flag?.severity && <RiskBadge level={flag.severity} />}
                    </div>
                    <CardDescription className="mt-1 flex items-center gap-2 flex-wrap">
                      <Badge variant="outline">{e.status}</Badge>
                      {isMine && <Badge variant="primary">Mine</Badge>}
                      <span>Raised by {e.escalatingCoordinator.displayName ?? e.escalatingCoordinator.email}</span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" aria-hidden /> {timeAgo(e.createdAt)}
                      </span>
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {flag?.explanation && (
                  <p className="text-body text-ink-primary">{flag.explanation}</p>
                )}
                {e.recommendedAction && (
                  <p className="text-body text-ink-secondary italic">"{e.recommendedAction}"</p>
                )}
                <ClinicalActions
                  escalationId={e.id}
                  status={e.status}
                  isMine={isMine}
                  veteranId={e.veteranId}
                />
              </CardContent>
            </Card>
          );
        })}
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
  return `${Math.round(hours / 24)}d ago`;
}
