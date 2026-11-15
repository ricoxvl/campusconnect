import type {
  CampusEvent,
  Preferences,
  Recommendation,
} from "../shared/contracts";
import { scheduleMatch } from "../shared/schedule";
export interface Weights {
  interest: number;
  schedule: number;
}
export const defaultWeights: Weights = { interest: 10, schedule: 5 };
export function scoreEvent(
  event: CampusEvent,
  p: Preferences,
  now: number,
  weights = defaultWeights,
): Recommendation | null {
  const start = Date.parse(event.startsAt),
    end = Date.parse(event.endsAt);
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    end <= start ||
    event.status !== "published" ||
    event.occurrenceStatus === "canceled" ||
    event.reviewRequired === true ||
    start < now ||
    (!event.fictional && !event.source.verified)
  )
    return null;
  const interests = [...new Set(p.interests)];
  const matching = event.categories.filter((c) => interests.includes(c));
  if (interests.length && !matching.length) return null;
  const schedule = scheduleMatch(event, p);
  if (!schedule.matches) return null;
  return {
    event,
    score:
      matching.length * weights.interest +
      (p.noSchedulePreference ? 0 : weights.schedule),
    reason: `Matches ${matching.length ? matching.join(" + ") : "no interest preference"} + ${schedule.label}.`,
  };
}
export function compareRecommendations(a: Recommendation, b: Recommendation) {
  return (
    b.score - a.score ||
    Date.parse(a.event.startsAt) - Date.parse(b.event.startsAt) ||
    a.event.id.localeCompare(b.event.id)
  );
}
export function scoringWeights(interest?: string, schedule?: string): Weights {
  const parse = (raw: string | undefined, fallback: number) => {
    const n = Number(raw);
    return raw !== undefined &&
      raw.trim() !== "" &&
      Number.isFinite(n) &&
      n >= 0 &&
      n <= 1000
      ? n
      : fallback;
  };
  return { interest: parse(interest, 10), schedule: parse(schedule, 5) };
}
