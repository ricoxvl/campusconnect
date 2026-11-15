# REST API v1

Base path: `/api/v1`. Same-origin frontend hosting is recommended. JSON responses use `{ "data": ... }`; event lists also include `meta`. Errors use `{ "error": { "code": "...", "message": "...", "details": [...] } }`; validation details contain field paths and messages. API responses use `Cache-Control: no-store`. JSON requests require `Content-Type: application/json` and are limited to 64 KiB, except CSV preview/commit envelopes (131,072 bytes; CSV text still at most 60,000 bytes). Responses include `X-Request-Id` for correlation. CORS exposes this header to allowed origins.

Status codes: 200 success, 201 created, 204 archived/deleted/preflight, 400 malformed JSON, 401 missing/invalid admin authentication, 403 unauthorized identity/origin, 404 unavailable record/route, 405 unsupported method, 409 duplicate/referenced-record conflict, 413 body limit, 415 media type, 422 invalid values or publication rules, 500 sanitized internal error, 503 database health unavailable. No SQL or credential values are exposed.

## Public endpoints

### `GET /events`

Returns published scheduled events whose start is in the future, excluding canceled, stale and duplicate occurrences. Drafts and archived events never appear. Production requires real events verified within `REVERIFY_AFTER_DAYS` (default 7, valid 1–90). Duplicates are suppressed before totals and pagination. Development may explicitly enable labeled fictional examples.

| Parameter               | Meaning                                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `q`                     | Literal case-insensitive keyword, up to 200 characters; title, description, location, organizer, category and tags |
| `category` (repeatable) | Category/tag ID or exact display name; OR within categories                                                        |
| `from`, `to`            | ISO 8601 timestamps with UTC offsets; event start in `[from,to)`                                                   |
| `day` (repeatable)      | `Mon`, `Tue`, `Wed`, `Thu`, `Fri`, `Sat`, `Sun`                                                                    |
| `period` (repeatable)   | `Morning`, `Afternoon`, `Evening`                                                                                  |
| `anyTime`               | `true` ignores period restrictions; selected days still apply                                                      |
| `date`                  | `all` (default), `today`, `week`, `next-week`; campus-local calendar boundaries                                    |
| `page`                  | 1–10000, default 1                                                                                                 |
| `pageSize`              | 1–50, default 18                                                                                                   |
| `sort`                  | `soonest` (default) or `latest`; stable ID breaks equal-time ties                                                  |

Search/category/date/day/availability dimensions combine with AND. If a day or period dimension is omitted, that dimension is unrestricted for filtering. Availability requires complete event coverage by the selected windows, including adjacent windows and midnight. Pagination and totals are applied **after** schedule compatibility, not before.

```sh
curl 'http://127.0.0.1:8787/api/v1/events?q=coding&category=technology&day=Thu&period=Afternoon&page=1&pageSize=10'
```

```json
{
  "data": [],
  "meta": { "page": 1, "pageSize": 10, "total": 0, "totalPages": 0 }
}
```

### `GET /events/:id`

Returns `{ "data": CampusEvent }`. A published past or canceled event is still resolvable by ID for a saved plan. Stale records remain resolvable but show `source.verified: false`, `verificationStatus: "unverified"`, `reviewRequired: true`; stale newcomer and registration claims are omitted. Registration has an independent freshness check. Draft, archived, deleted, or disallowed fictional records return 404. IDs accept letters, digits, underscores and hyphens, max 80 characters. API clients must distinguish 404 from temporary failures.

An event contains `id`, `title`, `description`, `categories` (display names; primary first), `startsAt`, `endsAt`, `timeZone`, `location`, `organizer`, `organizerId`, `source: {name,url,verified}`, `fictional`, `verificationStatus`, `lastVerifiedAt`, `status`, `newcomerStatus`, and optional `newcomer`, `registration`, `whatToExpect`. UTC ISO timestamps are displayed in America/Chicago. Unknown newcomer data is omitted; fictional newcomer notes remain labeled sample information. Also includes `occurrenceStatus: "scheduled" | "canceled"`, nullable `changeNote`, `updatedAt`, and `reviewRequired`. Internal verification evidence and `registrationCandidate` are admin-only.

