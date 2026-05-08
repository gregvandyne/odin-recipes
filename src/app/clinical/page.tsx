import { RiskBadge } from "@/components/sentinel/risk-badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { RiskLevel } from "@/lib/risk/types";

interface Escalation {
  id: string;
  veteranName: string;
  raisedBy: string;
  riskLevel: RiskLevel;
  summary: string;
  raisedAt: string;
}

const escalations: Escalation[] = [
  {
    id: "esc-1",
    veteranName: "Sgt. M. Alvarez",
    raisedBy: "S. Kim",
    riskLevel: "RED",
    summary:
      "Explicit risk language in week 9 open-ended response. Coordinator requesting crisis-protocol guidance.",
    raisedAt: "30 min ago",
  },
  {
    id: "esc-2",
    veteranName: "PO2 J. Reed",
    raisedBy: "S. Kim",
    riskLevel: "ORANGE",
    summary:
      "Compounding pattern across Sleep, Mood, Connection. Coordinator wants consultation before outreach.",
    raisedAt: "3 hr ago",
  },
];

export default function ClinicalEscalations() {
  return (
    <div className="container py-6 space-y-6">
      <header>
        <h1 className="text-heading font-semibold text-ink-primary">Escalations</h1>
        <p className="mt-1 text-body text-ink-secondary">
          Cases requiring clinical consultation. Read access to message threads is granted while an escalation is active.
        </p>
      </header>

      <div className="space-y-3">
        {escalations.map((e) => (
          <Card key={e.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle className="text-body-lg">{e.veteranName}</CardTitle>
                  <CardDescription>
                    Raised by {e.raisedBy} · {e.raisedAt}
                  </CardDescription>
                </div>
                <RiskBadge level={e.riskLevel} />
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
