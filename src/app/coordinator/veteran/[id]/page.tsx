import { DomainSparkline } from "@/components/sentinel/domain-sparkline";
import { RiskBadge } from "@/components/sentinel/risk-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { DomainCode, RiskLevel } from "@/lib/risk/types";
import { AlertTriangle, MessageSquare, Phone, Calendar, ArrowUpRight } from "lucide-react";

/**
 * Per-veteran timeline. Stacked sparklines across all 9 domains, flags
 * overlaid, contacts logged. Action panel on the right.
 */
interface PageProps {
  params: { id: string };
}

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
    explanation: "Sleep + Mood + Connection all degraded together this week. High-risk pattern.",
    domains: ["SLEEP", "MOOD", "CONNECTION"] as DomainCode[],
    when: "2 hours ago",
  },
];

export default function VeteranTimelinePage({ params }: PageProps) {
  const veteran = {
    id: params.id,
    name: "PO2 J. Reed",
    branch: "Navy",
    weeksSinceSeparation: 9,
    coordinator: "S. Kim",
    riskLevel: "ORANGE" as RiskLevel,
  };

  return (
    <div className="container grid grid-cols-12 gap-6 py-6">
      <div className="col-span-12 lg:col-span-8">
        <header className="mb-6 flex items-start justify-between">
          <div>
            <p className="text-caption text-ink-tertiary">
              {veteran.branch} · Week {veteran.weeksSinceSeparation} · Coord {veteran.coordinator}
            </p>
            <h1 className="mt-1 text-display font-semibold text-ink-primary">{veteran.name}</h1>
          </div>
          <RiskBadge level={veteran.riskLevel} />
        </header>

        {flags.map((f, i) => (
          <Card key={i} className="mb-4 border-risk-orange/30 bg-risk-orange/5">
            <CardHeader>
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-risk-orange" aria-hidden />
                <div>
                  <CardTitle className="text-body-lg">Flag raised · {f.when}</CardTitle>
                  <CardDescription>{f.explanation}</CardDescription>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {f.domains.map((d) => (
                      <span
                        key={d}
                        className="rounded bg-canvas-card px-1.5 py-0.5 text-caption text-ink-secondary"
                      >
                        {d}
                      </span>
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
            <CardDescription>
              Higher = more concerning. Tick marks indicate missed weeks.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {sampleDomains.map((d) => (
              <DomainSparkline key={d.domain} {...d} width={320} height={32} />
            ))}
          </CardContent>
        </Card>
      </div>

      <aside className="col-span-12 space-y-3 lg:col-span-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-body-lg">Recommended action</CardTitle>
            <CardDescription>Contact within 24 hours.</CardDescription>
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
            <Button variant="ghost" className="w-full justify-start">
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
  );
}
