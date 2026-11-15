import { useEffect, useState, useRef, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { apiRequest } from "../services/eventRepository";
import { useResource } from "../hooks/useResource";
import { AdminImport } from "../components/AdminImport";
import { PageHeading } from "../components/ui";
import type { Category, Organizer, PageMeta } from "../types";
import type { EventInput } from "../../worker/validation";
type AdminEvent = EventInput & {
  id: string;
  updatedAt?: string;
  qualityFlags?: string[];
};
type Mode = "events" | "categories" | "organizers" | "import";
export default function Admin() {
  const [entry, setEntry] = useState(""),
    [token, setToken] = useState<string>(),
    [mode, setMode] = useState<Mode>("events");
  const session = useResource(
    () =>
      apiRequest<{ data: { identity: string } }>("/admin/session", {}, token),
    token ?? "access",
  );
  return (
    <>
      <PageHeading
        eyebrow="ADMINISTRATOR WORKSPACE"
        title="Manage campus events"
      >
        Review sources and verification before publishing.
      </PageHeading>
      {session.loading ? (
        <p role="status">Checking administrator access…</p>
      ) : session.error ? (
        <div className="note admin-login">
          <p>
            Administrator access is required. Production uses Cloudflare Access.
          </p>
          <p className="small muted">
            For local development, enter the token from your private .dev.vars
            file. It stays in memory for this visit.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (entry === token) session.retry();
              else setToken(entry);
              setEntry("");
            }}
          >
            <label>
              Local development token
              <input
                type="password"
                autoComplete="off"
                value={entry}
                onChange={(e) => setEntry(e.target.value)}
                required
              />
            </label>
            <button className="button primary" type="submit">
              Connect local session
            </button>
          </form>
          <p role="alert" className="small muted">
            {session.error}
          </p>
          <button className="text-link" onClick={session.retry}>
            Retry Access session
          </button>
        </div>
      ) : (
        <>
          <p className="small muted">
            Signed in: {session.data?.data.identity}
          </p>
          <nav className="admin-tabs" aria-label="Event management">
            <button
              className="filter-chip"
              aria-pressed={mode === "events"}
              onClick={() => setMode("events")}
            >
              Events
            </button>
            <button
              className="filter-chip"
              aria-pressed={mode === "categories"}
              onClick={() => setMode("categories")}
            >
              Categories
            </button>
            <button
              className="filter-chip"
              aria-pressed={mode === "organizers"}
              onClick={() => setMode("organizers")}
            >
              Organizers
            </button>
            <button
              className="filter-chip"
              aria-pressed={mode === "import"}
              onClick={() => setMode("import")}
            >
              CSV import
            </button>
            <button className="text-link" onClick={() => setToken(undefined)}>
              Clear local session
            </button>
          </nav>
          {mode === "import" ? (
            <AdminImport token={token} onReview={() => setMode("events")} />
          ) : mode === "events" ? (
            <EventManager token={token} />
          ) : (
            <MetadataManager key={mode} kind={mode} token={token} />
          )}
        </>
      )}
      <Link to="/explore" className="text-link mt-4">
        Return to student events →
      </Link>
    </>
  );
}
function EventManager({ token }: { token?: string }) {
  const confirmRef = useRef<HTMLElement>(null);
  const [revision, setRevision] = useState(0),
    [page, setPage] = useState(1),
    [view, setView] = useState("all"),
    [search, setSearch] = useState(""),
    [editing, setEditing] = useState<AdminEvent | null>(),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [pending, setPending] = useState<{
      event: AdminEvent;
      status: "published" | "draft" | "archived";
    }>();
  const events = useResource(
    () =>
      apiRequest<{
        data: AdminEvent[];
        meta: PageMeta;
        summary?: {
          total: number;
          review: number;
          duplicates: number;
          expired: number;
          canceled: number;
        };
      }>(
        `/admin/events?page=${page}&pageSize=20&view=${view}&q=${encodeURIComponent(search)}`,
        {},
        token,
      ),
    `${token}:${revision}:${page}:${view}:${search}`,
  );
  const categories = useResource(
    () => apiRequest<{ data: Category[] }>("/admin/categories", {}, token),
    `${token}:${revision}`,
  );
  const organizers = useResource(
    () => apiRequest<{ data: Organizer[] }>("/admin/organizers", {}, token),
    `${token}:${revision}`,
  );
  useEffect(() => {
    if (pending) confirmRef.current?.focus();
  }, [pending]);
  async function apply() {
    if (!pending) return;
    setBusy(true);
    setError("");
    try {
      await apiRequest(
        `/admin/events/${pending.event.id}`,
        pending.status === "archived"
          ? { method: "DELETE" }
          : {
              method: "PATCH",
              body: JSON.stringify({ status: pending.status }),
            },
        token,
      );
      setMessage(
        pending.status === "published"
          ? "Event published."
          : pending.status === "draft"
            ? "Event unpublished. Saved bookmarks will show it as unavailable."
            : "Event archived. It is no longer publicly available.",
      );
      setPending(undefined);
      setRevision((n) => n + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (editing !== undefined)
    return (
      <EventEditor
        key={editing?.id ?? "new"}
        event={editing}
        categories={categories.data?.data ?? []}
        organizers={organizers.data?.data ?? []}
        token={token}
        cancel={() => setEditing(undefined)}
        saved={() => {
          setEditing(undefined);
          setRevision((n) => n + 1);
          setMessage("Event saved.");
        }}
      />
    );
  return (
    <section className="admin-section">
      <div className="section-row">
        <h2>Events</h2>
        <button
          className="button primary admin-inline"
          onClick={() => setEditing(null)}
        >
          Create event
        </button>
      </div>
      {events.data?.summary && (
        <div className="quality-summary" aria-label="Event quality summary">
          <span>{events.data.summary.review} need review</span>
          <span>{events.data.summary.duplicates} duplicates</span>
          <span>{events.data.summary.expired} expired</span>
          <span>{events.data.summary.canceled} canceled</span>
        </div>
      )}
      <div className="admin-columns mt-4">
        <label className="admin-control-label">
          Review queue
          <select
            value={view}
            onChange={(e) => {
              setView(e.target.value);
              setPage(1);
            }}
          >
            {[
              ["all", "All events"],
              ["review", "Needs review"],
              ["duplicates", "Duplicates"],
              ["expired", "Expired"],
              ["canceled", "Canceled"],
              ["draft", "Drafts"],
              ["published", "Published"],
              ["archived", "Archived"],
            ].map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="admin-control-label">
          Search managed events
          <input
            type="search"
            value={search}
            maxLength={200}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </label>
      </div>
      <p role="status" className="small muted mt-3">
        {message}
      </p>
      {error && (
        <p role="alert" className="validation">
          {error}
        </p>
      )}
      {pending && (
        <section
          ref={confirmRef}
          tabIndex={-1}
          className="note action-confirmation"
          aria-label="Confirm event action"
        >
          <h3>
            {pending.status === "published"
              ? "Review before publishing"
              : pending.status === "draft"
                ? "Unpublish this event?"
                : "Archive this event?"}
          </h3>
          <p className="small">{pending.event.title}</p>
          {pending.event.source.url && (
            <a
              href={pending.event.source.url}
              className="text-link underlined"
              target="_blank"
              rel="noopener noreferrer"
            >
              Open official source (opens new tab)
            </a>
          )}
          <p className="small muted">
            {pending.status === "published"
              ? "Confirm the listed details still match the source. Server verification and duplicate checks apply."
              : "This removes the listing from public discovery. Existing bookmarks are retained."}
          </p>
          <div className="section-row">
            <button className="button primary" disabled={busy} onClick={apply}>
              {busy
                ? "Updating…"
                : pending.status === "published"
                  ? "Confirm publication"
                  : pending.status === "draft"
                    ? "Confirm unpublish"
                    : "Confirm archive"}
            </button>
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setPending(undefined)}
            >
              Cancel action
            </button>
          </div>
        </section>
      )}
      {events.loading ? (
        <p role="status">Loading events…</p>
      ) : events.error ? (
        <div role="alert">
          {events.error}
          <button className="text-link" onClick={events.retry}>
            Try again
          </button>
        </div>
      ) : (
        <>
          <div className="admin-list">
            {events.data?.data.map((event) => (
              <article className="note" key={event.id}>
                <div className="section-row">
                  <h3>{event.title}</h3>
                  <span className="tag">{event.status}</span>
                </div>
                <p className="small muted">
                  {event.fictional
                    ? "Fictional test event"
                    : event.verification.status}{" "}
                  · {event.startsAt}
                </p>
                <div className="detail-tags">
                  {event.qualityFlags?.map((flag) => (
                    <span key={flag}>{flag.replaceAll("-", " ")}</span>
                  ))}
                </div>
                <div className="admin-event-actions">
                  <button
                    className="text-link"
                    onClick={() => {
                      setEditing(event);
                      setPending(undefined);
                    }}
                    aria-label={`Edit ${event.title}`}
                  >
                    Review / edit details
                  </button>
                  {event.status === "published" ? (
                    <button
                      className="text-link"
                      onClick={() => setPending({ event, status: "draft" })}
                      aria-label={`Unpublish ${event.title}`}
                    >
                      Unpublish
                    </button>
                  ) : (
                    <button
                      className="text-link"
                      disabled={event.qualityFlags?.some((flag) =>
                        [
                          "needs-verification",
                          "registration-recheck",
                          "expired",
                          "duplicate",
                          "canceled",
                        ].includes(flag),
                      )}
                      onClick={() => setPending({ event, status: "published" })}
                      aria-label={`Publish ${event.title}`}
                    >
                      Review & publish
                    </button>
                  )}
                  <button
                    className="text-link"
                    disabled={event.status === "archived"}
                    onClick={() => setPending({ event, status: "archived" })}
                    aria-label={`Archive ${event.title}`}
                  >
                    Archive
                  </button>
                </div>
              </article>
            ))}
          </div>
          {!events.data?.data.length && (
            <p className="small muted mt-3">
              No events in this queue. Try another view or add an event.
            </p>
          )}
          <div className="pagination">
            <button
              className="button secondary"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              ← Previous
            </button>
            <span>Page {page}</span>
            <button
              className="button secondary"
              disabled={page >= (events.data?.meta.totalPages ?? 0)}
              onClick={() => setPage((p) => p + 1)}
            >
              Next →
            </button>
          </div>
        </>
      )}
      <AuditTrail token={token} revision={revision} />
    </section>
  );
}
function AuditTrail({ token, revision }: { token?: string; revision: number }) {
  const [open, setOpen] = useState(false);
  const resource = useResource(
    () =>
      open
        ? apiRequest<{
            data: {
              actor: string;
              action: string;
              resourceId: string;
              happenedAt: number;
            }[];
          }>("/admin/audit", {}, token)
        : Promise.resolve({ data: [] }),
    `${open}:${revision}:${token}`,
  );
  return (
    <details className="audit-trail" open={open}>
      <summary
        onClick={(e) => {
          e.preventDefault();
          setOpen(!open);
        }}
      >
        Recent administrator activity
      </summary>
      {open &&
        (resource.loading ? (
          <p role="status">Loading activity…</p>
        ) : resource.error ? (
          <p role="alert">{resource.error}</p>
        ) : (
          <ul>
            {resource.data?.data.map((item, i) => (
              <li key={i}>
                <span>
                  {item.action} · {new Date(item.happenedAt).toLocaleString()}
                </span>
                <span className="tiny muted">
                  {item.actor} · {item.resourceId}
                </span>
              </li>
            ))}
          </ul>
        ))}
    </details>
  );
}

function blankEvent(
  categories: Category[],
  organizers: Organizer[],
): EventInput {
  return {
    title: "",
    description: "",
    categoryId: categories[0]?.id ?? "",
    interestIds: [],
    organizerId: organizers[0]?.id ?? "",
    startsAt: "",
    endsAt: "",
    location: "",
    source: { name: "", url: null },
    fictional: false,
    verification: {
      status: "unverified",
      lastVerifiedAt: null,
      evidence: null,
    },
    newcomer: { status: "unknown", details: null, evidence: null },
    registration: null,
    whatToExpect: null,
    status: "draft",
    occurrenceStatus: "scheduled",
    changeNote: null,
    registrationCandidate: null,
  };
}
function EventEditor({
  event,
  categories,
  organizers,
  token,
  cancel,
  saved,
}: {
  event: AdminEvent | null;
  categories: Category[];
  organizers: Organizer[];
  token?: string;
  cancel: () => void;
  saved: () => void;
}) {
  const [value, setValue] = useState<EventInput>(
    () => event ?? blankEvent(categories, organizers),
  );
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!event)
      setValue((v) => ({
        ...v,
        categoryId: v.categoryId || categories[0]?.id || "",
        organizerId: v.organizerId || organizers[0]?.id || "",
      }));
  }, [categories, organizers, event]);
  function change(patch: Partial<EventInput>) {
    setValue((v) => ({
      ...v,
      ...patch,
      verification: {
        ...(patch.verification ?? v.verification),
        status: "unverified",
        lastVerifiedAt: null,
      },
      registration: null,
      registrationCandidate:
        patch.registrationCandidate !== undefined
          ? patch.registrationCandidate
          : v.registration
            ? { url: v.registration.url, details: v.registration.details }
            : v.registrationCandidate,
    }));
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = Object.fromEntries(
        Object.entries(value).filter(
          ([key]) => !["id", "updatedAt", "qualityFlags"].includes(key),
        ),
      );
      await apiRequest(
        event ? `/admin/events/${event.id}` : "/admin/events",
        { method: event ? "PATCH" : "POST", body: JSON.stringify(body) },
        token,
      );
      saved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="admin-form" onSubmit={submit}>
      <div className="section-row">
        <h2>{event ? "Edit event" : "Create event"}</h2>
        <button type="button" className="text-link" onClick={cancel}>
          Cancel
        </button>
      </div>
      {!categories.length || !organizers.length ? (
        <p className="validation">
          Add a category and organizer in their management tabs before saving an
          event.
        </p>
      ) : null}
      <label>
        Title
        <input
          required
          maxLength={180}
          value={value.title}
          onChange={(e) => change({ title: e.target.value })}
        />
      </label>
      <label>
        Description
        <textarea
          required
          maxLength={10000}
          value={value.description}
          onChange={(e) => change({ description: e.target.value })}
        />
      </label>
      <div className="admin-columns">
        <label>
          Primary category
          <select
            required
            value={value.categoryId}
            onChange={(e) => change({ categoryId: e.target.value })}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Organizer
          <select
            required
            value={value.organizerId}
            onChange={(e) => change({ organizerId: e.target.value })}
          >
            {organizers.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <fieldset>
        <legend>Interest tags</legend>
        <div className="admin-checks">
          {categories
            .filter((c) => c.id !== value.categoryId)
            .map((c) => (
              <label key={c.id}>
                <input
                  type="checkbox"
                  checked={value.interestIds.includes(c.id)}
                  onChange={() =>
                    change({
                      interestIds: value.interestIds.includes(c.id)
                        ? value.interestIds.filter((id) => id !== c.id)
                        : [...value.interestIds, c.id],
                    })
                  }
                />
                {c.name}
              </label>
            ))}
        </div>
      </fieldset>
      <p className="small muted">
        Use ISO 8601 dates with a UTC offset, e.g. 2026-11-12T14:30:00-06:00.
        Student displays use America/Chicago.
      </p>
      <div className="admin-columns">
        <label>
          Start time (ISO 8601)
          <input
            required
            value={value.startsAt}
            onChange={(e) => change({ startsAt: e.target.value })}
          />
        </label>
        <label>
          End time (ISO 8601)
          <input
            required
            value={value.endsAt}
            onChange={(e) => change({ endsAt: e.target.value })}
          />
        </label>
      </div>
      <label>
        Location
        <input
          required
          maxLength={300}
          value={value.location}
          onChange={(e) => change({ location: e.target.value })}
        />
      </label>
      <label>
        Source name
        <input
          required
          value={value.source.name}
          onChange={(e) =>
            change({ source: { ...value.source, name: e.target.value } })
          }
        />
      </label>
      <label>
        Official source URL
        <input
          type="url"
          value={value.source.url ?? ""}
          onChange={(e) =>
            change({ source: { ...value.source, url: e.target.value || null } })
          }
        />
      </label>
      <label className="admin-checkbox">
        <input
          type="checkbox"
          checked={value.fictional}
          onChange={(e) =>
            change({
              fictional: e.target.checked,
              registration: null,
              registrationCandidate: null,
            })
          }
        />
        Fictional test example (include Sample, Fictional, or Test in title)
      </label>
      <label>
        Verification notes / evidence
        <textarea
          value={value.verification.evidence ?? ""}
          onChange={(e) =>
            change({
              verification: {
                ...value.verification,
                evidence: e.target.value || null,
              },
            })
          }
        />
      </label>
      <label>
        Newcomer status
        <select
          value={value.newcomer.status}
          onChange={(e) =>
            change({
              newcomer: {
                ...value.newcomer,
                status: e.target.value as EventInput["newcomer"]["status"],
              },
            })
          }
        >
          <option value="unknown">Unknown</option>
          <option value="unconfirmed">Unconfirmed</option>
          <option value="confirmed">Confirmed by source</option>
        </select>
      </label>
      <label>
        Newcomer details
        <textarea
          value={value.newcomer.details ?? ""}
          onChange={(e) =>
            change({
              newcomer: { ...value.newcomer, details: e.target.value || null },
            })
          }
        />
      </label>
      <label>
        Newcomer evidence
        <textarea
          value={value.newcomer.evidence ?? ""}
          onChange={(e) =>
            change({
              newcomer: { ...value.newcomer, evidence: e.target.value || null },
            })
          }
        />
      </label>
      <label>
        Registration URL (verified real events only)
        <input
          type="url"
          value={
            value.registrationCandidate?.url ?? value.registration?.url ?? ""
          }
          onChange={(e) =>
            change({
              registrationCandidate: e.target.value
                ? {
                    url: e.target.value,
                    details:
                      value.registrationCandidate?.details ??
                      value.registration?.details ??
                      "",
                  }
                : null,
            })
          }
        />
      </label>
      {(value.registration || value.registrationCandidate) && (
        <label>
          Registration details
          <textarea
            required
            value={
              value.registrationCandidate?.details ??
              value.registration?.details ??
              ""
            }
            onChange={(e) =>
              change({
                registrationCandidate: {
                  url:
                    value.registrationCandidate?.url ?? value.registration!.url,
                  details: e.target.value,
                },
              })
            }
          />
        </label>
      )}
      <label>
        What to expect
        <textarea
          value={value.whatToExpect ?? ""}
          onChange={(e) => change({ whatToExpect: e.target.value || null })}
        />
      </label>
      <label className="admin-checkbox">
        <input
          type="checkbox"
          disabled={value.fictional}
          checked={value.verification.status === "verified"}
          onChange={(e) =>
            setValue((v) => ({
              ...v,
              verification: {
                ...v.verification,
                status: e.target.checked ? "verified" : "unverified",
                lastVerifiedAt: e.target.checked
                  ? new Date().toISOString()
                  : null,
              },
              registration:
                e.target.checked && !v.fictional
                  ? v.registrationCandidate
                    ? {
                        ...v.registrationCandidate,
                        lastVerifiedAt: new Date().toISOString(),
                      }
                    : v.registration
                  : null,
              registrationCandidate: e.target.checked
                ? null
                : v.registration
                  ? { url: v.registration.url, details: v.registration.details }
                  : v.registrationCandidate,
            }))
          }
        />
        I checked the official source and all current event details. Changes
        require checking again.
      </label>
      <label>
        Occurrence status
        <select
          value={value.occurrenceStatus}
          onChange={(e) =>
            change({
              occurrenceStatus: e.target
                .value as EventInput["occurrenceStatus"],
            })
          }
        >
          <option value="scheduled">Scheduled</option>
          <option value="canceled">Canceled</option>
        </select>
      </label>
      <label>
        Change or cancellation note
        <textarea
          required={value.occurrenceStatus === "canceled"}
          maxLength={2000}
          value={value.changeNote ?? ""}
          onChange={(e) => change({ changeNote: e.target.value || null })}
        />
      </label>
      {value.source.url && (
        <a
          className="button secondary"
          href={value.source.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          Review official source (opens new tab)
        </a>
      )}
      <label>
        Publication status
        <select
          value={value.status}
          onChange={(e) =>
            setValue((v) => ({
              ...v,
              status: e.target.value as EventInput["status"],
            }))
          }
        >
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
      </label>
      {error && (
        <p role="alert" className="validation">
          {error}
        </p>
      )}
      <button
        type="submit"
        className="button primary"
        disabled={busy || !categories.length || !organizers.length}
      >
        {busy ? "Saving…" : "Save event"}
      </button>
    </form>
  );
}
function MetadataManager({
  kind,
  token,
}: {
  kind: "categories" | "organizers";
  token?: string;
}) {
  const [revision, setRevision] = useState(0),
    [id, setId] = useState<string>(),
    [name, setName] = useState(""),
    [url, setUrl] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const resource = useResource(
    () =>
      apiRequest<{ data: (Category & { url?: string | null })[] }>(
        `/admin/${kind}`,
        {},
        token,
      ),
    `${token}:${revision}`,
  );
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await apiRequest(
        `/admin/${kind}${id ? `/${id}` : ""}`,
        {
          method: id ? "PATCH" : "POST",
          body: JSON.stringify({
            name,
            ...(kind === "organizers" ? { url: url || null } : {}),
          }),
        },
        token,
      );
      setId(undefined);
      setName("");
      setUrl("");
      setRevision((n) => n + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(target: string) {
    setError("");
    try {
      await apiRequest(`/admin/${kind}/${target}`, { method: "DELETE" }, token);
      setRevision((n) => n + 1);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <section className="admin-section">
      <h2>Manage {kind}</h2>
      <form className="admin-form" onSubmit={save}>
        <label>
          Name
          <input
            required
            maxLength={kind === "categories" ? 80 : 160}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        {kind === "organizers" && (
          <label>
            Official organizer URL
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </label>
        )}
        <button className="button primary" disabled={busy}>
          {busy ? "Saving…" : id ? "Save changes" : "Create"}
        </button>
        {id && (
          <button
            type="button"
            className="text-link"
            onClick={() => {
              setId(undefined);
              setName("");
              setUrl("");
            }}
          >
            Cancel edit
          </button>
        )}
      </form>
      {error && (
        <p role="alert" className="validation">
          {error}
        </p>
      )}
      {resource.loading ? (
        <p role="status">Loading…</p>
      ) : resource.error ? (
        <p role="alert">
          {resource.error}
          <button className="text-link" onClick={resource.retry}>
            Try again
          </button>
        </p>
      ) : (
        <div className="admin-list">
          {resource.data?.data.map((item) => (
            <article className="note" key={item.id}>
              <h3>{item.name}</h3>
              <p className="tiny muted record-id">ID: {item.id}</p>
              <div className="section-row">
                <button
                  className="text-link"
                  aria-label={`Edit ${item.name}`}
                  onClick={() => {
                    setId(item.id);
                    setName(item.name);
                    setUrl(item.url ?? "");
                  }}
                >
                  Edit
                </button>
                <button
                  className="text-link"
                  aria-label={`Delete ${item.name}`}
                  onClick={() => remove(item.id)}
                >
                  Delete
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
