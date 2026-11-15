import { useEffect, useRef, useState } from "react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useMatch,
  useNavigate,
} from "react-router-dom";
import { useApp } from "../context/AppContext";

export function Layout() {
  const { pathname } = useLocation();
  const { saved, preferences, storageUnavailable, announcement } = useApp();
  const [menu, setMenu] = useState(false);
  const menuRef = useRef<HTMLDetailsElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const previous = useRef(pathname);
  const onboarding = pathname.startsWith("/onboarding");
  const welcome = pathname === "/";
  const detail = pathname.startsWith("/events/");
  const step = pathname.endsWith("availability") ? 2 : 1;
  useEffect(() => {
    setMenu(false);
    window.scrollTo(0, 0);
    if (previous.current !== pathname) {
      mainRef.current?.focus();
      previous.current = pathname;
    }
    const title =
      pathname === "/admin"
        ? "Manage campus events"
        : pathname.includes("interests")
          ? "Your interests"
          : pathname.includes("availability")
            ? "Your availability"
            : pathname === "/explore"
              ? "Explore events"
              : pathname === "/plan"
                ? "My Campus Plan"
                : pathname === "/recommendations"
                  ? "Your Top 3"
                  : detail
                    ? "Event details"
                    : "Find your place on campus";
    document.title = `${title} — CampusConnect`;
  }, [pathname, detail]);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setMenu(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenu(false);
        menuRef.current?.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("click", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  return (
    <div
      className={`app-shell ${welcome || onboarding ? "onboarding-shell" : ""}`}
    >
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <header
        className={`app-header ${welcome || detail ? "header-divider" : ""}`}
      >
        <div className="header-inner">
          {onboarding && (
            <Link
              className="icon-button back"
              to={step === 1 ? "/" : "/onboarding/interests"}
              aria-label={step === 1 ? "Back to welcome" : "Back to interests"}
            >
              ←
            </Link>
          )}
          {detail ? (
            <>
              <DetailBack />
              <span className="detail-header-title">Event details</span>
            </>
          ) : (
            <Link to="/" className="brand">
              campusconnect
            </Link>
          )}
          {onboarding ? (
            <span className="muted text-xs ml-auto">{step}/2</span>
          ) : detail ? (
            <DetailSave />
          ) : (
            <details ref={menuRef} className="app-menu" open={menu}>
              <summary
                aria-label={welcome ? "About CampusConnect" : "Open navigation"}
                onClick={(e) => {
                  e.preventDefault();
                  setMenu(!menu);
                }}
                className="icon-button"
              >
                {welcome ? "ⓘ" : "☷"}
              </summary>
              <div className="menu-panel">
                <strong>About CampusConnect</strong>
                <p>
                  Independent student project. Not affiliated with UT Dallas.
                  Fictional examples are labeled. Confirm event details with
                  official sources.
                </p>
                <Link to="/onboarding/interests">Edit my preferences →</Link>
                <Link to="/explore">Explore events →</Link>
                <Link to="/plan">My Campus Plan →</Link>
                <Link to="/admin">Administrator workspace →</Link>
              </div>
            </details>
          )}
        </div>
      </header>
      {storageUnavailable && (
        <p className="storage-warning" role="status">
          Browser storage is unavailable. Your changes will last for this visit
          only.
        </p>
      )}
      <main
        ref={mainRef}
        tabIndex={-1}
        id="main-content"
        className={welcome || onboarding ? "onboarding-main" : "main-content"}
      >
        <Outlet />
      </main>
      {!welcome && !onboarding && !detail && (
        <nav aria-label="Main navigation" className="bottom-nav">
          <div>
            <NavLink
              to={preferences.interests.length ? "/recommendations" : "/"}
            >
              <span aria-hidden="true">⊞</span>Home
            </NavLink>
            <NavLink to="/explore">
              <span aria-hidden="true">⌕</span>Explore
            </NavLink>
            <NavLink to="/plan">
              <span aria-hidden="true">☆</span>Saved
              {saved.length > 0 && (
                <span className="nav-count">{saved.length}</span>
              )}
            </NavLink>
          </div>
        </nav>
      )}
      <div className="sr-only" role="status" aria-live="polite">
        {announcement}
      </div>
    </div>
  );
}
function DetailBack() {
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <button
      className="icon-button back"
      aria-label="Back to events"
      onClick={() =>
        location.state?.from
          ? navigate(location.state.from)
          : navigate("/explore")
      }
    >
      ←
    </button>
  );
}
function DetailSave() {
  const match = useMatch("/events/:id");
  const { events } = useApp();
  const event = events.find((e) => e.id === match?.params.id);
  return event ? <SaveButton id={event.id} title={event.title} /> : null;
}
export function SaveButton({
  id,
  title,
  full = false,
  remove = false,
}: {
  id: string;
  title: string;
  full?: boolean;
  remove?: boolean;
}) {
  const { saved, toggleSave } = useApp();
  const isSaved = saved.includes(id);
  return (
    <button
      type="button"
      className={
        full
          ? "button secondary"
          : `icon-button save-button ${isSaved ? "is-saved" : ""}`
      }
      aria-label={`${isSaved ? "Remove" : "Save"} ${title}${isSaved ? " from" : " to"} My Campus Plan`}
      aria-pressed={isSaved}
      onClick={() => toggleSave(id)}
    >
      <span aria-hidden="true">{isSaved ? "★" : "☆"}</span>
      {full ? (
        isSaved ? (
          "Saved to My Campus Plan"
        ) : (
          "Save to My Campus Plan"
        )
      ) : remove ? (
        <span className="remove-label">Remove</span>
      ) : null}
    </button>
  );
}
