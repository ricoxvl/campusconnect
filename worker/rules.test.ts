import { describe, expect, it } from "vitest";
import {
  campusInstant,
  calendarRange,
  scheduleMatch,
} from "../shared/schedule";
import {
  compareRecommendations,
  defaultWeights,
  scoreEvent,
  scoringWeights,
} from "./recommendations";
import type { CampusEvent, Preferences } from "../shared/contracts";
const p: Preferences = {
  interests: ["Technology", "Academics"],
  days: ["Thu"],
  periods: ["Afternoon"],
  anyTime: false,
  noSchedulePreference: false,
};
const event: CampusEvent = {
  id: "one",
  title: "Sample event",
  description: "Test",
  categories: ["Technology", "Academics"],
  startsAt: "2026-11-12T14:00:00-06:00",
  endsAt: "2026-11-12T15:00:00-06:00",
  timeZone: "America/Chicago",
  location: "Test",
  organizer: "Test",
  source: { name: "Fictional", url: null, verified: false },
  fictional: true,
  status: "published",
};
const now = Date.parse("2026-11-07T12:00:00-06:00");
describe("schedule compatibility", () => {
  it("requires the entire event to fit and merges adjacent selected time periods", () => {
    const crossing = {
      ...event,
      startsAt: "2026-11-12T16:30:00-06:00",
      endsAt: "2026-11-12T18:00:00-06:00",
    };
    expect(scheduleMatch(crossing, p).matches).toBe(false);
    expect(
      scheduleMatch(crossing, { ...p, periods: ["Afternoon", "Evening"] })
        .matches,
    ).toBe(true);
    expect(scheduleMatch(crossing, { ...p, anyTime: true }).matches).toBe(true);
    expect(
      scheduleMatch(crossing, {
        ...p,
        noSchedulePreference: true,
        days: [],
        periods: [],
      }).matches,
    ).toBe(true);
  });
  it("handles midnight using both selected weekdays", () => {
    const overnight = {
      ...event,
      startsAt: "2026-11-13T23:30:00-06:00",
      endsAt: "2026-11-14T01:00:00-06:00",
    };
    expect(
      scheduleMatch(overnight, {
        ...p,
        days: ["Fri"],
        periods: ["Evening", "Morning"],
      }).matches,
    ).toBe(false);
    expect(
      scheduleMatch(overnight, {
        ...p,
        days: ["Fri", "Sat"],
        periods: ["Evening", "Morning"],
      }).matches,
    ).toBe(true);
  });
  it("handles DST spring/fall days and uses campus midnight rather than UTC", () => {
    expect(campusInstant("2026-11-01")).toBe(
      Date.parse("2026-11-01T00:00:00-05:00"),
    );
    const fall = calendarRange("today", Date.parse("2026-11-01T14:00:00Z"))!;
    expect(fall[1] - fall[0]).toBe(25 * 3600000);
    const spring = calendarRange("today", Date.parse("2027-03-14T14:00:00Z"))!;
    expect(spring[1] - spring[0]).toBe(23 * 3600000);
    expect(
      scheduleMatch(
        {
          ...event,
          startsAt: "2027-03-14T01:30:00-06:00",
          endsAt: "2027-03-14T03:30:00-05:00",
        },
        { ...p, days: ["Sun"], periods: ["Morning"] },
      ).matches,
    ).toBe(true);
    expect(
      scheduleMatch(
        {
          ...event,
          startsAt: "2026-11-01T01:30:00-05:00",
          endsAt: "2026-11-01T01:45:00-06:00",
        },
        { ...p, days: ["Sun"], periods: ["Morning"] },
      ).matches,
    ).toBe(true);
  });
  it("rejects zero-duration, invalid dates, missing choices and uncovered partial overlaps", () => {
    expect(scheduleMatch({ ...event, endsAt: event.startsAt }, p).matches).toBe(
      false,
    );
    expect(scheduleMatch({ ...event, startsAt: "bad" }, p).matches).toBe(false);
    expect(scheduleMatch(event, { ...p, days: [] }).matches).toBe(false);
    expect(
      scheduleMatch({ ...event, startsAt: "2026-11-12T11:30:00-06:00" }, p)
        .matches,
    ).toBe(false);
  });
});
describe("transparent deterministic scoring", () => {
  it("deduplicates interests, accepts no preferences, and applies configurable weights", () => {
    expect(
      scoreEvent(
        event,
        { ...p, interests: ["Technology", "Technology", "Academics"] },
        now,
      )?.score,
    ).toBe(25);
    expect(
      scoreEvent(event, p, now, { interest: 20, schedule: 3 })?.score,
    ).toBe(43);
    const open = scoreEvent(
      event,
      {
        ...p,
        interests: [],
        days: [],
        periods: [],
        noSchedulePreference: true,
      },
      now,
    )!;
    expect(open.score).toBe(0);
    expect(open.reason).toContain(
      "no interest preference + no schedule preference",
    );
    expect(scoringWeights("bad", "-1")).toEqual(defaultWeights);
    expect(scoringWeights("", "")).toEqual(defaultWeights);
    expect(scoringWeights("0", "2")).toEqual({ interest: 0, schedule: 2 });
  });
  it("excludes expired, unpublished, unverified real and mismatched events", () => {
    expect(scoreEvent(event, p, Date.parse("2027-01-01"))).toBeNull();
    expect(scoreEvent({ ...event, status: "draft" }, p, now)).toBeNull();
    expect(scoreEvent({ ...event, fictional: false }, p, now)).toBeNull();
    expect(
      scoreEvent(
        { ...event, startsAt: "invalid" },
        { ...p, noSchedulePreference: true },
        now,
      ),
    ).toBeNull();
    expect(scoreEvent(event, { ...p, interests: ["Gaming"] }, now)).toBeNull();
  });
  it("breaks score ties by chronological instant then stable event ID", () => {
    const a = scoreEvent({ ...event, id: "a" }, p, now)!,
      b = scoreEvent({ ...event, id: "b" }, p, now)!;
    expect([b, a].sort(compareRecommendations).map((x) => x.event.id)).toEqual([
      "a",
      "b",
    ]);
  });
});
