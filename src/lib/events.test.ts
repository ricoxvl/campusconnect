import { describe, expect, it } from "vitest";
import { mockEvents } from "../data/events";
import type { CampusEvent, EventFilters, Preferences } from "../types";
import {
  defaultFilters,
  filterEvents,
  matchesAvailability,
  officialUrl,
  recommend,
  validAvailability,
} from "./events";
import { emptyPreferences } from "./storage";
const now = new Date("2026-11-07T12:00:00-06:00");
const p: Preferences = {
  ...emptyPreferences,
  interests: ["Technology"],
  days: ["Thu"],
  periods: ["Afternoon"],
};
const coding = mockEvents.find((e) => e.id === "coding-circle")!;
describe("recommendations", () => {
  it("returns the top three matching events with specific explanations", () => {
    const results = recommend(mockEvents, p, now);
    expect(results).toHaveLength(3);
    expect(
      results.every((r) => r.event.categories.includes("Technology")),
    ).toBe(true);
    expect(
      results.every(
        (r) =>
          r.reason.includes("Technology") && r.reason.includes("Thu afternoon"),
      ),
    ).toBe(true);
  });
  it("ranks more interest overlaps above fewer and uses chronological ties", () => {
    const results = recommend(
      mockEvents,
      { ...p, interests: ["Technology", "Career & networking"] },
      now,
    );
    expect(results[0].event.id).toBe("tech-meetup");
    expect(results.slice(1).map((r) => r.event.id)).toEqual([
      "coding-circle",
      "web-workshop",
    ]);
  });
  it("supports arbitrary interest and multi-day/time combinations", () => {
    const results = recommend(
      mockEvents,
      {
        ...p,
        interests: ["Wellness", "Volunteering"],
        days: ["Mon", "Fri"],
        periods: ["Morning", "Afternoon"],
      },
      now,
    );
    expect(results.map((r) => r.event.id)).toEqual([
      "wellness-walk",
      "volunteer-intro",
    ]);
  });
  it("returns fewer than three or none without filling with mismatches", () => {
    expect(
      recommend(
        mockEvents,
        { ...p, interests: ["Volunteering"], days: ["Fri"] },
        now,
      ),
    ).toHaveLength(1);
    expect(
      recommend(mockEvents, { ...p, days: ["Sun"], periods: ["Morning"] }, now),
    ).toEqual([]);
    expect(recommend(mockEvents, { ...p, interests: [] }, now)).toEqual([]);
  });
  it("ignores days and periods for no schedule preference and excludes past events", () => {
    const results = recommend(
      mockEvents,
      { ...p, days: [], periods: [], noSchedulePreference: true },
      now,
    );
    expect(results).toHaveLength(3);
    expect(results[0].reason).toContain("no schedule preference");
    expect(recommend(mockEvents, p, new Date("2027-01-01"))).toEqual([]);
  });
});
describe("availability", () => {
  it("requires days plus periods or any time, unless no preference is set", () => {
    expect(validAvailability(emptyPreferences)).toBe(false);
    expect(validAvailability({ ...p, periods: [], anyTime: true })).toBe(true);
    expect(validAvailability({ ...p, days: [] })).toBe(false);
    expect(
      validAvailability({ ...emptyPreferences, noSchedulePreference: true }),
    ).toBe(true);
  });
  it("uses campus time at noon and 5 PM, independently of the browser timezone", () => {
    const boundary = (hour: string): CampusEvent => ({
      ...coding,
      startsAt: `2026-11-12T${hour}:00:00-06:00`,
    });
    expect(matchesAvailability(boundary("12"), p)).toBe(true);
    expect(matchesAvailability(boundary("17"), p)).toBe(false);
    expect(
      matchesAvailability(boundary("17"), { ...p, periods: ["Evening"] }),
    ).toBe(true);
    expect(
      matchesAvailability(boundary("08"), { ...p, periods: [], anyTime: true }),
    ).toBe(true);
  });
});
describe("combined filtering", () => {
  const filter = (values: Partial<EventFilters>, date = now) =>
    filterEvents(mockEvents, { ...defaultFilters, ...values }, p, date);
  it("searches case-insensitively through title, description, category and location", () => {
    expect(filter({ query: "  CODING  " }).map((e) => e.id)).toEqual([
      "coding-circle",
    ]);
    expect(filter({ query: "Founders" })[0].id).toBe("career-workshop");
    expect(filter({ query: "volunteering" })).toHaveLength(2);
  });
  it("combines search, categories, date, and availability with AND", () => {
    expect(
      filter({
        query: "coding",
        categories: ["Technology"],
        date: "next-week",
        availability: true,
      }).map((e) => e.id),
    ).toEqual(["coding-circle"]);
    expect(
      filter({
        query: "coding",
        categories: ["Volunteering"],
        date: "next-week",
        availability: true,
      }),
    ).toEqual([]);
  });
  it("matches any selected category, without duplicate results", () => {
    const results = filter({ categories: ["Technology", "Academics"] });
    expect(results.some((e) => e.id === "study-circle")).toBe(true);
    expect(results.filter((e) => e.id === "coding-circle")).toHaveLength(1);
  });
  it("uses Monday through Sunday campus weeks, plus today boundaries", () => {
    expect(filter({ date: "week" })).toEqual([]);
    expect(filter({ date: "next-week" })).toHaveLength(15);
    expect(filter({ date: "today" }, new Date("2026-11-12T00:30:00Z"))).toEqual(
      [],
    ); // Still Wednesday evening in Dallas.
    expect(
      filter({ date: "today" }, new Date("2026-11-12T00:01:00-06:00")),
    ).toHaveLength(3);
  });
  it("sorts in both directions and returns empty data cleanly", () => {
    const ascending = filter({});
    const descending = filter({ sort: "latest" });
    expect(ascending[0].id).toBe(descending.at(-1)?.id);
    expect(filterEvents([], defaultFilters, p, now)).toEqual([]);
  });
});
describe("source integrity", () => {
  it("never links fictional events as official, even if a URL is supplied", () => {
    expect(
      mockEvents.every(
        (e) => e.fictional && !e.source.verified && !e.source.url,
      ),
    ).toBe(true);
    expect(
      officialUrl({
        ...coding,
        source: { name: "test", verified: true, url: "https://example.com" },
      }),
    ).toBeNull();
  });
  it("supports safe official links when real data replaces the fixtures", () => {
    expect(
      officialUrl({
        ...coding,
        fictional: false,
        source: {
          name: "Official",
          verified: true,
          url: "https://calendar.utdallas.edu/",
        },
      }),
    ).toBe("https://calendar.utdallas.edu/");
    expect(
      officialUrl({
        ...coding,
        fictional: false,
        source: {
          name: "Invalid",
          verified: false,
          url: "javascript:alert(1)",
        },
      }),
    ).toBeNull();
  });
});
