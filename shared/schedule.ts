import { DAYS, type CampusEvent, type Preferences } from "./contracts";
export const CAMPUS_ZONE = "America/Chicago";
const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: CAMPUS_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const hourFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: CAMPUS_ZONE,
  hour: "numeric",
  hourCycle: "h23",
});
const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: CAMPUS_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});
const boundaryCache = new Map<string, number>();
export function campusDate(value: Date | number = new Date()) {
  return dateFormatter.format(value);
}
export function addDays(date: string, days: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function campusInstant(date: string, minutes = 0): number {
  const key = `${date}:${minutes}`;
  const cached = boundaryCache.get(key);
  if (cached !== undefined) return cached;
  const target = Date.parse(`${date}T00:00:00Z`) + minutes * 60000;
  let result = target;
  for (let i = 0; i < 3; i++) {
    const parts = partsFormatter.formatToParts(result);
    const p = Object.fromEntries(parts.map((x) => [x.type, x.value]));
    const local = Date.UTC(
      Number(p.year),
      Number(p.month) - 1,
      Number(p.day),
      Number(p.hour),
      Number(p.minute),
      Number(p.second),
    );
    result += target - local;
  }
  if (boundaryCache.size >= 512) boundaryCache.clear();
  boundaryCache.set(key, result);
  return result;
}
export function calendarRange(
  filter: string,
  now: number,
): [number, number] | null {
  const today = campusDate(now);
  if (filter === "today")
    return [campusInstant(today), campusInstant(addDays(today, 1))];
  if (filter === "week" || filter === "next-week") {
    const weekday = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7;
    const monday = addDays(today, -weekday + (filter === "next-week" ? 7 : 0));
    return [campusInstant(monday), campusInstant(addDays(monday, 7))];
  }
  return null;
}
// Require complete coverage. Adjacent selected periods/days form one continuous
// window, including midnight and daylight-saving transitions. No partial fit claim.
export function scheduleMatch(
  event: Pick<CampusEvent, "startsAt" | "endsAt">,
  p: Preferences,
): { matches: boolean; label: string } {
  if (p.noSchedulePreference)
    return { matches: true, label: "no schedule preference" };
  if (!p.days.length || (!p.anyTime && !p.periods.length))
    return { matches: false, label: "" };
  let cursor = Date.parse(event.startsAt);
  const end = Date.parse(event.endsAt);
  if (
    !Number.isFinite(cursor) ||
    !Number.isFinite(end) ||
    end <= cursor ||
    end - cursor > 7 * 86400000
  )
    return { matches: false, label: "" };
  const labels = new Set<string>();
  while (cursor < end) {
    const date = campusDate(cursor);
    const weekday = DAYS[(new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7];
    const hour = Number(hourFormatter.format(cursor));
    const period = hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : "Evening";
    if (
      !p.days.includes(weekday) ||
      (!p.anyTime && !p.periods.includes(period))
    )
      return { matches: false, label: "" };
    labels.add(`${weekday} ${p.anyTime ? "any time" : period.toLowerCase()}`);
    const boundary = campusInstant(
      date,
      hour < 12 ? 720 : hour < 17 ? 1020 : 1440,
    );
    if (boundary <= cursor) return { matches: false, label: "" };
    cursor = Math.min(end, boundary);
  }
  return { matches: true, label: [...labels].join(" + ") };
}
