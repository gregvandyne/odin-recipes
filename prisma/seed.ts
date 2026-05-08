/**
 * Seed script — populates canonical question bank, domain reference data,
 * and a TEST_MODE organization with synthetic users for local development.
 */
import { PrismaClient } from "@prisma/client";
import { CANONICAL_QUESTIONS } from "../src/lib/questions/canonical";

const prisma = new PrismaClient();

async function main() {
  // Domains
  const domains: { code: string; displayName: string; description: string }[] = [
    { code: "SLEEP",        displayName: "Sleep",        description: "Hours, quality, restfulness" },
    { code: "MOOD",         displayName: "Mood",         description: "Overall affect across the week" },
    { code: "CONNECTION",   displayName: "Connection",   description: "Meaningful contact with other humans" },
    { code: "PURPOSE",      displayName: "Purpose",      description: "Sense of direction, meaning, identity" },
    { code: "FINANCE",      displayName: "Finance",      description: "Financial stress and stability" },
    { code: "SUBSTANCE",    displayName: "Substance",    description: "Alcohol and substance use patterns" },
    { code: "PAIN",         displayName: "Pain",         description: "Physical pain and chronic conditions" },
    { code: "RELATIONSHIP", displayName: "Relationship", description: "Tension with partner, family, close friends" },
    { code: "HOUSING",      displayName: "Housing",      description: "Housing stability" },
  ];

  for (const d of domains) {
    await prisma.domain.upsert({
      where: { code: d.code as never },
      update: {},
      create: {
        code: d.code as never,
        displayName: d.displayName,
        description: d.description,
        currentInstrumentVersion: "v1",
      },
    });
  }

  // Canonical questions (organizationId = null)
  for (const q of CANONICAL_QUESTIONS) {
    await prisma.checkInQuestion.upsert({
      where: { id: q.id },
      update: {
        questionText: q.questionText,
        weight: q.weight,
        rotationGroup: q.rotationGroup,
        version: q.version,
      },
      create: {
        id: q.id,
        organizationId: null,
        domainCode: q.domainCode as never,
        version: q.version,
        questionText: q.questionText,
        responseType: q.responseType as never,
        weight: q.weight,
        rotationGroup: q.rotationGroup,
      },
    });
  }

  console.log("Seeded canonical questions:", CANONICAL_QUESTIONS.length);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