### `GET /categories`

Returns `{ "data": [{ "id": "technology", "name": "Technology" }, ...] }`. These database records populate frontend interest choices. Category IDs remain stable when display names change. Existing preferences store display names for Phase 1 compatibility; a renamed label may require the student to reselect it. Bookmarks are unaffected.

### `POST /recommendations`

```json
{
  "interests": ["Technology", "Academics"],
  "days": ["Thu"],
  "periods": ["Afternoon", "Evening"],
  "anyTime": false,
  "noSchedulePreference": false
}
```

Interest values are category **display names**, not IDs. Distinct interests contribute to scoring. All three array fields are required; `anyTime` and `noSchedulePreference` default to false. Without no-schedule-preference, at least one day and one period (or anyTime) are required. To explicitly request no preferences, use empty arrays and `noSchedulePreference: true`.

Returns `{ "data": [{ "event": CampusEvent, "score": 25, "reason": "Matches Technology + Academics + Thu afternoon." }] }`, with zero to three results. Future, published, scheduled, freshly verified and deduplicated eligible events only. Canceled, started and expired events are excluded. Development fictional exceptions remain explicit. Score and ordering rules are documented in README. No student preferences are written to D1.

### `GET /health`

Returns `{ "data": { "status": "ok" } }` after a database probe, or a sanitized 503 if unavailable. This does not test external source availability or Access sign-in.

## Protected endpoints

Every `/admin` endpoint checks server-side authorization. Production expects `Cf-Access-Jwt-Assertion` from the configured Cloudflare Access application and an allowlisted email. The browser uses Access cookies; frontend code contains no administrator credential. Local development accepts `Authorization: Bearer <local-development-token>` only in development on loopback hosts.

### `GET /admin/session`

Returns `{ "data": { "identity": "..." } }` when authorized. Used by the admin UI to check the current session.

### `GET /admin/events?page=1&pageSize=20`

Returns paginated admin event inputs and `meta`, including drafts, archived events, and verification evidence. Default list pagination follows the public defaults (18 items unless supplied). Records are ordered by last update, then stable ID. Optional `view`: `all`, `review`, `duplicates`, `expired`, `draft`, `published`, `archived`, `canceled`; optional literal `q` up to 200 characters searches title/location/source. Each record includes `qualityFlags`; response adds `summary: {total,review,duplicates,expired,canceled}` for the full catalog. Review includes active drafts, verification and registration rechecks. Flags can include `draft`, `needs-verification`, `expired`, `canceled`, `updated`, `duplicate`, `registration-recheck`. Expired means ended; discovery excludes already-started events too.

### `GET /admin/events/:id`

Returns an admin-editable record including its stable ID and `updatedAt`.

### `POST /admin/events`

Creates an event; 201 response. Optional `id` otherwise uses a UUID. Start/end and last-verified values must include a timezone offset. The following **fictional development draft** is an input example, not an actual university event:

```json
{
  "title": "Sample coding circle",
  "description": "Fictional example for local testing only.",
  "categoryId": "technology",
  "interestIds": ["academics"],
  "organizerId": "test-organizer",
  "startsAt": "2030-01-03T14:30:00-06:00",
  "endsAt": "2030-01-03T15:30:00-06:00",
  "location": "Fictional classroom — example only",
  "source": { "name": "Fictional test dataset", "url": null },
  "fictional": true,
  "verification": {
    "status": "unverified",
    "lastVerifiedAt": null,
    "evidence": null
  },
  "newcomer": { "status": "unknown", "details": null, "evidence": null },
  "registration": null,
  "whatToExpect": "Fictional testing scenario only.",
  "status": "draft"
}
```

Category/interest and organizer IDs must exist. `interestIds` defaults to `[]`; duplicate tags are removed. `fictional` defaults false. Verification defaults unverified, newcomer defaults unknown, registration defaults null, and status defaults draft.

