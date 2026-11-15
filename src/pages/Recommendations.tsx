import { useEffect } from "react";
import { useEventClock } from "../hooks/useEventClock";
import { uniqueEvents } from "../../shared/quality";
import { useResource } from "../hooks/useResource";
import { Link } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { EventCard } from "../components/EventCard";
import {
  EmptyState,
  EventStatus,
  PageHeading,
  PreferencesNeeded,
  TestNotice,
} from "../components/ui";
import { validAvailability } from "../lib/events";
export default function Recommendations() {
  const { repository, remember, preferences: p } = useApp();
  const ready = p.interests.length > 0;
  const hasSchedule = validAvailability(p);
  const effective = hasSchedule ? p : { ...p, noSchedulePreference: true };
  const resource = useResource(
    (signal) =>
      ready
        ? repository.recommendations(effective, signal)
        : Promise.resolve([]),
    JSON.stringify(effective),
    true,
  );
  const now = useEventClock((resource.data ?? []).map((r) => r.event));
  const unique = uniqueEvents((resource.data ?? []).map((r) => r.event));
  const ids = new Set(unique.map((e) => e.id));
  const results = (resource.data ?? [])
    .filter(
      (r) =>
        ids.delete(r.event.id) &&
        Date.parse(r.event.startsAt) >= now &&
        r.event.occurrenceStatus !== "canceled" &&
        !r.event.reviewRequired,
    )
    .slice(0, 3);
  useEffect(() => {
    if (resource.data) remember(resource.data.map((r) => r.event));
  }, [resource.data, remember]);
  return (
    <>
      <PageHeading
        eyebrow="YOUR PERSONAL CAMPUS GUIDE"
        title="Your first 3 campus experiences"
      >
        A few places to start, picked around your interests and schedule.
      </PageHeading>
      {!ready ? (
        <PreferencesNeeded />
      ) : (
        <>
          {!hasSchedule && (
            <div className="note mb-3">
              <p>
                No availability selected. These recommendations match your
                interests across all schedules.
              </p>
              <Link className="text-link" to="/onboarding/availability">
                Add availability →
              </Link>
            </div>
          )}
          <div className="preference-chips">
            <Link to="/onboarding/interests" aria-label="Edit interests">
              {p.interests.join(" · ")}
            </Link>
            <Link to="/onboarding/availability" aria-label="Edit availability">
              {!hasSchedule || p.noSchedulePreference
                ? "No schedule preference"
                : `${p.days.join(", ")} · ${p.anyTime ? "Any time" : p.periods.join(", ")}`}
            </Link>
          </div>
          <div className="section-row">
            <h2 className="section-label">RECOMMENDED FOR YOU</h2>
            <Link className="text-link" to="/onboarding/interests">
              Edit →
            </Link>
          </div>
          <EventStatus state={resource}>
            {results.length ? (
              <>
                <div className="event-grid recommendation-grid">
                  {results.map((r, i) => (
                    <EventCard
                      key={r.event.id}
                      event={r.event}
                      rank={i + 1}
                      reason={r.reason}
                    />
                  ))}
                </div>
                {results.length < 3 && (
                  <p className="muted small mt-3">
                    We found {results.length} matching{" "}
                    {results.length === 1 ? "event" : "events"}. Adjust your
                    preferences or explore all events for more options.
                  </p>
                )}
              </>
            ) : (
              <EmptyState
                title="No matching events yet"
                action={
                  <Link className="button secondary" to="/onboarding/interests">
                    Adjust my preferences →
                  </Link>
                }
              >
                No upcoming events match both your interests and availability.
                Try another day or a broader schedule.
              </EmptyState>
            )}
          </EventStatus>
        </>
      )}
      <Link to="/explore" className="button secondary mt-4">
        Explore all campus events <span aria-hidden="true">→</span>
      </Link>
      <TestNotice />
    </>
  );
}
