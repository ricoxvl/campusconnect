import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export function PageHeading({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      {children && <p className="intro">{children}</p>}
    </div>
  );
}
export function TestNotice() {
  return (
    <p className="test-notice">
      Independent student project · Fictional examples are labeled
    </p>
  );
}
export function Progress({ step }: { step: 1 | 2 }) {
  return (
    <div className="progress" aria-label={`Step ${step} of 2`}>
      <p className="eyebrow">STEP {step} OF 2</p>
      <div>
        <span className="complete" />
        <span className={step === 2 ? "complete" : ""} />
      </div>
    </div>
  );
}
export function Choice({
  selected,
  children,
  onClick,
  className = "",
}: {
  selected: boolean;
  children: ReactNode;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={`choice ${selected ? "selected" : ""} ${className}`}
      onClick={onClick}
    >
      {children}
      {selected && (
        <span className="choice-check" aria-hidden="true">
          ✓
        </span>
      )}
    </button>
  );
}
export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon" aria-hidden="true">
        ⌕
      </span>
      <h2>{title}</h2>
      <p className="muted">{children}</p>
      {action}
    </div>
  );
}
export function EventStatus({
  children,
  state,
}: {
  children: ReactNode;
  state: { loading: boolean; error: string | null; retry: () => void };
}) {
  if (state.loading)
    return (
      <div role="status" aria-live="polite" className="loading-state">
        <p>Loading events…</p>
        <div className="skeleton" />
        <div className="skeleton" />
      </div>
    );
  if (state.error)
    return (
      <EmptyState
        title="Events couldn’t load"
        action={
          <button className="button primary" onClick={state.retry}>
            Try again →
          </button>
        }
      >
        {state.error}
      </EmptyState>
    );
  return children;
}
export function PreferencesNeeded() {
  return (
    <EmptyState
      title="Let’s find your starting point"
      action={
        <Link className="button primary" to="/onboarding/interests">
          Choose my preferences →
        </Link>
      }
    >
      Choose your interests and availability to get personalized
      recommendations.
    </EmptyState>
  );
}
