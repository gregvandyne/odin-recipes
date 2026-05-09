import { RiskBadge } from "@/components/sentinel/risk-badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { RiskLevel } from "@/lib/risk/types";
import { Clock } from "lucide-react";

interface Escalation {
  id: string;
  veteranName: string;
  initials: string;
  raisedBy: string;
  riskLevel: RiskLevel;
  summary: string;
  raisedAt: string;
  weeksSinceSeparation: number;
}

const escalations: Escalation[] = [
  {
    id: "esc-1", veteranName: "Sgt. M. Alvarez", initials: "MA", raisedBy: "S. Kim",
    riskLevel: "RED",
    summary: "Explicit risk language in week 9 open-ended response. Coordinator requesting crisis-protocol guidance.",
    raisedAt: "30 min ago",
    weeksSinceSeparation: 9,
  },
  {
    id: "esc-2", veteranName: "PO2 J. Reed", initials: "JR", raisedBy: "S. Kim",
    riskLevel: "ORANGE",
    summary: "Compounding pattern across Sleep, Mood, Connection. Coordinator wants consultation before outreach.",
    raisedAt: "3 hr ago",
    weeksSinceSeparation: 9,
  },
];

export default function ClinicalEscalations() {
  return (
    <div className="px-6 py-6 space-y-6">
      <header>
        <p className="text-caption uppercase tracking-wide text-ink-tertiary">Clinical</p>
        <h1 className="mt-1 text-display font-semibold text-ink-primary">Escalations</h1>
        <p className="mt-2 max-w-2xl text-body text-ink-secondary">
          Cases requiring clinical consultation. Read access to message threads is granted while an escalation is active.
        </p>
      </header>

      <div className="space-y-3">
        {escalations.map((e) => (
          <Card key={e.id} className={e.riskLevel === "RED" ? "border-risk-red/30 bg-risk-red/[0.03]" : ""}>
            <CardHeader>
              <div className="flex items-start gap-4">
                <Avatar initials={e.initials} size="lg" />
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-body-lg">{e.veteranName}</CardTitle>
                    <RiskBadge level={e.riskLevel} />
                  </div>
                  <CardDescription className="mt-1 flex items-center gap-2">
                    <Badge variant="outline">Wk {e.weeksSinceSeparation}</Badge>
                    <span>Raised by {e.raisedBy}</span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" aria-hidden /> {e.raisedAt}
                    </span>
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-body text-ink-primary">{e.summary}</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="primary">Open clinical view</Button>
                <Button variant="secondary">Add consult notes</Button>
                {e.riskLevel === "RED" && (
                  <Button variant="crisis">Activate crisis protocol</Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
