import { describe, it, expect } from "vitest";
import {
  categoryForSeverity,
  recipientsForSeverity,
  pushEligible,
  pushPriorityFor,
  realtimeEligible,
} from "../categories";

describe("categoryForSeverity", () => {
  it("maps RED → RED_FLAG", () => {
    expect(categoryForSeverity("RED")).toBe("RED_FLAG");
  });
  it("maps ORANGE → ORANGE_FLAG", () => {
    expect(categoryForSeverity("ORANGE")).toBe("ORANGE_FLAG");
  });
  it("maps YELLOW → YELLOW_FLAG", () => {
    expect(categoryForSeverity("YELLOW")).toBe("YELLOW_FLAG");
  });
  it("returns null for GREEN — coordinators don't get pinged for stable check-ins", () => {
    expect(categoryForSeverity("GREEN")).toBeNull();
  });
});

describe("recipientsForSeverity", () => {
  it("RED pages coordinator + clinical lead + program manager", () => {
    expect(recipientsForSeverity("RED")).toEqual([
      "COORDINATOR",
      "CLINICAL_LEAD",
      "PROGRAM_MANAGER",
    ]);
  });
  it("ORANGE pages coordinator + clinical lead (PM stays out)", () => {
    expect(recipientsForSeverity("ORANGE")).toEqual(["COORDINATOR", "CLINICAL_LEAD"]);
  });
  it("YELLOW is the assigned coordinator only", () => {
    expect(recipientsForSeverity("YELLOW")).toEqual(["COORDINATOR"]);
  });
  it("GREEN pages no one", () => {
    expect(recipientsForSeverity("GREEN")).toEqual([]);
  });
});

describe("pushEligible", () => {
  it("RED + ORANGE flag categories trigger Web Push", () => {
    expect(pushEligible("RED_FLAG")).toBe(true);
    expect(pushEligible("ORANGE_FLAG")).toBe(true);
  });
  it("YELLOW flags do not push (awareness only)", () => {
    expect(pushEligible("YELLOW_FLAG")).toBe(false);
  });
  it("messages + escalations push too", () => {
    expect(pushEligible("NEW_ESCALATION")).toBe(true);
    expect(pushEligible("NEW_MESSAGE")).toBe(true);
  });
  it("digest categories never push", () => {
    expect(pushEligible("CASELOAD_DIGEST")).toBe(false);
    expect(pushEligible("CLINICAL_DAILY_DIGEST")).toBe(false);
  });
});

describe("pushPriorityFor", () => {
  it("RED is critical", () => {
    expect(pushPriorityFor("RED_FLAG")).toBe("critical");
  });
  it("ORANGE + escalation are normal", () => {
    expect(pushPriorityFor("ORANGE_FLAG")).toBe("normal");
    expect(pushPriorityFor("NEW_ESCALATION")).toBe("normal");
  });
  it("everything else is low", () => {
    expect(pushPriorityFor("NEW_MESSAGE")).toBe("low");
    expect(pushPriorityFor("WEEKLY_CHECKIN_INVITE")).toBe("low");
  });
});

describe("realtimeEligible", () => {
  it("flag + escalation events publish to SSE channels", () => {
    expect(realtimeEligible("RED_FLAG")).toBe(true);
    expect(realtimeEligible("ORANGE_FLAG")).toBe(true);
    expect(realtimeEligible("YELLOW_FLAG")).toBe(true);
    expect(realtimeEligible("NEW_ESCALATION")).toBe(true);
  });
  it("emails + digests don't publish to SSE", () => {
    expect(realtimeEligible("NEW_MESSAGE")).toBe(false);
    expect(realtimeEligible("WEEKLY_CHECKIN_INVITE")).toBe(false);
    expect(realtimeEligible("CASELOAD_DIGEST")).toBe(false);
  });
});
