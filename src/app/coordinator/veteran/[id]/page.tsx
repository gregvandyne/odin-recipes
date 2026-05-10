import { DomainSparkline } from "@/components/sentinel/domain-sparkline";
import { RiskBadge } from "@/components/sentinel/risk-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { DomainCode, RiskLevel } from "@/lib/risk/types";
import { AlertTriangle, MessageSquare, Phone, Calendar, ArrowUpRight, Sparkles, AlertCircle, MessageCircleWarning } from "lucide-react";
import { auth } from "@/lib/auth/config";
import { withTenant } from "@/lib/db/tenant-context";

interface PageProps { params: { id: string } }

const sampleDomains: { domain: DomainCode; values: (number | null)[] }[] = [
  { domain: "SLEEP",        values: [40, 50, 35, 45, 30, 35, 25, 60] },
  { domain: "MOOD",         values: [50, 45, 50, 55, 60, 55, 50, 80] },
  { domain: "CONNECTION",   values: [70, 60, 55, 60, 50, 45, 40, 75] },
  { domain: "PURPOSE",      values: [40, 40, 50, 45, 50, 40, 45, 55] },
  { domain: "FINANCE",      values: [60, 55, 50, 55, 50, 50, 45, 50] },
  { domain: "SUBSTANCE",    values: [10, 10, 15, 10, 10, 15, 10, 30] },
  { domain: "PAIN",         values: [30, 25, 30, 35, 30, 30, 25, 40] },
  { domain: "RELATIONSHIP", values: [40, 35, 30, 35, 40, 30, 30, 60] },
  { domain: "HOUSING",      values: [10, 10, 10, 10, 10, 10, 10, 10] },
];

const flags = [
  {
    severity: "ORANGE" as RiskLevel,
    explanation: "Sleep + Mood + Connection all degraded together this week. Known high-risk pattern.",
    domains: ["SLEEP", "MOOD", "CONNECTION"] as DomainCode[],
    when: "2 hours ago",
  },
];

const recentTimeline = [
  { week: 8, kind: "checkin",  riskLevel: "ORANGE" as RiskLevel, summary: "Open-ended response: \"Haven't slept right in two weeks. The job thing fell through.\"" },
  { week: 7, kind: "contact",  riskLevel: null,                  summary: "Coordinator outreach call — 22 min. Followed up on VA financial counseling referral." },
  { week: 7, kind: "checkin",  riskLevel: "YELLOW" as RiskLevel, summary: "Mood worsened by 18 points vs. 4-week baseline." },
  { week: 6, kind: "checkin",  riskLevel: "GREEN" as RiskLevel,  summary: "Stable across domains." },
];

