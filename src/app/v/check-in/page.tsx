import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/config";
import { withTenant } from "@/lib/db/tenant-context";
import { currentWeekNumber } from "@/lib/program/week";
import {
  buildWeeklyCheckInQuestions,
  openEndedForWeek,
} from "@/lib/questions/canonical";
import { CheckInClient, type DraftSnapshot } from "./check-in-client";

/**
 * Check-in entry. Server component: pulls the veteran's current program week
 * and any saved draft, then hands off to the client for the interactive flow.
 *
 * The week is derived from `programStartDate` + the veteran's local timezone,
 * so a week boundary doesn't tick over at midnight UTC for someone in Alaska.
 */
export default async function CheckInPage() {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  const organizationId = (session?.user as { organizationId?: string } | undefined)?.organizationId;
  if (!userId || !organizationId) {
    redirect("/auth/sign-in");
  }

  const data = await withTenant(
    { organizationId, userId, userRole: "VETERAN", isOrgAdmin: false },
    async (tx) => {
      const profile = await tx.veteranProfile.findUnique({
        where: { userId },
        select: { programStartDate: true, timezone: true },
      });
      if (!profile) return null;
      const week = currentWeekNumber(profile.programStartDate, new Date(), profile.timezone);
      const draft = await tx.checkInDraft.findUnique({
        where: { veteranId_weekNumber: { veteranId: userId, weekNumber: week } },
        select: { responses: true, openEndedResponse: true, lastUpdatedAt: true },
      });
      return { week, draft };
    },
  );

  if (!data) redirect("/v");

  const questions = buildWeeklyCheckInQuestions(data.week);
  const openEndedPrompt = openEndedForWeek(data.week);

  const draftSnapshot: DraftSnapshot | null = data.draft
    ? {
        responses: (data.draft.responses as unknown as DraftSnapshot["responses"]) ?? [],
        openEndedResponse: data.draft.openEndedResponse,
        lastUpdatedAt: data.draft.lastUpdatedAt.toISOString(),
      }
    : null;

  return (
    <CheckInClient
      weekNumber={data.week}
      questions={questions}
      openEndedPrompt={openEndedPrompt}
      initialDraft={draftSnapshot}
    />
  );
}
