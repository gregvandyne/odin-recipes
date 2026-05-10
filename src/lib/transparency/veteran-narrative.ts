/**
 * Translate engine flags + coordinator contacts into plain prose.
 *
 * The veteran does NOT see AI marker names or engine internals — those would
 * be retraumatizing or confusing. They see:
 *   - which weeks triggered concern
 *   - what the concern was about, in plain language ("changes in your sleep")
 *   - whether their coordinator reached out
 *   - their own scores over time
 *
 * Specific markers (HOPELESSNESS, FINALITY, EXPLICIT_RISK) are NEVER surfaced
 * to the veteran in this view. They remain on the coordinator side.
 */

import type { DomainCode, FlagType, RiskLevel } from "@/lib/risk/types";

const DOMAIN_PROSE: Record<DomainCode, string> = {
  SLEEP: "your sleep",
  MOOD: "your mood",
  CONNECTION: "feeling connected",
  PURPOSE: "feeling purposeful",
  FINANCE: "money",
  SUBSTANCE: "alcohol or substance use",
  PAIN: "pain",
  RELATIONSHIP: "relationships",
  HOUSING: "housing",
};

interface FlagInput {
  id: string;
  flagType: FlagType;
  severity: RiskLevel;
  domainsInvolved: DomainCode[];
  createdAt: Date;
  acknowledgedAt: Date | null;
}

interface ContactInput {
  contactType: string;
  direction: string;
  createdAt: Date;
  coordinatorName: string | null;
}

export interface VeteranNarrativeRow {
  checkInId: string;
  weekNumber: number;
  submittedAt: Date;
  prose: string;
  outreachProse: string | null;
  flagIds: string[];
}

export function buildVeteranNarrative(args: {
  checkIns: { id: string; weekNumber: number; submittedAt: Date }[];
  flagsByCheckIn: Map<string, FlagInput[]>;
  contacts: ContactInput[];
}): VeteranNarrativeRow[] {
  return args.checkIns.map((c) => {
    const flags = args.flagsByCheckIn.get(c.id) ?? [];

    const visibleFlags = flags.filter((f) => f.flagType !== "EXPLICIT_RISK");
    const domainsTouched = new Set<DomainCode>();
    for (const f of visibleFlags) for (const d of f.domainsInvolved) domainsTouched.add(d);

    let prose: string;
    if (visibleFlags.length === 0) {
      prose = "Steady week. Nothing flagged.";
    } else if (domainsTouched.size === 0) {
      // Layer-4 marker without explicit domain (we don't expose marker names).
      prose = "Your coordinator wanted to take an extra look at this one.";
    } else {
      const list = [...domainsTouched].map((d) => DOMAIN_PROSE[d]).join(", ");
      prose = `Some changes in ${list}.`;
    }

    const outreach = args.contacts.find(
      (k) =>
        Math.abs(k.createdAt.getTime() - c.submittedAt.getTime()) < 7 * 24 * 60 * 60 * 1000 &&
        k.createdAt.getTime() >= c.submittedAt.getTime(),
    );
    const outreachProse = outreach
      ? `${outreach.coordinatorName ?? "Your coordinator"} reached out after this check-in.`
      : null;

    return {
      checkInId: c.id,
      weekNumber: c.weekNumber,
      submittedAt: c.submittedAt,
      prose,
      outreachProse,
      flagIds: flags.map((f) => f.id),
    };
  });
}
