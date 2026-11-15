import { useEffect } from "react";
import { useEventClock } from "../hooks/useEventClock";
import { useResource } from "../hooks/useResource";
import { Link } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { EventCard } from "../components/EventCard";
import { EventStatus, PageHeading, TestNotice } from "../components/ui";
export default function Plan() {
  const { repository, remember, saved } = useApp();
  const resource = useResource(
    async (signal) =>
      Promise.all(saved.map((id) => repository.get(id, signal))),
    JSON.stringify(saved),
    true,
  );
  const events = (resource.data ?? []).filter(
    (e): e is NonNullable<typeof e> => e !== null,
  );
  const { loading, error } = resource;
  useEffect(() => {
    if (resource.data)
      remember(
        resource.data.filter((e): e is NonNullable<typeof e> => e !== null),
      );
  }, [resource.data, remember]);
  const now = useEventClock(events);
  const savedEvents = events
    .filter((e) => saved.includes(e.id))
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const upcoming = savedEvents.filter(
    (e) => Date.parse(e.endsAt) > now && e.occurrenceStatus !== "canceled",
  );
  const past = savedEvents.filter(
    (e) => Date.parse(e.endsAt) <= now && e.occurrenceStatus !== "canceled",
  );
  const canceled = savedEvents.filter((e) => e.occurrenceStatus === "canceled");
  const missing = saved.filter((id) => !events.some((e) => e.id === id));
  return (
    <>
      <PageHeading eyebrow="YOUR PERSONAL CAMPUS PLAN" title="My Campus Plan">
        Your saved opportunities, organized in one place.
      </PageHeading>
      <div className="note plan-note">
        <strong>Saved on this device</strong>
        <p>Your plan stays in this browser. No account required.</p>
      </div>
      <button className="text-link" onClick={resource.retry} disabled={loading}>
        Refresh saved events →
      </button>
      <EventStatus state={resource}>
        <div className="section-row plan-section">
          <h2>Upcoming events</h2>
          <span className="tag">{upcoming.length} saved</span>
        </div>
        {upcoming.length ? (
          <div className="event-grid">
            {upcoming.map((event) => (
              <EventCard key={event.id} event={event} removable />
            ))}
          </div>
        ) : (
          <p className="muted plan-empty">
            {saved.length
              ? "No upcoming events saved."
              : "No events saved yet."}
            <br />
            Find an event and tap Save to add it here.
          </p>
        )}
        {canceled.length > 0 && (
          <>
            <h2 className="plan-section">Canceled events</h2>
            <div className="event-grid">
              {canceled.map((event) => (
                <EventCard key={event.id} event={event} removable />
              ))}
            </div>
          </>
        )}
        {past.length > 0 && (
          <>
            <h2 className="plan-section">Past events</h2>
            <div className="event-grid">
              {past.map((event) => (
                <EventCard key={event.id} event={event} removable />
              ))}
            </div>
          </>
        )}
      </EventStatus>
      {!loading && !error && missing.length > 0 && (
        <UnavailableSaved ids={missing} />
      )}
      <Link className="button secondary mt-4" to="/explore">
        Explore more campus events <span aria-hidden="true">→</span>
      </Link>
      <TestNotice />
    </>
  );
}
function UnavailableSaved({ ids }: { ids: string[] }) {
  const { toggleSave } = useApp();
  return (
    <section className="note mt-4">
      <h2 className="small">Unavailable saved events</h2>
      <p className="small muted">
        These listings are currently unavailable. Your saves are kept so they
        can reappear if republished.
      </p>
      {ids.map((id, i) => (
        <div className="section-row" key={id}>
          <span className="small">Unavailable event {i + 1}</span>
          <button className="text-link" onClick={() => toggleSave(id)}>
            Remove
          </button>
        </div>
      ))}
    </section>
  );
}
