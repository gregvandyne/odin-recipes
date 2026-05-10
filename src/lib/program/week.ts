/**
 * Program week derivation.
 *
 * The Sentinel program runs 52 weeks from a veteran's `programStartDate`.
 * Week N is the calendar week that contains day (N-1)*7 through N*7-1
 * counted from the start.
 *
 * Boundaries are computed in the veteran's local timezone so the week number
 * doesn't tick over at midnight UTC for someone in Anchorage.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1_000;

/**
 * Compute the current program week number (1-52).
 *
 * @param programStartDate the veteran's `VeteranProfile.programStartDate`
 * @param now              the reference instant (defaults to Date.now())
 * @param timezone         IANA tz string; defaults to UTC.
 *                         Used to align day-boundary arithmetic; for now we
 *                         use a server-side approach that is timezone-aware
 *                         via `Intl.DateTimeFormat`.
 */
export function currentWeekNumber(
  programStartDate: Date,
  now: Date = new Date(),
  timezone: string = "UTC",
): number {
  const startMidnight = midnightInTz(programStartDate, timezone);
  const nowMidnight = midnightInTz(now, timezone);
  const diffDays = Math.floor((nowMidnight.getTime() - startMidnight.getTime()) / MS_PER_DAY);
  if (diffDays < 0) return 1;
  const week = Math.floor(diffDays / 7) + 1;
  return clamp(week, 1, 52);
}

/**
 * True when `now` falls within the program window (week 1..52 inclusive).
 */
export function isInProgramWindow(
  programStartDate: Date,
  programEndDate: Date,
  now: Date = new Date(),
): boolean {
  return now.getTime() >= programStartDate.getTime() && now.getTime() <= programEndDate.getTime();
}

/**
 * Day-of-week (0 = Sunday) in the given timezone.
 */
export function localDayOfWeek(now: Date, timezone: string): number {
  const fmt = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short" });
  const day = fmt.format(now);
  const lookup: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  return lookup[day] ?? 0;
}

/**
 * Local hour-of-day (0..23) for `now` rendered into `timezone`.
 */
export function localHourOfDay(now: Date, timezone: string): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    hour12: false,
  });
  const hh = fmt.format(now);
  const n = parseInt(hh, 10);
  return Number.isFinite(n) ? n : 0;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(Math.max(n, lo), hi);
}

/**
 * Render `d` as midnight (local time in `timezone`) and return that instant
 * as a UTC Date object for arithmetic.
 *
 * Implementation: format the date parts in the given tz, then construct a
 * UTC date from those parts. This loses sub-day precision intentionally —
 * we only care about day boundaries.
 */
function midnightInTz(d: Date, timezone: string): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const y = parseInt(get("year"), 10);
  const m = parseInt(get("month"), 10);
  const day = parseInt(get("day"), 10);
  return new Date(Date.UTC(y, m - 1, day, 0, 0, 0, 0));
}
