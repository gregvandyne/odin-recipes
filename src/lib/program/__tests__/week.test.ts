import { describe, it, expect } from "vitest";
import { currentWeekNumber, localDayOfWeek, localHourOfDay } from "../week";

describe("currentWeekNumber", () => {
  it("returns 1 on the start day", () => {
    const start = new Date(Date.UTC(2026, 0, 1, 12, 0, 0));
    expect(currentWeekNumber(start, start, "UTC")).toBe(1);
  });

  it("returns 2 after seven days", () => {
    const start = new Date(Date.UTC(2026, 0, 1));
    const now = new Date(Date.UTC(2026, 0, 8));
    expect(currentWeekNumber(start, now, "UTC")).toBe(2);
  });

  it("clamps to 52 even past the program end", () => {
    const start = new Date(Date.UTC(2026, 0, 1));
    const now = new Date(Date.UTC(2027, 6, 1)); // ~78 weeks later
    expect(currentWeekNumber(start, now, "UTC")).toBe(52);
  });

  it("clamps to 1 if now is before the start", () => {
    const start = new Date(Date.UTC(2026, 5, 1));
    const now = new Date(Date.UTC(2026, 4, 1));
    expect(currentWeekNumber(start, now, "UTC")).toBe(1);
  });

  it("respects local-tz day boundaries (Anchorage)", () => {
    // Sunday 2026-01-04 23:00 Anchorage (UTC-9) is still day 4 locally,
    // even though it's already Monday 08:00 UTC.
    const start = new Date(Date.UTC(2026, 0, 1));
    const sundayLateAnchorage = new Date(Date.UTC(2026, 0, 5, 8, 0)); // Monday 08:00 UTC
    expect(currentWeekNumber(start, sundayLateAnchorage, "America/Anchorage")).toBe(1);
  });
});

describe("localDayOfWeek + localHourOfDay", () => {
  it("Monday in NY is 1; midnight is hour 0", () => {
    const d = new Date(Date.UTC(2026, 0, 5, 5, 0)); // 00:00 NY
    expect(localDayOfWeek(d, "America/New_York")).toBe(1); // Monday
    expect(localHourOfDay(d, "America/New_York")).toBe(0);
  });

  it("renders the correct hour-of-day across a tz", () => {
    const d = new Date(Date.UTC(2026, 5, 1, 12, 0));
    expect(localHourOfDay(d, "America/Los_Angeles")).toBe(5);
    expect(localHourOfDay(d, "Europe/London")).toBe(13);
  });
});
