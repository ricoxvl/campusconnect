# CampusConnect — Phase 3 implementation handoff

**November 15, 2026 source audit:** The connected GitHub repository `ricoxvl/campusconnect` has only a product-case-study `README.md` on `main`; `package.json`, `src/App.tsx`, and `wrangler.toml` are not present, and the repository has no other branches containing the app. The README explicitly says the source code has not yet been published. **Do not assume Phase 1/2 are complete or recreate them blindly.**

## Gate 0 — Sync the actual Codex workspace

1. Open the existing Codex task/workspace that built CampusConnect. Locate the *real* frontend and Cloudflare backend, plus tests and migrations.
2. Confirm this is the CampusConnect event-discovery project, not a same-name GitHub repository owned by someone else.
3. Run the local build/tests and report results. Check `package.json`, `src`, `worker`, `migrations`, Cloudflare configuration, and current API schema. Paths may differ.
4. **Publish a sanitized source snapshot** to this repository using normal Git operations (without overwriting the case-study README or leaking `.dev.vars`, tokens, D1 databases, API secrets, student data, or credentials). If source is in another intended repository, record its exact URL and work there instead.
5. Inspect the pushed source and only then plan compatible Phase 3 changes.

No release/deployment or actual event publication is authorized by this handoff.

## Phase 3 acceptance criteria, once application source is available

### Event source and verification
- Use `EVENT_CURATION.md` and `event-import-template.csv` as **proposed** contracts to adapt to the real schema.
- Implement an admin-only draft -> verified review -> published workflow; protect every write endpoint and CSV upload server-side.
- Capture source URL, exact event details, verification timestamp, event status, and reviewer audit metadata.
- Deduplicate by source URL and time; require explicit review for ambiguous duplicates.
- Exclude canceled, archived, expired, unpublished and unverified records from public recommendations unless explicitly labeled/publication-policy-approved.
- Preserve unknown values; do not guess cost, accessibility, location, end time, eligibility, or RSVP requirement.
- Do not scrape private SSO-backed systems or claim university affiliation.

### Student app
- Explore shows only eligible published events with loading, no-results and network-error states.
- Detail page displays source link, verification information, and any known registration restrictions.
- Recommend up to 3 upcoming matching events with explainable interest/time rationale and graceful fallback.
- Preserve local bookmarks, with a helpful indication when a saved event is archived/deleted.
- Date filtering and display use America/Chicago while storing UTC timestamps correctly across DST boundaries.

### Security
- Use a verified admin identity + server-side authorization; never rely on client-only routes or secret keys in browser code.
- Validate request payloads (e.g. Zod) and use parameterized D1 queries.
- Put secrets in Worker secret storage, not Git.
- Validate and bound CSV size, row count, allowed URLs/fields, and import errors; preview before applying.
- Avoid student-identifying information and unnecessary logs.

### Quality gate
- Tests for end-of-event expiration, UTC/Chicago DST conversion, duplicates, unverified/unknown values, invalid CSV, unauthorized writes, recommendations and saved archived events.
- Run formatting, TypeScript type checks, frontend build, unit/integration tests, migrations on disposable local D1 state.
- Manual mobile-browser QA for onboarding -> recommendation -> detail -> save -> Explore.
- Deployment checklist names exact secrets and rollback steps; do **not** run production deploy without user approval.

## Suggested Codex task after source sync

> Inspect the existing CampusConnect source and current test results. Read `docs/phase3/EVENT_CURATION.md` and `docs/phase3/IMPLEMENTATION_HANDOFF.md`. Complete Phase 3 incrementally by implementing secure, verified manual event curation, an admin review/publish dashboard and CSV preview/import, robust public event and recommendation filtering, and associated tests. Preserve Phase 1/2 UI and API contracts where practical. Start by writing a gap assessment and a small implementation plan based on the *actual* source; do not reconstruct code you cannot see. Keep events in draft until manually verified; don't run paid or production operations without approval.

## Pilot readiness exit checklist

- [ ] Existing source has been located and safely pushed or explicitly linked.
- [ ] Frontend build and backend tests pass on the real workspace.
- [ ] D1 schema and migration lifecycle are reproducible locally.
- [ ] Admin access denies unauthenticated and unauthorized writes.
- [ ] Candidate event import is draft-only with preview and duplicate warnings.
- [ ] A manually checked set of *upcoming* official-source event pages is available for review.
- [ ] Public Explore/Top 3/Details show only policy-eligible records.
- [ ] Source links are visible, timestamps correct, canceled events excluded.
- [ ] No client secrets, invented metrics, fictional 'real' events, or implied UT Dallas affiliation.
- [ ] Student-pilot observation plan and failure/rollback procedures reviewed.
- [ ] User approved any real publication and deployment.
