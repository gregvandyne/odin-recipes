/**
 * Seed a realistic scenario for screenshot capture.
 *
 * Creates:
 *   - One organization (Sentinel Pilot)
 *   - One cohort (Spring '26 — Cohort A)
 *   - 1 program manager, 1 clinical lead, 2 coordinators
 *   - 8 veterans with varied profiles, programStartDate spreading across
 *     weeks 1..28 of their program
 *   - 12 weeks of check-in history per veteran with realistic risk
 *     trajectories (one in clear RED with explicit risk language, two
 *     ORANGE with compound shifts, three YELLOW, two stable GREEN)
 *   - Flags matching the trajectories (RED/ORANGE/YELLOW unresolved)
 *   - One clinical escalation pending
 *   - Threads + a handful of messages
 *
 * This is screenshot data, not production data. Re-running is safe — we
 * upsert by deterministic ids so subsequent runs replace cleanly.
 *
 * Run: `DATABASE_URL=... APP_ENCRYPTION_KEY=... tsx scripts/seed-screenshots.ts`
 */

import { PrismaClient, type Prisma } from "@prisma/client";
import { encryptField, checkInAad, messageAad, contactAad } from "../src/lib/security/encryption";

const prisma = new PrismaClient();

const ORG_ID = "00000000-0000-4000-8000-000000000001";
const COHORT_ID = "00000000-0000-4000-8000-000000000002";

const PM_ID = "00000000-0000-4000-8000-00000000aaaa";
const CL_ID = "00000000-0000-4000-8000-00000000bbbb";
const COORD1_ID = "00000000-0000-4000-8000-00000000cccc";
const COORD2_ID = "00000000-0000-4000-8000-00000000dddd";

const VETERANS = [
  { id: "00000000-0000-4000-8000-0000000010a1", name: "Marcus Alvarez",  branch: "Army",       weeksIn: 9,  scenario: "red"    as const },
  { id: "00000000-0000-4000-8000-0000000010a2", name: "Jordan Reed",     branch: "Navy",       weeksIn: 9,  scenario: "orange" as const },
  { id: "00000000-0000-4000-8000-0000000010a3", name: "Riley Park",      branch: "Marines",    weeksIn: 12, scenario: "orange" as const },
  { id: "00000000-0000-4000-8000-0000000010a4", name: "Taylor Williams", branch: "Air Force",  weeksIn: 19, scenario: "yellow" as const },
  { id: "00000000-0000-4000-8000-0000000010a5", name: "Dakota Nguyen",   branch: "Army",       weeksIn: 22, scenario: "yellow" as const },
  { id: "00000000-0000-4000-8000-0000000010a6", name: "Emerson Hayes",   branch: "Navy",       weeksIn: 6,  scenario: "yellow" as const },
  { id: "00000000-0000-4000-8000-0000000010a7", name: "Casey Brennan",   branch: "Coast Guard", weeksIn: 28, scenario: "green"  as const },
  { id: "00000000-0000-4000-8000-0000000010a8", name: "Skyler Park",     branch: "Marines",    weeksIn: 4,  scenario: "green"  as const },
];

const DOMAINS = [
  "SLEEP",
  "MOOD",
  "CONNECTION",
  "PURPOSE",
  "FINANCE",
  "RELATIONSHIP",
  "HOUSING",
  "SUBSTANCE",
  "PAIN",
] as const;

const QUESTIONS_BY_DOMAIN: Record<(typeof DOMAINS)[number], string> = {
  SLEEP:        "q-sleep-w1-likert",
  MOOD:         "q-mood-w1-likert",
  CONNECTION:   "q-connection-w1-likert",
  PURPOSE:      "q-purpose-w1-likert",
  FINANCE:      "q-finance-w1-likert",
  RELATIONSHIP: "q-relationship-w1-likert",
  HOUSING:      "q-housing-w1-likert",
  SUBSTANCE:    "q-substance-w1-binary",
  PAIN:         "q-pain-w1-likert",
};

