import { Link, useLocation } from "react-router-dom";
import type { CampusEvent } from "../types";
import { CAMPUS_ZONE, formatEventDate, formatEventTime } from "../lib/events";
import { SaveButton } from "./Layout";
export function EventCard({
  event,
  rank,
  reason,
  removable = false,
}: {
  event: CampusEvent;
  rank?: number;
  reason?: string;
  removable?: boolean;
}) {
  const { pathname, search } = useLocation();
  const date = new Date(event.startsAt);
  const day = new Intl.DateTimeFormat("en-US", {
    timeZone: CAMPUS_ZONE,
    day: "2-digit",
  }).format(date);
  const month = new Intl.DateTimeFormat("en-US", {
    timeZone: CAMPUS_ZONE,
    month: "short",
  })
    .format(date)
    .toUpperCase();
  return (
    <article
      className={`event-card ${rank ? "recommendation-card" : ""}`}
      aria-labelledby={`event-${event.id}`}
    >
      <div className="card-top">
        {rank ? (
          <span className="rank">{String(rank).padStart(2, "0")}</span>
        ) : (
          <div className="date-badge" aria-hidden="true">
            <strong>{day}</strong>
            <span>{month}</span>
          </div>
        )}
        <div className="card-title">
          <h3 id={`event-${event.id}`}>
            <Link
              to={`/events/${event.id}`}
              state={{ from: pathname + search }}
            >
              {event.title}
            </Link>
          </h3>
          {!rank && <p>{event.categories[0]}</p>}
        </div>
        {rank && <SaveButton id={event.id} title={event.title} />}
      </div>
      <p className="event-time">
        {formatEventDate(event)} · {formatEventTime(event)}
      </p>
      <p className="event-location">{event.location}</p>
      {event.occurrenceStatus === "canceled" && (
        <p className="event-warning">
          <strong>Canceled</strong>
          {event.changeNote ? ` · ${event.changeNote}` : ""}
        </p>
      )}
      {event.changeNote && event.occurrenceStatus !== "canceled" && (
        <p className="event-status">Updated: {event.changeNote}</p>
      )}
      <p className="event-status">
        {event.reviewRequired
          ? "Details need source rechecking"
          : event.fictional
            ? "Fictional test event · Unverified"
            : event.source.verified
              ? "Event information verified"
              : "Event information unverified"}
      </p>
      {reason && <p className="match-reason">{reason}</p>}
      <div className="card-actions">
        <Link
          to={`/events/${event.id}`}
          state={{ from: pathname + search }}
          aria-label={`View details for ${event.title}`}
        >
          View event details <span aria-hidden="true">→</span>
        </Link>
        {!rank && (
          <SaveButton id={event.id} title={event.title} remove={removable} />
        )}
      </div>
    </article>
  );
}