Real publication requires a safe HTTPS source URL, `verification.status: "verified"`, a nonfuture, fresh `lastVerifiedAt`, and nonempty evidence of a manual check. Verified fictional events are always rejected. Fictional publication is permitted only in explicitly enabled development mode. Expired events cannot be newly published. Confirmed newcomer status needs both details and evidence. Optional registration has `{url,details,lastVerifiedAt}` and requires fresh verification for a real event. Optional `registrationCandidate: {url,details}` is private pending information and confers no verification. `occurrenceStatus` defaults `scheduled`; setting `canceled` requires a nonempty `changeNote`. Use `changeNote` for source-supported updates. Canceling does not bypass source rules.

### `PATCH /admin/events/:id`

Partial update; omitted fields are preserved. `id` and `updatedAt` are not writable. Nested source, verification, newcomer and registration objects are replacement objects, not deep-merged patches. An empty patch is rejected. Real verified event facts changed without an explicit new verification object become unverified and, if published, revert to draft; registration is cleared. An authenticated administrator's explicit verification object is a renewed manual attestation. The UI resets that attestation when event facts are edited.

### `DELETE /admin/events/:id`

Archives the event; 204 response. This is a soft removal that retains historical records. Public details become 404 and saved plans show an unavailable bookmark that can be removed. Repeating archive is safe. A never-existing ID returns 404. Restore an archived, still-current event with PATCH after checking its publication/verification requirements.

### Categories and organizers

| Route                          | Behavior                                               |
| ------------------------------ | ------------------------------------------------------ |
| `GET /admin/categories`        | List categories                                        |
| `POST /admin/categories`       | Create `{id?,name}`                                    |
| `PATCH /admin/categories/:id`  | Rename `{name}`                                        |
| `DELETE /admin/categories/:id` | Delete unused category; 409 if referenced              |
| `GET /admin/organizers`        | List `{id,name,url}`                                   |
| `POST /admin/organizers`       | Create `{id?,name,url?}`; URL must be HTTPS or null    |
| `PATCH /admin/organizers/:id`  | Update supplied `name`/`url`; omitted values preserved |
| `DELETE /admin/organizers/:id` | Delete unused organizer; 409 if referenced             |

Changing an organizer name or URL (rather than resubmitting unchanged values) invalidates verification for referencing real events and reverts published ones to drafts. Recheck those events individually before republishing. IDs on all entities are immutable. No admin endpoint bypasses the JWT/allowlist check in production.

## CSV endpoints (administrator only)

### `POST /admin/import/preview`

Body: `{ "csv": "header\nrecord..." }`. Returns `{data:[{row,title,input,errors,duplicateOf?}]}`. `row` starts at 2 for the first logical CSV data record. `input` is the server-validated draft or null. Preview never writes or visits source URLs. See CSV-IMPORT.md for exact headers, references, 50-record and byte limits.

### `POST /admin/import`

Body: `{ "csv": "the same CSV text", "rows": [2,4] }`; one to five distinct selected record numbers per request. Revalidates the file and current database references/duplicates. Invalid selections return 422. Returns `{data:[{row,status:"created",id} | {row,status:"conflict",message}]}`. All created events are unverified drafts; registration remains a private candidate and newcomer status unknown. Earlier rows may commit before a later conflict/failure. Re-preview before retries. The dashboard batches larger selections; no overwrite/upsert or automatic publication is supported.

### `GET /admin/audit`

Returns `{data:[{actor,action,resourceId,happenedAt}]}` for the last 50 actions; `happenedAt` is UTC epoch milliseconds. Event writes, archiving and metadata mutations are audited in the same D1 batch. Actor is the authorized Access identity or explicit local-development identity. This operational history is access-protected but not a tamper-proof compliance ledger. It contains administrator identity; restrict access and review retention for the pilot.

## Quality and security notes

Migration 0002 adds cancellation/update fields, pending registration, active occurrence identity indexes and the audit table. New active duplicates return 409, including concurrent requests. Canonical source URLs ignore fragments and common tracking parameters; distinct recurrence starts remain distinct. Older records have nullable identity keys and are checked at read/review time.

Production API requests log method, route (without query), status, duration and request ID. Bodies, credentials and student preferences are not logged by application code. Built static assets carry CSP and frame/content/referrer/permissions headers; development Vite is not the production header server. No scraper, background source checker, student-account service or browser secret is introduced.