function veteranTrajectory(scenario: "red" | "orange" | "yellow" | "green"): number[][] {
  // Returns 12 weeks of domain scores (one number per DOMAINS index).
  // 0 = great, 100 = severely degraded.
  if (scenario === "red") {
    return Array.from({ length: 12 }, (_, w) => [
      40 + w * 2.5,           // sleep — degrading
      35 + w * 3.5,           // mood — degrading hard
      40 + w * 2,             // connection — also degrading
      45 + w,                 // purpose — slow drift
      55,                     // finance — flat
      40 + w * 1.5,           // relationship — degrading
      10,                     // housing — stable
      15 + w * 0.5,           // substance — small drift
      30 + w * 1.5,           // pain — drift
    ]);
  }
  if (scenario === "orange") {
    return Array.from({ length: 12 }, (_, w) => [
      45 + w * 1.5,
      40 + w * 1.8,
      40 + w * 1.2,
      40,
      55,
      35 + w * 0.5,
      10,
      15,
      35,
    ]);
  }
  if (scenario === "yellow") {
    return Array.from({ length: 12 }, (_, w) => [
      45,
      40 + w * 0.8,
      45,
      40,
      55 + w,                 // finance — single-domain drift
      35,
      10,
      15,
      35,
    ]);
  }
  // green
  return Array.from({ length: 12 }, (_, w) => [
    35 - w * 0.5,
    30,
    35 - w * 0.4,
    30,
    35,
    30,
    10,
    10,
    25,
  ]);
}

