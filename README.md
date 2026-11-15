# CampusConnect — Phase 3

Mobile-first event discovery for UT Dallas students, extending the existing [Phase 1 Figma implementation](https://www.figma.com/design/H0vjcYiToYbYr5Ma46L5pP). React + TypeScript + Vite + Tailwind frontend, TypeScript Cloudflare Worker API, D1 SQLite, Zod validation, and Cloudflare Access authorization. The seven student screens retain their layout and navigation.

CampusConnect is an independent student project, not affiliated with UT Dallas. **Bundled development events are explicitly fictional, unverified examples.** Source-backed pilot candidates are kept separately as unverified drafts awaiting fresh manual review. No real event facts, registration links, or university partnerships are invented. There is no scraper or paid recommendation service.

## Local setup

Use **Node 24 LTS** and npm (`.nvmrc` is provided). No Cloudflare login, remote database, paid account, or API key is needed for local work.

```sh
npm ci
npm run setup:local
npm run db:migrate
npm run db:seed
npm run build
npm run dev
```

Open `http://127.0.0.1:5173`. Vite proxies `/api` to the local Worker at `http://127.0.0.1:8787`. The Worker also serves the built SPA on port 8787, including deep links. Both processes bind to loopback. Stop both with Ctrl+C. For a built-app preview use `npm run preview` after building.

`setup:local` creates an ignored, private `.dev.vars` containing a random local administrator token. It preserves an existing file and prints no token. Open `/admin` and copy the token value from that local file into the password field. It stays in memory and is accepted only in `development` on loopback hosts. The template `.dev.vars.example` contains no real credentials. Never put a secret in a `VITE_` variable, source, Git, a query string, or frontend localStorage.

If your home directory is not writable:

```sh
npm ci --cache ./work/npm-cache
XDG_CONFIG_HOME="$PWD/work/config" npm run db:migrate
XDG_CONFIG_HOME="$PWD/work/config" npm run db:seed
```

The combined development runner uses a workspace-local Wrangler config directory automatically. Local D1 state lives in `.wrangler/state/`; it is ignored by Git. The seed script uses **only `--local`**, takes no arguments, and never overwrites existing events. It creates 18 labeled fictional examples starting next Monday at campus-local times. Rerunning it preserves existing records and dates; add later examples through the admin UI when needed.

## Commands

| Command                                  | Purpose                                                                        |
| ---------------------------------------- | ------------------------------------------------------------------------------ |
| `npm run dev`                            | Run Vite and local Wrangler together                                           |
| `npm run dev:client` / `npm run dev:api` | Run either process separately                                                  |
| `npm run build`                          | Strict frontend + Worker type checks and Vite production build                 |
| `npm run check:worker`                   | Bundle Worker and assets with a deployment **dry run**                         |
| `npm test`                               | Frontend regressions, D1/API/security tests, and React-to-D1 integration tests |
| `npm run test:client`                    | Frontend regression tests                                                      |
| `npm run test:api`                       | D1 migrations/operations, API, scheduling, scoring, JWT authorization          |
| `npm run test:integration`               | React UI → API client → Worker handler → local D1                              |
| `npm run db:migrate`                     | Apply tracked migrations to local D1                                           |
| `npm run smoke:local`                    | Read-only HTTP and bundle checks with the seeded dev servers running           |
| `npm run test:browser` | Mobile/desktop Chromium journeys; requires local setup, migrations, fixtures and a build |
| `npm run prepare:pilot` | Import reviewed-source candidates as local unverified drafts only |
| `npm run db:seed`                        | Insert local fictional examples without overwriting events                     |

To prepare the three manually researched source-backed **local drafts** with the servers running:

```sh
npm run prepare:pilot
```

This loopback-only command preserves existing records, creates the two documented organizer records if absent, and uses the protected CSV API. It never verifies or publishes. Candidate dates were observed on November 7, 2026; recheck sources and remove expired candidates before reuse. Production entry uses the dashboard after deployment approval, not this helper.

See [VALIDATION.md](VALIDATION.md) for measured results and verification limits.

**Phase 4:** The first no-cost Cloudflare pilot URL can be created only through the [manually gated release workflow and owner setup](docs/PHASE4-RELEASE.md). The checked-in production configuration intentionally has placeholder identifiers, no public endpoint and no live database. No event is automatically published.

## Student flows

Welcome → multiple interests → multiple days and time periods → personalized Top 3. Students can also browse directly, combine keyword/category/date/availability filters, page through results, view details and source information, and save multiple events. Categories come from the API. Search/filter state remains in the URL and survives returning from details.

Bookmarks and preferences keep the versioned Phase 1 localStorage keys. They remain independent; editing preferences does not clear saves. Saved events are fetched individually by ID, independently of listing pagination. A 404 for a deleted/archived event produces a removable unavailable bookmark. A network/server error produces a retry state and keeps the save. Cross-tab storage synchronization and in-memory fallback remain supported. Records refresh on focus/visibility, every 60 seconds while visible, and through a saved-plan refresh button. Canceled events retain a notice; stale verification is labeled and removed from discovery. Students with interests but no availability get interest-only recommendations without overwriting their preferences. Onboarding still requires an interest; the recommendation API also supports explicitly requesting no interest or schedule preference.

## Architecture

```text
shared/                  Frontend/API types and campus-time scheduling
src/components/          Existing layout, cards, states and controls
src/context/             Preferences, saved IDs, API access and event cache
src/hooks/               Abortable async resource state
src/services/            HTTP event repository (no fixture import)
src/pages/               Existing seven screens + responsive admin review workspace
src/data/                Fictional fixtures used only by local seeding/tests
worker/index.ts          REST routing, CORS, validation and error boundary
worker/database.ts       Parameterized D1 reads and atomic event writes
worker/auth.ts           Cloudflare Access JWT verification and admin allowlist
worker/recommendations.ts Configurable, deterministic scoring
worker/migrations/       Versioned schema, indexes and initial categories
scripts/                 Local-only setup, seed and dev runner
worker/csv.ts            Bounded CSV preview and unverified draft import
shared/quality.ts        Duplicate identities and verification freshness
tests/browser/           Mobile/desktop Chromium journeys
docs/                    API, source review, CSV, operations and pilot readiness
```

Database events use integer **UTC epoch milliseconds**. Public timestamps are ISO 8601 UTC strings. Filtering by calendar day, availability, and frontend display use **America/Chicago**, including daylight-saving transitions. Categories and organizers have stable IDs; events reference them, and additional interest tags use a join table. Constraints prevent invalid statuses, negative durations, verified fiction, and unverified real publication. An event and its tags are written in one D1 batch.

Frontend student pages use `EventRepository.query/get/recommendations/categories`. Explore filtering and recommendation ranking run on the server. The shared cache supplies card/header saved-state labels; details and saved records are always resolved from API IDs. Phase 1 fixture adapters exist only in tests and are excluded from the production entry graph.

## Recommendation and filtering rules

- Public lists include **published, scheduled, not-yet-started events**. Active duplicates are suppressed before counting, pagination and recommendations. Canceled records never appear in discovery. Real events must be verified within `REVERIFY_AFTER_DAYS` (default 7, accepted 1–90 days); fictional examples are returned only when both `ENVIRONMENT=development` and `ALLOW_FICTIONAL_EVENTS=true`. Published past records remain available by ID for saved plans, but drafts/archived records return 404.
- Categories match any selected primary category/tag. Search, category, date, weekday and time filters combine with AND. Search treats `%`, `_`, and SQL-looking text literally. Calendar weeks run Monday–Sunday; date ranges are start-inclusive/end-exclusive.
- Schedule matching requires the **whole event** to fit selected windows. Morning is midnight–noon, afternoon noon–5 PM, evening 5 PM–midnight. Adjacent selected periods/days are merged, including overnight events. Partial overlap alone is not described as a fit. This intentionally tightens Phase 1's start-time-only rule.
- `anyTime` ignores period restrictions on selected days. `noSchedulePreference` ignores both dimensions. An empty interest list means no interest restriction at the API level. Scheduled matching supports events up to seven days long; longer events are ineligible for constrained recommendations.
- Score = **10 per distinct matched interest + 5 for an explicit schedule fit**. No-schedule-preference omits the schedule bonus. Change `INTEREST_WEIGHT` and `SCHEDULE_WEIGHT` in Worker configuration (0–1000); invalid values use defaults. Ties use the earliest start, then stable ID. Keep only the highest three candidates; return fewer honestly.
- SQL applies publication, text, category and date predicates. Scheduling is applied in bounded chunks before pagination, so totals and pages reflect compatible events. The current MVP scans matching candidates to count schedule-filtered totals; substantial catalog growth may require precomputed availability indexes or cursor pagination.

## Admin workflow and source integrity

The `/admin` workspace manages events, categories and organizers, with CSV preview/import, review/duplicate/expired/canceled queues, publish/unpublish/archive confirmations, and an authorized audit trail. See [CSV import](docs/CSV-IMPORT.md) and [source verification](docs/SOURCE-VERIFICATION.md). CSV imports always create unverified drafts, never approved listings. Registration candidates remain private until explicitly verified. Create an event as a draft, attach a source, fill in all facts, and record verification evidence. For a real event, explicitly attest that the official source and current details were checked before publishing. Last-verified timestamps must not be in the future. Registration details are accepted only with verification for a real event. Confirmed newcomer status requires both details and evidence; unknown status produces no newcomer-friendly claim.

Fictional titles must contain `Sample`, `Fictional`, or `Test`; they can never be marked verified or published in production. The production API independently excludes fictional rows even if development records are accidentally present in its database. Changes to verified real event facts without renewed verification revert the event to a draft. Changing a referenced organizer’s name or URL also invalidates affected real-event verification; a no-op edit preserves it. Verification and registration checks expire independently. Stale registration links are hidden. A canceled listing requires a clear change note; keep its published details available for saved students when supported by a fresh source check. Archive actions retain database records and hide them publicly; there is no destructive event purge in the MVP. Referenced categories/organizers cannot be deleted until references are resolved.

In production, protect `/admin*` and `/api/v1/admin*` with Cloudflare Access. The Worker independently validates the Access JWT's signature, issuer, audience, required claims and expiry against the team's JWKS, then checks `ADMIN_EMAILS`. Missing configuration fails closed. Local bearer tokens are never accepted in production. Explicit origin allowlists, JSON body limits, Zod validation, parameterized SQL and sanitized errors apply at the API boundary.

## Development dependency patches

The direct Miniflare 4 test harness currently pins vulnerable transitive versions upstream. Scoped npm overrides use compatible patched `sharp` 0.35.5 and `undici` 7.30.1 for that harness; Wrangler’s separate Miniflare 5 beta dependency already uses those versions. The lockfile records the overrides. Recheck upstream and remove them when the direct harness can update safely; do not use `npm audit fix --force` to downgrade the runtime. Tests/build and clean installation were rerun after the patch.

## Browser checks

After local setup, migrate, seed and build, run `npm run test:browser`. Playwright starts the local servers if needed. It uses `/usr/bin/chromium` when present, `PLAYWRIGHT_CHROMIUM_EXECUTABLE` when set, or its installed Chromium. On a new machine, run `npx playwright install chromium` once if needed. Browser tests deliberately create, publish and archive **fictional local test records**; use only a disposable local development database. Never aim them at production. Tests use the private local token without persisting it in traces. Screenshots/results go to ignored `work/`.

## Pilot documentation

- [Phase 2 baseline audit](docs/PHASE3-AUDIT.md)
- [Source verification and candidate provenance](docs/SOURCE-VERIFICATION.md)
- [CSV format and review workflow](docs/CSV-IMPORT.md)
- [Operations, monitoring and rollback](docs/OPERATIONS.md)
- [Pilot readiness checklist and remaining manual steps](docs/PILOT-READINESS.md)

## API and deployment

See [docs/API.md](docs/API.md) for endpoint contracts and examples, and [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for a production configuration checklist and commands. Development and production D1 bindings and environment variables are separate. Production IDs/domains/Access settings are placeholders and must be configured before deployment.

**Nothing has been deployed, no remote D1 data has been changed, and no cloud resources have been created.** Running the local setup, tests and dry-run checks uses local resources. Review current Cloudflare free-tier limits before any approved deployment; this lightweight design needs no paid service. Deployment and live migrations require project-owner approval.

The project repository is [ricoxvl/campusconnect](https://github.com/ricoxvl/campusconnect). The source, lockfile, migrations, tests and documentation are included; private local variables, D1 state, dependencies and generated artifacts are excluded. CI runs tests, builds, and a Worker dry run; it has no deployment step.

The previously published project overview is preserved in [the historical product case study](docs/PRODUCT-CASE-STUDY.md). Its repository-status and next-step notes describe the earlier documentation-only repository; use this README for current installation and implementation status.