export default async function VeteranTimelinePage({ params }: PageProps) {
  const veteran = {
    id: params.id,
    name: "PO2 J. Reed",
    initials: "JR",
    branch: "Navy",
    weeksSinceSeparation: 9,
    coordinator: "S. Kim",
    riskLevel: "ORANGE" as RiskLevel,
  };

  const session = await auth();
  const orgId = (session?.user as { organizationId?: string } | undefined)?.organizationId;
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const role = (session?.user as { role?: string } | undefined)?.role ?? "COORDINATOR";

  // Pull real degradation banners + recent veteran feedback for this veteran.
  // If the session isn't a real coordinator session (e.g. screenshot capture),
  // fall back to empty arrays so the mock-driven UI still renders.
  const live = orgId && userId
    ? await withTenant(
        { organizationId: orgId, userId, userRole: role, isOrgAdmin: false },
        async (tx) => {
          const aiFailed = await tx.checkIn.findMany({
            where: { veteranId: params.id, aiAnalysisFailedAt: { not: null } },
            orderBy: { submittedAt: "desc" },
            take: 4,
            select: { id: true, submittedAt: true, weekNumber: true, aiAnalysisFailureReason: true },
          });
          const aiPending = await tx.checkIn.findMany({
            where: { veteranId: params.id, aiPending: true },
            orderBy: { submittedAt: "desc" },
            take: 4,
            select: { id: true, submittedAt: true, weekNumber: true },
          });
          const feedback = await tx.checkInFeedback.findMany({
            where: { veteranId: params.id, acknowledgedAt: null },
            orderBy: { createdAt: "desc" },
            take: 6,
            select: { id: true, createdAt: true, body: true, checkInId: true },
          });
          return { aiFailed, aiPending, feedback };
        },
      ).catch(() => ({ aiFailed: [], aiPending: [], feedback: [] }))
    : { aiFailed: [], aiPending: [], feedback: [] };

  return (
    <div className="px-6 py-6">
      {/* Sticky header */}
      <header className="mb-6 flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          <Avatar initials={veteran.initials} size="lg" />
          <div>
            <p className="text-caption text-ink-tertiary">
              {veteran.branch} · Week {veteran.weeksSinceSeparation} · Coord {veteran.coordinator}
            </p>
            <h1 className="mt-1 text-display font-semibold text-ink-primary">{veteran.name}</h1>
            <div className="mt-2 flex items-center gap-2">
              <Badge>52-week program</Badge>
              <Badge variant="outline">Cohort: Spring 2026 A</Badge>
            </div>
          </div>
        </div>
        <RiskBadge level={veteran.riskLevel} />
      </header>

      {(live.aiFailed.length > 0 || live.aiPending.length > 0) && (
        <div className="mb-4 space-y-2">
          {live.aiFailed.map((c) => (
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
          {live.aiPending.map((c) => (
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

      {live.feedback.length > 0 && (
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
            {live.feedback.map((f) => (
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
          {flags.map((f, i) => (
            <Card key={i} className="border-risk-orange/30 bg-risk-orange/5">
              <CardHeader>
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-risk-orange" aria-hidden />
                  <div className="flex-1">
                    <CardTitle className="text-body-lg">Flag raised · {f.when}</CardTitle>
                    <CardDescription className="mt-1.5">{f.explanation}</CardDescription>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {f.domains.map((d) => (
                        <Badge key={d} variant="outline">{d}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}

          <Card>
            <CardHeader>
              <CardTitle className="text-body-lg">Domain trends · last 8 weeks</CardTitle>
              <CardDescription>Higher = more concerning. Tick marks = missed weeks.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {sampleDomains.map((d) => (
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
                {recentTimeline.map((t, i) => (
                  <li key={i} className="relative">
                    <span
                      className={`absolute -left-[1.6rem] top-1 grid h-3 w-3 place-items-center rounded-full border-2 border-canvas-card ${
                        t.kind === "contact" ? "bg-primary" : "bg-ink-tertiary"
                      }`}
                      aria-hidden
                    />
                    <div className="flex items-baseline gap-2">
                      <span className="text-caption font-semibold text-ink-secondary">Week {t.week}</span>
                      {t.riskLevel && <RiskBadge level={t.riskLevel} size="sm" />}
                      {t.kind === "contact" && <Badge variant="primary">Contact</Badge>}
                    </div>
                    <p className="mt-1 text-body text-ink-primary">{t.summary}</p>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>

        <aside className="col-span-12 space-y-3 lg:col-span-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-body-lg">Recommended action</CardTitle>
              <CardDescription>Contact within <strong className="text-risk-orange">24 hours</strong>.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="primary" className="w-full justify-start">
                <MessageSquare className="h-4 w-4" /> Send message
              </Button>
              <Button variant="secondary" className="w-full justify-start">
                <Phone className="h-4 w-4" /> Log a call
              </Button>
              <Button variant="secondary" className="w-full justify-start">
                <Calendar className="h-4 w-4" /> Schedule outreach
              </Button>
              <Separator />
              <Button variant="ghost" className="w-full justify-start text-ink-secondary">
                <Sparkles className="h-4 w-4" /> AI-assist draft
              </Button>
              <Button variant="ghost" className="w-full justify-start text-ink-secondary">
                <ArrowUpRight className="h-4 w-4" /> Escalate to Clinical Lead
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-body-lg">Triage protocol · ORANGE</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-body text-ink-secondary">
                <li>· Review the last 4 weeks before reaching out.</li>
                <li>· Acknowledge what they shared specifically.</li>
                <li>· Offer one concrete next step. No pressure.</li>
                <li>· Log the contact within 24 hours of completion.</li>
                <li>· Consult Clinical Lead if uncertain.</li>
              </ul>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
