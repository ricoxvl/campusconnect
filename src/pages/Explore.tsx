import { useEffect } from "react";
import { useEventClock } from "../hooks/useEventClock";
import { uniqueEvents } from "../../shared/quality";
import { useResource } from "../hooks/useResource";
import { Link, useSearchParams } from "react-router-dom";
import { useApp } from "../context/AppContext";
import {
  Choice,
  EmptyState,
  EventStatus,
  PageHeading,
  TestNotice,
} from "../components/ui";
import { EventCard } from "../components/EventCard";
import { validAvailability } from "../lib/events";
import { type DateFilter, type EventFilters, type Interest } from "../types";
const quickCategories: { label: string; category: Interest }[] = [
  { label: "Technology", category: "Technology" },
  { label: "Social", category: "Social events" },
  { label: "Career", category: "Career & networking" },
];
export default function Explore() {
  const { repository, remember, preferences, categories } = useApp();
  const [params, setParams] = useSearchParams();
  const filters: EventFilters = {
    query: params.get("q") ?? "",
    categories: params
      .getAll("category")
      .filter((c): c is Interest => c.trim().length > 0 && c.length <= 80),
    date: ["today", "week", "next-week"].includes(params.get("date") ?? "")
      ? (params.get("date") as DateFilter)
      : "all",
    availability: params.get("availability") === "mine",
    sort: params.get("sort") === "latest" ? "latest" : "soonest",
  };
  function update(key: string, value: string | string[]) {
    const next = new URLSearchParams(params);
    next.delete(key);
    if (key !== "page") next.delete("page");
    for (const v of Array.isArray(value) ? value : value ? [value] : [])
      next.append(key, v);
    setParams(next, { replace: true });
  }
  function toggleCategory(category: Interest) {
    update(
      "category",
      filters.categories.includes(category)
        ? filters.categories.filter((c) => c !== category)
        : [...filters.categories, category],
    );
  }
  const page = Math.max(1, Number(params.get("page")) || 1);
  const query = {
    q: filters.query,
    category: filters.categories,
    date: filters.date,
    sort: filters.sort,
    page,
    pageSize: 18,
    ...(filters.availability && !preferences.noSchedulePreference
      ? {
          day: preferences.days,
          period: preferences.anyTime ? [] : preferences.periods,
          anyTime: preferences.anyTime,
        }
      : {}),
  };
  const resource = useResource(
    (signal) =>
      filters.availability && !validAvailability(preferences)
        ? Promise.reject(
            new Error("Set your availability before applying this filter."),
          )
        : repository.query(query, signal),
    JSON.stringify(query),
    true,
  );
  const now = useEventClock(resource.data?.data ?? []);
  const results = uniqueEvents(resource.data?.data ?? []).filter(
    (event) =>
      Date.parse(event.startsAt) >= now &&
      event.occurrenceStatus !== "canceled" &&
      !event.reviewRequired,
  );
  useEffect(() => {
    if (resource.data) remember(resource.data.data);
  }, [resource.data, remember]);
  const hasFilters =
    filters.query ||
    filters.categories.length ||
    filters.date !== "all" ||
    filters.availability;
  const scheduleReady = validAvailability(preferences);
  return (
    <>
      <PageHeading eyebrow="DISCOVER CAMPUS LIFE" title="Explore events">
        Find campus experiences that fit your interests and schedule.
      </PageHeading>
      <div className="explore-controls">
        <label className="search-field">
          <span aria-hidden="true">⌕</span>
          <span className="sr-only">Search campus events</span>
          <input
            type="search"
            maxLength={200}
            placeholder="Search campus events"
            value={filters.query}
            onChange={(e) => update("q", e.target.value)}
          />
        </label>
        <details
          className="all-filters"
          open={params.get("filters") === "open"}
        >
          <summary
            onClick={(e) => {
              e.preventDefault();
              update("filters", params.get("filters") === "open" ? "" : "open");
            }}
          >
            <span className="section-label">BROWSE BY INTEREST</span>
            <span className="text-link">
              {params.get("filters") === "open"
                ? "Close filters ×"
                : "All filters →"}
            </span>
          </summary>
          <fieldset className="filter-panel">
            <legend className="sr-only">All interest filters</legend>
            <p className="small muted mb-3">
              Choose multiple interests. Events can match any selected interest.
            </p>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {categories.map(({ name: category }) => (
                <Choice
                  key={category}
                  selected={filters.categories.includes(category)}
                  onClick={() => toggleCategory(category)}
                >
                  {category}
                </Choice>
              ))}
            </div>
          </fieldset>
        </details>
        <div
          className="quick-filters"
          role="group"
          aria-label="Quick interest filters"
        >
          <button
            className={`filter-chip ${!filters.categories.length ? "active" : ""}`}
            aria-pressed={!filters.categories.length}
            onClick={() => update("category", [])}
          >
            All
          </button>
          {quickCategories.map(({ label, category }) => (
            <button
              key={category}
              className={`filter-chip ${filters.categories.includes(category) ? "active" : ""}`}
              aria-pressed={filters.categories.includes(category)}
              onClick={() => toggleCategory(category)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="filter-selects">
          <label>
            <span className="sr-only">Date filter</span>
            <select
              value={filters.date}
              onChange={(e) => update("date", e.target.value)}
            >
              <option value="all">Any date</option>
              <option value="today">Today</option>
              <option value="week">This week</option>
              <option value="next-week">Next week</option>
            </select>
          </label>
          <label>
            <span className="sr-only">Availability filter</span>
            <select
              value={filters.availability ? "mine" : ""}
              onChange={(e) => update("availability", e.target.value)}
            >
              <option value="">Any availability</option>
              <option value="mine" disabled={!scheduleReady}>
                Fits my availability
              </option>
            </select>
          </label>
        </div>
        {!scheduleReady && (
          <p className="small muted">
            <Link
              className="text-link underlined"
              to="/onboarding/availability"
            >
              Set availability
            </Link>{" "}
            to filter by your schedule.
          </p>
        )}
        {hasFilters && (
          <div className="active-filters">
            <span className="small muted">
              {filters.categories.length
                ? filters.categories.join(" · ")
                : "All interests"}{" "}
              ·{" "}
              {filters.date === "all"
                ? "Any date"
                : filters.date.replace("-", " ")}
            </span>
            <button className="text-link" onClick={() => setParams({})}>
              Clear all ×
            </button>
          </div>
        )}
      </div>
      <EventStatus state={resource}>
        <div className="section-row result-summary" aria-live="polite">
          <h2>
            {resource.data?.meta.total ?? 0}{" "}
            {(resource.data?.meta.total ?? 0) === 1 ? "event" : "events"}
          </h2>
          <label>
            <span className="sr-only">Sort events</span>
            <select
              value={filters.sort}
              onChange={(e) => update("sort", e.target.value)}
            >
              <option value="soonest">Soonest first</option>
              <option value="latest">Latest first</option>
            </select>
          </label>
        </div>
        {results.length ? (
          <div className="event-grid">
            {results.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <EmptyState
            title={
              hasFilters
                ? "No events match just yet"
                : "No events available yet"
            }
            action={
              <button className="button primary" onClick={() => setParams({})}>
                Clear search and filters →
              </button>
            }
          >
            Try another search or loosen a filter to see more events.
          </EmptyState>
        )}
        {resource.data && resource.data.meta.totalPages > 1 && (
          <nav className="pagination" aria-label="Event pages">
            <button
              className="button secondary"
              disabled={page <= 1}
              onClick={() => update("page", String(page - 1))}
            >
              ← Previous
            </button>
            <span>
              Page {page} of {resource.data.meta.totalPages}
            </span>
            <button
              className="button secondary"
              disabled={page >= resource.data.meta.totalPages}
              onClick={() => update("page", String(page + 1))}
            >
              Next →
            </button>
          </nav>
        )}
      </EventStatus>
      <TestNotice />
    </>
  );
}
