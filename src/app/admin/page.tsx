import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

/**
 * Cohort dashboard for Program Managers.
 * Stripe-Dashboard pattern: big numbers, sparkline trends, drill-down second.
 * Honest framing — connection metrics, not engagement metrics.
 */
function Metric({
  label,
  value,
  delta,
  helperText,
}: {
  label: string;
  value: string;
  delta?: string;
  helperText?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <span className="text-display font-semibold text-ink-primary">{value}</span>
          {delta && <span className="text-caption text-ink-secondary">{delta}</span>}
        </div>
        {helperText && <p className="mt-2 text-caption text-ink-tertiary">{helperText}</p>}
      </CardContent>
    </Card>
  );
}

export default function ProgramManagerDashboard() {
  return (
    <div className="container py-6 space-y-6">
      <header>
        <p className="text-caption text-ink-tertiary">Spring 2026 Cohort A · Week 9 of 52</p>
        <h1 className="mt-1 text-heading font-semibold text-ink-primary">Cohort health</h1>
      </header>

      <div className="grid gap-4 md:grid-cols-4">
        <Metric label="Veterans active" value="92" delta="of 96" helperText="3 paused, 1 withdrawn" />
        <Metric label="Check-in completion" value="87%" delta="last 4 weeks" />
        <Metric label="Median coord response" value="6.2h" delta="to ORANGE" helperText="Target ≤ 24h" />
        <Metric label="Self-reported connection" value="+4" delta="pts vs. baseline" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-body-lg">Flag distribution · this week</CardTitle>
          <CardDescription>Per-coordinator caseload health below.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <Stat color="text-risk-green"  count={68} label="Stable" />
            <Stat color="text-risk-yellow" count={18} label="Watch" />
            <Stat color="text-risk-orange" count={5}  label="Outreach" />
            <Stat color="text-risk-red"    count={1}  label="Immediate" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-body-lg">Coordinator caseload health</CardTitle>
          <CardDescription>Median response time and resolved-flag share.</CardDescription>
        </CardHeader>
        <CardContent>
          <table className="w-full text-body">
            <thead>
              <tr className="border-b border-border text-caption text-ink-tertiary">
                <th className="py-2 text-left">Coordinator</th>
                <th className="py-2 text-right">Caseload</th>
                <th className="py-2 text-right">ORANGE response (med.)</th>
                <th className="py-2 text-right">Resolved</th>
              </tr>
            </thead>
            <tbody>
              {[
                { name: "S. Kim",     load: 28, resp: "5.1h", resolved: "94%" },
                { name: "L. Patel",   load: 30, resp: "7.4h", resolved: "91%" },
                { name: "T. Bates",   load: 27, resp: "6.0h", resolved: "92%" },
                { name: "C. Rivera",  load: 7,  resp: "—",    resolved: "—" },
              ].map((row) => (
                <tr key={row.name} className="border-b border-border/60">
                  <td className="py-2 text-ink-primary">{row.name}</td>
                  <td className="py-2 text-right">{row.load}</td>
                  <td className="py-2 text-right">{row.resp}</td>
                  <td className="py-2 text-right">{row.resolved}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({ color, count, label }: { color: string; count: number; label: string }) {
  return (
    <div>
      <div className={`text-display font-semibold ${color}`}>{count}</div>
      <div className="text-caption text-ink-secondary">{label}</div>
    </div>
  );
}
