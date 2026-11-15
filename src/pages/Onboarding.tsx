import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../context/AppContext";
import { Choice, Progress } from "../components/ui";
import { DAYS, PERIODS, type Period } from "../types";
import { validAvailability } from "../lib/events";
const toggle = <T,>(values: T[], value: T) =>
  values.includes(value)
    ? values.filter((x) => x !== value)
    : [...values, value];

export function Interests() {
  const {
    preferences: p,
    setPreferences,
    categories,
    categoriesLoading,
    categoriesError,
    refreshCategories,
  } = useApp();
  const [error, setError] = useState(false);
  const errorRef = useRef<HTMLParagraphElement>(null);
  const navigate = useNavigate();
  return (
    <form
      className="onboarding-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (!p.interests.length) {
          setError(true);
          requestAnimationFrame(() => errorRef.current?.focus());
        } else navigate("/onboarding/availability");
      }}
    >
      <div className="onboarding-content">
        <Progress step={1} />
        <div className="onboarding-heading">
          <h1>What are you into?</h1>
          <p className="intro">
            Choose what interests you. We’ll use this to find campus events
            worth checking out.
          </p>
        </div>
        {categoriesLoading && (
          <p role="status" className="small muted">
            Loading interests…
          </p>
        )}
        {categoriesError && (
          <p role="alert" className="small muted">
            {categoriesError}{" "}
            <button
              type="button"
              className="text-link"
              onClick={refreshCategories}
            >
              Try again
            </button>
          </p>
        )}
        <fieldset aria-describedby="interest-help">
          <legend className="section-label">CHOOSE YOUR INTERESTS</legend>
          <p id="interest-help" className="sr-only">
            Choose at least one. You can select multiple interests.
          </p>
          <div className="grid grid-cols-2 gap-2.5 interest-grid">
            {categories.map(({ name: interest }) => (
              <Choice
                key={interest}
                selected={p.interests.includes(interest)}
                onClick={() => {
                  setPreferences({
                    ...p,
                    interests: toggle(p.interests, interest),
                  });
                  setError(false);
                }}
              >
                {interest}
              </Choice>
            ))}
          </div>
        </fieldset>
        <div className="selection-summary" aria-live="polite">
          <p className="eyebrow">SELECTED INTERESTS · {p.interests.length}</p>
          <p>
            {p.interests.length
              ? p.interests.join(" · ")
              : "Choose at least one interest to get started."}
          </p>
        </div>
        {error && (
          <p className="validation" role="alert" tabIndex={-1} ref={errorRef}>
            Choose at least one interest to continue.
          </p>
        )}
      </div>
      <div className="onboarding-footer">
        <button className="button primary" type="submit">
          Continue to availability <span aria-hidden="true">→</span>
        </button>
        <p>No account needed. You can change these later.</p>
      </div>
    </form>
  );
}
const helpers: Record<Period, string> = {
  Morning: "Before 12 PM",
  Afternoon: "12 PM – 5 PM",
  Evening: "5 PM and later",
};
export function Availability() {
  const { preferences: p, setPreferences } = useApp();
  const navigate = useNavigate();
  const [error, setError] = useState("");
  const errorRef = useRef<HTMLParagraphElement>(null);
  function submit() {
    if (!p.interests.length) {
      navigate("/onboarding/interests");
      return;
    }
    if (!validAvailability(p)) {
      setError(
        "Select at least one day and a time, or choose No schedule preference.",
      );
      requestAnimationFrame(() => errorRef.current?.focus());
      return;
    }
    navigate("/recommendations");
  }
  return (
    <form
      className="onboarding-form"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="onboarding-content">
        <Progress step={2} />
        <div className="onboarding-heading">
          <h1>When are you free?</h1>
          <p className="intro">
            Pick the days and times that usually work for you. We’ll tailor
            recommendations to your schedule.
          </p>
        </div>
        <fieldset>
          <legend className="section-label">PREFERRED DAYS</legend>
          <div className="days-grid">
            {DAYS.map((day) => (
              <Choice
                className="day-choice"
                key={day}
                selected={p.days.includes(day)}
                onClick={() => {
                  setPreferences({
                    ...p,
                    days: toggle(p.days, day),
                    noSchedulePreference: false,
                  });
                  setError("");
                }}
              >
                {day}
              </Choice>
            ))}
          </div>
        </fieldset>
        <fieldset className="time-fieldset">
          <legend className="section-label">PREFERRED TIME</legend>
          <div className="grid grid-cols-2 gap-2.5">
            {PERIODS.map((period) => (
              <Choice
                key={period}
                className="time-choice"
                selected={!p.anyTime && p.periods.includes(period)}
                onClick={() => {
                  setPreferences({
                    ...p,
                    periods: p.anyTime ? [period] : toggle(p.periods, period),
                    anyTime: false,
                    noSchedulePreference: false,
                  });
                  setError("");
                }}
              >
                <strong>{period}</strong>
                <span>{helpers[period]}</span>
              </Choice>
            ))}
            <Choice
              className="time-choice"
              selected={p.anyTime}
              onClick={() => {
                setPreferences({
                  ...p,
                  anyTime: !p.anyTime,
                  noSchedulePreference: false,
                });
                setError("");
              }}
            >
              <strong>Any time</strong>
              <span>On selected days</span>
            </Choice>
          </div>
        </fieldset>
        <Choice
          className="no-preference"
          selected={p.noSchedulePreference}
          onClick={() => {
            setPreferences({
              ...p,
              noSchedulePreference: !p.noSchedulePreference,
            });
            setError("");
          }}
        >
          <strong>No schedule preference</strong>
          <span>Ignore day and time filters</span>
        </Choice>
        <div className="note availability-summary" aria-live="polite">
          <p className="eyebrow">YOUR AVAILABILITY</p>
          <p>
            <span>DAYS</span>
            {p.noSchedulePreference
              ? "Any day"
              : p.days.length
                ? DAYS.filter((d) => p.days.includes(d)).join(", ")
                : "Choose days"}
          </p>
          <p>
            <span>TIME</span>
            {p.noSchedulePreference || p.anyTime
              ? "Any time"
              : p.periods.length
                ? PERIODS.filter((t) => p.periods.includes(t)).join(", ")
                : "Choose times"}
          </p>
          <p className="tiny muted">
            All times are Central Time. Matches use the event’s start time.
          </p>
        </div>
        {error && (
          <p className="validation" role="alert" tabIndex={-1} ref={errorRef}>
            {error}
          </p>
        )}
      </div>
      <div className="onboarding-footer">
        <button className="button primary" type="submit">
          Show my Top 3 <span aria-hidden="true">→</span>
        </button>
        <p>You can adjust your schedule at any time.</p>
      </div>
    </form>
  );
}
