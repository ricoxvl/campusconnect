# Pilot operations, monitoring and rollback

These are runbooks, not records of a production deployment. No live commands were executed. Production resource creation, migration, deployment, rollback or live-data mutation requires owner approval.

## Limited pilot operating model

Appoint one curator per event edit; the editor uses last-write-wins and does not implement collaborative locking. Keep the catalog small (initially tens, review again before hundreds). Admin quality summaries scan the catalog; public schedule counts scan matching chunks. CSV commits are bounded to five rows per request. Check current Workers/D1/Access quotas and set account usage notifications where available without enabling paid services. No load-capacity or free-tier cost guarantee has been measured.

Daily, check the review/duplicate/expired/canceled queues and official sources for published occurrences. Recheck near-term events within 24 hours where practical. Keep new events as drafts until facts and registration are reviewed. Duplicate checks are conservative heuristics, so the curator must also review renamed/postponed events manually. Keep the retained ID when updating an occurrence to preserve bookmarks.

The default verification window is seven days (`REVERIFY_AFTER_DAYS`, accepted 1–90). Stale events disappear from lists/recommendations; direct saved details say rechecking is needed and omit stale registration/newcomer claims. This is time-based validation, not proof that an external page has stayed unchanged. Apply the source checklist on every renewed attestation. Expired events leave discovery automatically, but archive is a manual curation action.

Canceled listings should carry a concise, source-supported change note. Renew verification and keep published details when useful to previously saved students; discovery/recommendations exclude them. Unpublish anything uncertain, even if it temporarily becomes an unavailable bookmark. Saved IDs survive and reappear if the same record is republished. Visible student views re-fetch on focus/visibility and about every 60 seconds; saved plans have a manual refresh. Temporary failures keep bookmarks and offer retry.

## Health and errors

`GET /api/v1/health` probes D1 and returns 200/503. Check it before inviting students and during each pilot support session; check list/details/recommendations too. Health does not check Access, domain routing, event truth or source availability. A local health success is not production monitoring.

API responses carry `X-Request-Id`. Production application logs include request ID, method, route without query string, status and duration; unexpected exceptions record only a safe kind/ID. No request body, token, source evidence or student preferences is intentionally logged. Production Workers observability is configured with 10% head sampling; short incidents may not appear in samples. Inspect Cloudflare's Worker errors/latency and D1 usage dashboard, investigate sustained 5xx/503 or quota errors, and review current logging storage/retention limits before enabling it live. No external paid monitor or alert delivery is configured. The owner must assign a support contact and choose how to receive provider notifications.

If event integrity is in doubt: unpublish the affected record through an authenticated session, note the source issue privately, verify the official page, correct facts under the existing ID, renew attestation, then publish after review. If the API is unavailable: inspect request IDs and provider status/usage, preserve saves, and restore a known-good compatible release under the procedure below.

The protected audit panel shows the latest 50 admin actions; D1 retains the underlying records. It contains administrator email identity but no student profiles. Restrict access, decide an appropriate retention period before a longer pilot, and do not treat it as a tamper-proof security ledger.

## Release record and backups

For every approved release, record source commit (once the owner supplies Git history), deployed Worker version, migration level, configuration changes, backup/export location or D1 Time Travel bookmark and the result of post-deploy checks. Never store production exports in the repository or chat; they contain private administrator audit data. Keep all tokens in secure account/CI storage, never VITE variables or bundle assets.

Before an approved remote migration, review the target production UUID and create a backup/export using the provider UI or the following instruction (not run here):

```sh
npx wrangler d1 export campusconnect-production --env production --remote --output work/pre-release.sql
```

Store that file in approved private storage, verify restoration instructions, and record the currently available Time Travel window/bookmark from the provider. Do not assume a retention window across plans. Migration 0002 is additive; do not delete/modify released migrations or improvise a destructive down migration.

## Worker rollback

1. Obtain owner approval and identify the last known-good **schema-compatible** Worker version and its configuration. Pause admin writes through Access policy during recovery; keep public read access only if safe.
2. Prefer rolling forward a fix or rolling back to a known-good Phase 3-compatible version while retaining migration 0002.
3. Only after review, use the recorded version ID:

```sh
npx wrangler rollback REVIEWED_VERSION_ID --env production --message "Approved pilot recovery"
```

4. Re-run health, authorized/anonymous admin checks, source/expiry/cancellation exclusions, recommendations, details and saved-plan refresh. Verify bindings, secrets and Access settings independently; version rollback is not a database backup.
5. Resume administration only after validating event integrity and logging the recovery outcome.

**A Phase 2 Worker ignores Phase 3 cancellation and freshness fields and can resurface unsafe records.** Do not blindly deploy Phase 2 against the Phase 3 database. If that fallback is necessary, first obtain approval to unpublish affected (or all real pilot) records using the current guarded API, preserve a backup and audit note, then validate the older build's public output before restoring traffic. An incompatible old frontend/backend pair is also a release risk.

## Database recovery

Use database restoration only when data itself is damaged, after stopping admin writes, obtaining owner approval, taking a current backup and estimating writes lost since the chosen point. Use the provider's currently supported Time Travel/restore process for the reviewed production database. For the installed Wrangler CLI the explicit restore forms are:

```sh
npx wrangler d1 time-travel restore campusconnect-production --env production --bookmark REVIEWED_BOOKMARK
# Or, after explicitly reviewing the intended UTC restore time:
npx wrangler d1 time-travel restore campusconnect-production --env production --timestamp REVIEWED_RFC3339_TIMESTAMP
```

These commands change remote data and were not run. Ensure the restored migration level and Worker version agree; validate row counts, relationships, audit history, verified sources and absent fictional publication. Reconcile later curator changes manually before reopening writes. Do not fix a restoration mismatch by dropping new columns or disabling verification rules.
