import { mockEvents } from "../data/events";
import { INTERESTS, type EventPage, type EventRepository } from "../types";
import { emptyPreferences } from "../lib/storage";
import { filterEvents } from "../lib/events";
import {
  compareRecommendations,
  scoreEvent,
} from "../../worker/recommendations";
export const emptyPage: EventPage = {
  data: [],
  meta: { page: 1, pageSize: 18, total: 0, totalPages: 0 },
};
export const mockRepository: EventRepository = {
  async query(query, signal) {
    signal?.throwIfAborted();
    const data = filterEvents(
      mockEvents,
      {
        query: query.q ?? "",
        categories: query.category ?? [],
        date: query.date ?? "all",
        availability: !!(query.day?.length || query.period?.length),
        sort: query.sort ?? "soonest",
      },
      {
        ...emptyPreferences,
        days: query.day ?? [],
        periods: query.period ?? [],
        anyTime: query.anyTime ?? false,
      },
    );
    const page = query.page ?? 1,
      pageSize = query.pageSize ?? 18;
    return {
      data: structuredClone(data.slice((page - 1) * pageSize, page * pageSize)),
      meta: {
        page,
        pageSize,
        total: data.length,
        totalPages: Math.ceil(data.length / pageSize),
      },
    };
  },
  async get(id, signal) {
    signal?.throwIfAborted();
    return structuredClone(mockEvents.find((e) => e.id === id) ?? null);
  },
  async categories() {
    return INTERESTS.map((name, i) => ({ id: `category-${i}`, name }));
  },
  async recommendations(p, signal) {
    signal?.throwIfAborted();
    return mockEvents
      .map((e) => scoreEvent({ ...e, status: "published" }, p, Date.now()))
      .filter((r) => r !== null)
      .sort(compareRecommendations)
      .slice(0, 3);
  },
};