async function main(): Promise<void> {
  console.log("Seeding screenshot scenario…");

  // Set super-admin context so we bypass RLS during seeding.
  await prisma.$executeRawUnsafe(
    `SELECT set_config('app.is_super_admin', 'true', true)`,
  );

  // ---- Organization + Cohort -------------------------------------------
  await prisma.organization.upsert({
    where: { id: ORG_ID },
    create: {
      id: ORG_ID,
      slug: "sentinel-pilot",
      name: "Sentinel Pilot",
      primaryContactEmail: "ops@sentinel.health",
      organizationType: "NONPROFIT",
      status: "ACTIVE",
      mfaEnforcementLevel: "REQUIRED_STAFF",
      branding: {},
    },
    update: {
      status: "ACTIVE",
      mfaEnforcementLevel: "REQUIRED_STAFF",
    },
  });

  // ---- Staff -----------------------------------------------------------
  const STAFF = [
    { id: PM_ID,     name: "L. Hayes",       email: "l.hayes@sentinel.health",      role: "PROGRAM_MANAGER" },
    { id: CL_ID,     name: "Dr. R. Mitchell",email: "r.mitchell@sentinel.health",   role: "CLINICAL_LEAD"   },
    { id: COORD1_ID, name: "Sam Kim",        email: "sam.kim@sentinel.health",      role: "COORDINATOR"     },
    { id: COORD2_ID, name: "Cory Rivera",    email: "c.rivera@sentinel.health",     role: "COORDINATOR"     },
  ] as const;
  for (const s of STAFF) {
    await prisma.user.upsert({
      where: { id: s.id },
      create: {
        id: s.id,
        organizationId: ORG_ID,
        email: s.email,
        displayName: s.name,
        role: s.role as Prisma.UserCreateInput["role"],
        accountState: "ACTIVE",
        emailVerifiedAt: new Date(),
        mfaEnabled: true,
        mfaConfirmedAt: new Date(),
      },
      update: { displayName: s.name, accountState: "ACTIVE", mfaEnabled: true },
    });
  }

  await prisma.cohort.upsert({
    where: { id: COHORT_ID },
    create: {
      id: COHORT_ID,
      organizationId: ORG_ID,
      name: "Spring '26 — Cohort A",
      description: "First production cohort.",
      startDate: new Date(Date.now() - 24 * 7 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 28 * 7 * 24 * 60 * 60 * 1000),
      status: "ACTIVE",
      programManagerId: PM_ID,
    },
    update: { status: "ACTIVE" },
  });

  // ---- Veterans + profiles --------------------------------------------
  for (const v of VETERANS) {
    await prisma.user.upsert({
      where: { id: v.id },
      create: {
        id: v.id,
        organizationId: ORG_ID,
        email: v.name.toLowerCase().replace(/[^a-z]+/g, ".") + "@example.com",
        displayName: v.name,
        role: "VETERAN",
        accountState: "ACTIVE",
        emailVerifiedAt: new Date(),
        consentVersion: "1.0.0",
        consentSignedAt: new Date(),
      },
      update: {
        displayName: v.name,
        accountState: "ACTIVE",
        consentVersion: "1.0.0",
        consentSignedAt: new Date(),
      },
    });
    const programStart = new Date(Date.now() - v.weeksIn * 7 * 24 * 60 * 60 * 1000);
    const programEnd = new Date(programStart.getTime() + 52 * 7 * 24 * 60 * 60 * 1000);
    const coordinatorId = v.weeksIn % 2 === 0 ? COORD1_ID : COORD2_ID;
    await prisma.veteranProfile.upsert({
      where: { userId: v.id },
      create: {
        userId: v.id,
        organizationId: ORG_ID,
        cohortId: COHORT_ID,
        separationDate: new Date(programStart.getTime() - 30 * 24 * 60 * 60 * 1000),
        branchOfService: v.branch,
        yearsOfService: 6,
        timezone: "America/Los_Angeles",
        checkInDayOfWeek: 1,
        checkInLocalTime: "18:00",
        programStartDate: programStart,
        programEndDate: programEnd,
        assignedCoordinatorId: coordinatorId,
        status: "ACTIVE",
      },
      update: {
        assignedCoordinatorId: coordinatorId,
        programStartDate: programStart,
        programEndDate: programEnd,
      },
    });
  }

  // ---- Check-in history + flags for each veteran ----------------------
  // Wipe prior runs first so we don't double up history.
  // Append-only triggers (on Contact, Message, AuditLog, …) reject all
  // DELETEs at the DB level. For seed re-runs we need to clear prior
  // rows so the screenshot scenario stays deterministic. Disable the
  // session-level trigger replication, do the wipe, then re-enable.
  // `session_replication_role` is a Postgres setting that takes effect
  // for the current session only.
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SET LOCAL session_replication_role = 'replica'`);
    await tx.flag.deleteMany({ where: { organizationId: ORG_ID } });
    await tx.checkIn.deleteMany({ where: { organizationId: ORG_ID } });
    await tx.contact.deleteMany({ where: { organizationId: ORG_ID } });
    await tx.clinicalEscalation.deleteMany({ where: { organizationId: ORG_ID } });
    await tx.message.deleteMany({ where: { organizationId: ORG_ID } });
    await tx.messageThread.deleteMany({ where: { organizationId: ORG_ID } });
  });

  for (const v of VETERANS) {
    const trajectory = veteranTrajectory(v.scenario);
    const weeks = Math.min(12, v.weeksIn);
    for (let i = 0; i < weeks; i++) {
      const weekNumber = v.weeksIn - weeks + i + 1;
      const submittedAt = new Date(Date.now() - (weeks - 1 - i) * 7 * 24 * 60 * 60 * 1000);
      const scores = trajectory[i]!;
      const responses = DOMAINS.map((domain, idx) => ({
        questionId: QUESTIONS_BY_DOMAIN[domain],
        domainCode: domain,
        responseType: domain === "SUBSTANCE" ? "BINARY" : "LIKERT_5",
        value: domain === "SUBSTANCE" ? (scores[idx]! > 50 ? "TRUE" : "FALSE") : String(Math.round(scores[idx]! / 20)),
        skipped: false,
        weight: 1,
      }));

      const isLast = i === weeks - 1;
      const explicitRiskLanguage =
        isLast && v.scenario === "red"
          ? "I don't see how this gets better. Some days I think everyone would be better off without me here. I just don't know what to do anymore."
          : isLast && v.scenario === "orange"
          ? "Job thing fell through. Haven't slept right in two weeks."
          : isLast && v.scenario === "yellow"
          ? "Money's tighter than I told my wife. I'm figuring it out."
          : null;

      const checkInId = crypto.randomUUID();
      const riskLevel =
        v.scenario === "red" && isLast ? "RED"
        : v.scenario === "orange" && isLast ? "ORANGE"
        : v.scenario === "yellow" && isLast ? "YELLOW"
        : v.scenario === "green" ? "GREEN"
        : i >= weeks - 3 ? (v.scenario === "red" ? "ORANGE" : v.scenario === "orange" ? "YELLOW" : "GREEN")
        : "GREEN";

      await prisma.checkIn.create({
        data: {
          id: checkInId,
          organizationId: ORG_ID,
          veteranId: v.id,
          weekNumber,
          submittedAt,
          responses,
          openEndedResponse:
            explicitRiskLanguage
              ? encryptField(explicitRiskLanguage, checkInAad(ORG_ID, v.id, checkInId))
              : null,
          riskScore: 50,
          riskLevel: riskLevel as Prisma.CheckInCreateInput["riskLevel"],
          engineVersion: "engine-v1.0.0",
        },
      });

      // Flag on the latest check-in for non-green scenarios.
      if (isLast && v.scenario !== "green") {
        const flagId = crypto.randomUUID();
        await prisma.flag.create({
          data: {
            id: flagId,
            organizationId: ORG_ID,
            veteranId: v.id,
            checkInId,
            flagType: v.scenario === "red" ? "EXPLICIT_RISK" : "COMPOUNDING_RISK",
            severity: v.scenario === "red" ? "RED" : v.scenario === "orange" ? "ORANGE" : "YELLOW",
            explanation:
              v.scenario === "red"
                ? "Explicit risk language detected in open-ended response."
                : v.scenario === "orange"
                ? "Sleep + Mood + Connection all degraded together this week. Known high-risk pattern."
                : "Single-domain drift past the watch threshold.",
            domainsInvolved:
              v.scenario === "red"
                ? ["MOOD", "CONNECTION", "PURPOSE"]
                : v.scenario === "orange"
                ? ["SLEEP", "MOOD", "CONNECTION"]
                : ["FINANCE"],
          },
        });
      }
    }

    // Logged contact for the ORANGE veterans — coordinator already reached out
    if (v.scenario === "orange") {
      const contactId = crypto.randomUUID();
      await prisma.contact.create({
        data: {
          id: contactId,
          organizationId: ORG_ID,
          veteranId: v.id,
          coordinatorId: COORD1_ID,
          contactType: "OUTREACH_CALL",
          direction: "OUTBOUND",
          summary: encryptField(
            "22 min call. Walked through VA financial counseling referral. Will follow up Thursday.",
            contactAad(ORG_ID, contactId),
          ),
          followUpRequired: true,
          followUpBy: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          editableUntil: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
    }
  }

  // ---- A clinical escalation pending ----------------------------------
  const redVet = VETERANS.find((v) => v.scenario === "red")!;
  const escalationId = "00000000-0000-4000-8000-000000000099";
  await prisma.clinicalEscalation.create({
    data: {
      id: escalationId,
      organizationId: ORG_ID,
      veteranId: redVet.id,
      escalatingCoordinatorId: COORD1_ID,
      status: "PENDING",
      recommendedAction:
        "Crisis-protocol guidance — explicit risk language in this week's open-ended response.",
    },
  });

  // ---- Threads + messages ---------------------------------------------
  for (const v of VETERANS.slice(0, 4)) {
    const threadId = crypto.randomUUID();
    await prisma.messageThread.upsert({
      where: { id: threadId },
      create: {
        id: threadId,
        organizationId: ORG_ID,
        veteranId: v.id,
        coordinatorId: COORD1_ID,
        status: "ACTIVE",
        lastMessageAt: new Date(),
      },
      update: { status: "ACTIVE" },
    });
    // Two messages per thread for context.
    const m1Id = crypto.randomUUID();
    const m2Id = crypto.randomUUID();
    await prisma.message.create({
      data: {
        id: m1Id,
        organizationId: ORG_ID,
        threadId,
        senderId: COORD1_ID,
        senderRole: "COORDINATOR",
        bodyEncrypted: encryptField(
          `Hi ${v.name.split(" ")[0]} — saw your check-in. Want to talk this week?`,
          messageAad(ORG_ID, threadId, m1Id),
        ),
        sentAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        readAt: new Date(Date.now() - 90 * 60 * 1000),
      },
    });
    await prisma.message.create({
      data: {
        id: m2Id,
        organizationId: ORG_ID,
        threadId,
        senderId: v.id,
        senderRole: "VETERAN",
        bodyEncrypted: encryptField(
          "Thursday afternoon would work. Thanks.",
          messageAad(ORG_ID, threadId, m2Id),
        ),
        sentAt: new Date(Date.now() - 90 * 60 * 1000),
      },
    });
  }

  console.log("✓ Seeded:");
  console.log(`  org=${ORG_ID}`);
  console.log(`  pm=${PM_ID}`);
  console.log(`  cl=${CL_ID}`);
  console.log(`  coord1=${COORD1_ID}`);
  console.log(`  veterans=${VETERANS.length}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch((err) => {
    console.error(err);
    return prisma.$disconnect().finally(() => process.exit(1));
  });
