import {
  DAYS,
  type CampusEvent,
  type EventFilters,
  type Preferences,
  type Recommendation,
  type Period,
} from "../types";

export const CAMPUS_ZONE = "America/Chicago";
export function campusDate(value: Date | string = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: CAMPUS_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}
export function dateParts(event: CampusEvent) {
  const date = new Date(event.startsAt);
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: CAMPUS_ZONE,
    weekday: "short",
  }).format(date) as (typeof DAYS)[number];
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: CAMPUS_ZONE,
      hour: "numeric",
      hourCycle: "h23",
    }).format(date),
  );
  const period: Period =
    hour < 12 ? "Morning" : hour < 17 ? "Afternoon" : "Evening";
  return { weekday, period, date: campusDate(date) };
}
export function validAvailability(p: Preferences) {
  return (
    p.noSchedulePreference ||
    (p.days.length > 0 && (p.anyTime || p.periods.length > 0))
  );
}
// An event matches a time period when it starts in that period, in campus time.
export function matchesAvailability(event: CampusEvent, p: Preferences) {
  if (p.noSchedulePreference) return true;
  if (!validAvailability(p)) return false;
  const { weekday, period } = dateParts(event);
  return p.days.includes(weekday) && (p.anyTime || p.periods.includes(period));
}
export function recommendationFor(
  event: CampusEvent,
  p: Preferences,
): Recommendation | null {
  const interests = event.categories.filter((c) => p.interests.includes(c));
  if (!interests.length || !matchesAvailability(event, p)) return null;
  const { weekday, period } = dateParts(event);
  const schedule = p.noSchedulePreference
    ? "no schedule preference"
    : `${weekday} ${p.anyTime ? "on your selected day" : period.toLowerCase()}`;
  return {
    event,
    score: interests.length * 10 + (p.noSchedulePreference ? 0 : 5),
    reason: `Matches ${interests.join(" + ")} + ${schedule}.`,
  };
}
export function recommend(
  events: CampusEvent[],
  p: Preferences,
  now = new Date(),
): Recommendation[] {
  return events
    .filter((e) => new Date(e.startsAt) >= now)
    .map((e) => recommendationFor(e, p))
    .filter((r): r is Recommendation => r !== null)
    .sort(
      (a, b) =>
        b.score - a.score ||
        Date.parse(a.event.startsAt) - Date.parse(b.event.startsAt) ||
        a.event.id.localeCompare(b.event.id),
    )
    .slice(0, 3);
}
function weekBounds(now: Date) {
  const today = new Date(`${campusDate(now)}T12:00:00Z`);
  const monday = new Date(today);
  monday.setUTCDate(today.getUTCDate() - ((today.getUTCDay() + 6) % 7));
  const next = new Date(monday);
  next.setUTCDate(next.getUTCDate() + 7);
  const after = new Date(next);
  after.setUTCDate(after.getUTCDate() + 7);
  return [monday, next, after].map((d) => d.toISOString().slice(0, 10));
}
export function filterEvents(
  events: CampusEvent[],
  filters: EventFilters,
  p: Preferences,
  now = new Date(),
): CampusEvent[] {
  const query = filters.query.trim().toLocaleLowerCase();
  const [monday, next, after] = weekBounds(now);
  return events
    .filter((event) => {
      if (new Date(event.startsAt) < now) return false;
      if (
        query &&
        ![
          event.title,
          event.description,
          event.location,
          event.organizer,
          ...event.categories,
        ]
          .join(" ")
          .toLocaleLowerCase()
          .includes(query)
      )
        return false;
      if (
        filters.categories.length &&
        !event.categories.some((c) => filters.categories.includes(c))
      )
        return false;
      const date = campusDate(event.startsAt);
      if (filters.date === "today" && date !== campusDate(now)) return false;
      if (filters.date === "week" && !(date >= monday && date < next))
        return false;
      if (filters.date === "next-week" && !(date >= next && date < after))
        return false;
      return !filters.availability || matchesAvailability(event, p);
    })
    .sort(
      (a, b) =>
        (filters.sort === "soonest" ? 1 : -1) *
          (Date.parse(a.startsAt) - Date.parse(b.startsAt)) ||
        a.id.localeCompare(b.id),
    );
}
export function formatEventDate(event: CampusEvent, full = false) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: CAMPUS_ZONE,
    weekday: full ? "long" : "short",
    month: "short",
    day: "numeric",
    ...(full ? { year: "numeric" } : {}),
  }).format(new Date(event.startsAt));
}
export function formatEventTime(event: CampusEvent) {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone: CAMPUS_ZONE,
    hour: "numeric",
    minute: "2-digit",
  });
  return `${f.format(new Date(event.startsAt))}–${f.format(new Date(event.endsAt))}`;
}
export function officialUrl(event: CampusEvent): string | null {
  if (event.fictional || !event.source.url) return null;
  try {
    const url = new URL(event.source.url);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}
export const defaultFilters: EventFilters = {
  query: "",
  categories: [],
  date: "all",
  availability: false,
  sort: "soonest",
};
