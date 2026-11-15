import { useEffect } from "react";
import { useResource } from "../hooks/useResource";
import { Link, useParams } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { SaveButton } from "../components/Layout";
import { EmptyState, EventStatus, TestNotice } from "../components/ui";
import {
  dateParts,
  formatEventDate,
  formatEventTime,
  officialUrl,
  validAvailability,
} from "../lib/events";
export default function EventDetails() {
  const { id } = useParams();
  const { repository, remember, forget, preferences } = useApp();
  const resource = useResource((signal) => repository.get(id!, signal), id!);
  const reasonResource = useResource(
    (signal) =>
      preferences.interests.length
        ? repository.recommendations(
            validAvailability(preferences)
              ? preferences
              : { ...preferences, noSchedulePreference: true },
            signal,
          )
        : Promise.resolve([]),
    JSON.stringify(preferences),
    true,
  );
  const event = resource.data;
  useEffect(() => {
    if (resource.data) remember([resource.data]);
    else if (!resource.loading && !resource.error) forget(id!);
  }, [resource.data, resource.loading, resource.error, remember, forget, id]);
  if (resource.loading || resource.error)
    return <EventStatus state={resource}>{null}</EventStatus>;
  if (!event)
    return (
      <EventStatus state={resource}>
        <EmptyState
          title="Event not found"
          action={
            <Link className="button primary" to="/explore">
              Explore events →
            </Link>
          }
        >
          This event may no longer be available. Browse the event catalog to
          find another opportunity.
        </EmptyState>
      </EventStatus>
    );
  const match = reasonResource.data?.find((r) => r.event.id === event.id);
  const url = officialUrl(event);
  const verified = !event.fictional && event.source.verified;
  return (
    <div className="event-details">
      {event.occurrenceStatus === "canceled" && (
        <div className="event-warning" role="status">
          <strong>This event has been canceled.</strong>
          <p>{event.changeNote}</p>
        </div>
      )}
      {event.reviewRequired && (
        <div className="note mb-4" role="status">
          <strong>Details need rechecking</strong>
          <p>
            The previous source check is out of date. Confirm current details on
            the official page.
          </p>
        </div>
      )}
      <div className="details-intro">
        <p className="eyebrow">
          {event.categories[0].toUpperCase()} ·{" "}
          {event.fictional ? "FICTIONAL TEST EVENT" : "CAMPUS EVENT"}
        </p>
        <h1>{event.title}</h1>
        <p className="intro">{event.description}</p>
        <div className="detail-tags">
          {event.categories.map((c) => (
            <span key={c}>{c}</span>
          ))}
          <span>{dateParts(event).period}</span>
          <span>
            {event.reviewRequired
              ? "Needs source recheck"
              : verified
                ? "Information verified"
                : "Information unverified"}
          </span>
        </div>
      </div>
      {url && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-link underlined source-link"
        >
          View official source (opens new tab) →
        </a>
      )}
      {event.changeNote && event.occurrenceStatus !== "canceled" && (
        <p className="note mt-4">Updated: {event.changeNote}</p>
      )}
      <section>
        <h2>Event information</h2>
        <dl className="info-card">
          <div>
            <dt>DATE & TIME</dt>
            <dd>
              <strong>{formatEventDate(event, true)}</strong>
              <p>{formatEventTime(event)} · Central Time</p>
            </dd>
          </div>
          <div>
            <dt>LOCATION</dt>
            <dd>
              <strong>{event.location}</strong>
              <p>
                {event.fictional
                  ? "Illustrative location, not a confirmed room"
                  : "Check the official listing for room details"}
              </p>
            </dd>
          </div>
          <div>
            <dt>ORGANIZER</dt>
            <dd>
              <strong>{event.organizer}</strong>
              <p>
                {verified
                  ? "See source for organizer details"
                  : "Organizer information is not verified"}
              </p>
            </dd>
          </div>
        </dl>
      </section>
      <section>
        <h2>
          {match
            ? "Why this was recommended"
            : "How this fits your preferences"}
        </h2>
        <div className="note">
          <p>
            {match?.reason ??
              (preferences.interests.length
                ? "Explore this event’s date and details against your schedule. Your Top 3 page explains personalized recommendations."
                : "Set your interests and availability to see how this event fits.")}
          </p>
          <Link className="text-link" to="/onboarding/interests">
            Edit my preferences →
          </Link>
        </div>
      </section>
      {event.newcomer && (
        <section>
          <h2>New here? Know before you go.</h2>
          <div className="newcomer-panel">
            <div className="section-row">
              <strong>
                {event.newcomer.friendly
                  ? "Newcomer-friendly"
                  : "Attendance information"}
              </strong>
              <span className="tag">
                {event.fictional ? "Sample data only" : "Source provided"}
              </span>
            </div>
            <p>{event.newcomer.details}</p>
            <p className="tiny muted">{event.newcomer.evidence}</p>
          </div>
        </section>
      )}
      <section>
        <h2 className="expect-heading">What to expect</h2>
        <p className="small muted">
          {event.whatToExpect ??
            "Attendance details have not been provided by the organizer."}
        </p>
      </section>
      {event.registration && (
        <section>
          <h2>Registration</h2>
          <p className="small muted">{event.registration.details}</p>
          <a
            href={event.registration.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-link underlined"
          >
            Verified registration information →
          </a>
        </section>
      )}
      <section id="event-source">
        <h2>Official event source</h2>
        <p className="small muted">{event.source.name}</p>
        {event.lastVerifiedAt && (
          <p className="small muted">
            Last verified:{" "}
            {new Intl.DateTimeFormat("en-US", {
              timeZone: "America/Chicago",
              dateStyle: "medium",
            }).format(new Date(event.lastVerifiedAt))}
          </p>
        )}
        <p className="small muted mt-2">
          {event.fictional
            ? "This is a fictional example. No official event page exists, and the information has not been verified by UT Dallas. Do not use this listing to make attendance plans."
            : verified
              ? "Event information has been checked against the source. Confirm current details before attending."
              : "Event information is unverified. Confirm details with the organizer before attending."}
        </p>
      </section>
      <div className="details-footer">
        {url ? (
          <a
            className="button primary"
            href={url}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open official event page →
          </a>
        ) : (
          <a href="#event-source" className="button primary">
            Why no official event link? →
          </a>
        )}
        <SaveButton id={event.id} title={event.title} full />
        <TestNotice />
      </div>
    </div>
  );
}
