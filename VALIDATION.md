# Phase 3 validation

Verified locally on November 7, 2026 with Node 24.22.1, Vite 7.3.7, Vitest 4.1.12, Wrangler 4.158.0 and Chromium 156.0.8078.79. No production resource was created or changed. See docs/PHASE3-AUDIT.md for the pre-change 55-test baseline.

## Automated results

**74 Vitest tests passed across 8 files:**

- **27 frontend tests**: existing seven-screen navigation/onboarding, preserved edits, preferences, search/filter state, source/fictional labels, details, saved persistence/cross-tab synchronization, storage failures and loading/error/empty states; added recommendations for students with interests but no selected availability.
- **42 backend tests**: actual isolated local D1 migration/schema and atomic operations; event/category/organizer APIs; literal combined search/filter/pagination; schedule coverage across adjacent windows, overnight and DST; configurable scoring and Top 3/no-match/no-preference rules; Zod/body validation; source/publication constraints; signed JWT signature/issuer/audience/expiry/allowlist denials. Phase 3 cases add bounded CSV parsing, authorization, preview/selected-row import, private registration candidates, invalid references/source/expired/unsafe URL rejection, canonical and concurrent duplicates, legacy suppression/review, canceled/expired discovery exclusion, independent event/registration freshness, no-op organizer preservation versus actual-change invalidation, lifecycle/audit and safe database health failure.
- **5 React-to-D1 integration tests**: student search/recommendations/details/saves; archive/temporary failure handling; focus refresh reflects changed/canceled saved records without losing preferences; administrator create/edit/publish/archive; CSV dashboard preview and six-row import across multiple protected commit batches.

Tests apply both numbered migrations to isolated ephemeral Miniflare D1 databases. They do not depend on or modify remote D1. JWT tests use isolated signing keys, not a real Access account.

**10 Playwright browser cases passed**: five journeys each on mobile Chromium (390×844 with touch emulation) and desktop Chromium (1280×900). They exercise onboarding, no-availability recommendations, search/category filters, details, save/reload/remove/manual refresh, protected CSV import and publish/unpublish/archive confirmations, skip-link and keyboard filter use, private-file denial, request IDs, and the built Worker application under CSP/security headers. Recommendation layouts were also measured at 320, 390, 768 and 1280 pixels without horizontal overflow. Mobile admin layout had no horizontal overflow. Browser admin mutations create/archive only explicitly fictional local test records.

Screenshots of recommendations, details and the admin list were inspected, and status-badge/detail-label spacing was corrected. Repeat screenshots and browser results live in ignored `work/browser-artifacts/` and `work/browser-results.json`. Traces are disabled so the local login token is not captured in form traces. Chromium emulation does not establish physical-device/Safari compatibility or full accessibility conformance.

## Build and runtime verification

- Strict frontend/Worker TypeScript checks and Vite production build passed.
- Development and production Worker/static-asset **dry-run** bundles passed. Production output selects the separate placeholder D1 binding, production environment and fictional records disabled; this is packaging, not a working production deployment.
- Local migrations 0001 and 0002 applied; repeat migration check reported no pending migrations. Original Phase 2 migration is unchanged.
- Vite and local Wrangler ran on loopback ports 5173/8787. HTTP smoke checks passed all seven student routes plus admin on both servers, D1 reads, combined filtering, backend Top 3, rejected unauthorized admins, accepted local session, origin rejection, `.dev.vars` denial and production frontend bundle exclusion of local/test secrets and fixture titles.
- Candidate preparation created three source-backed local drafts, all real/unverified/draft; repeating preparation preserved them without duplicates. They are absent from public discovery/recommendations. The original 18 fictional examples remain explicitly development-only. Source provenance and unresolved checks are in docs/SOURCE-VERIFICATION.md and docs/data/.
- `npm audit --omit=dev` reported zero known production vulnerabilities. The initial full dependency audit found three high advisories in development-only Miniflare transitive dependencies. Scoped overrides upgrade sharp to 0.35.5 and undici to 7.30.1; a clean `npm ci`, full tests and build passed after remediation. The final full `npm audit` reported zero known vulnerabilities. Registry advisory checks are not guarantees against undiscovered issues.
- Built app CSP/frame/content/referrer/permissions headers were exercised in Chromium without JavaScript page errors. No admin token is shipped in the frontend bundle or intentionally persisted in localStorage.

To reproduce: install, setup local vars, migrate, seed, build; run `npm test` and `npm run test:browser`. Run `npm run dev` then `npm run smoke:local` in another terminal. `npm run prepare:pilot` is optional and loopback-only; its fixed November 2026 candidates must be freshly reviewed or replaced when obsolete. Browser tests require installed Chromium; see README.

## Remaining manual release checks

- Production hostname, D1 UUID, Access team/audience and admin identities are intentionally unconfigured. A real Access sign-in, unauthorized signed-in identity, production database migration and actual-domain routing remain unverified.
- Three manually sourced candidates await fresh human verification, resolution of documented host/location ambiguity and explicit publication approval. No real event was published. Source changes/cancellations are not fetched automatically.
- Physical iPhone Safari/Android Chrome, assistive-technology review, real-domain/slow-network checks and pilot support ownership remain on the checklist.
- No production load/quota/cost measurement or automatic alerts are claimed. Catalog scans and last-write-wins administration suit a small curated pilot. Review limits before expansion.
- At the November 7 validation, no Git remote/history had been supplied and no commit/push had been performed. Production deployment and live data modification remain separate, unapproved actions.

Use docs/PILOT-READINESS.md and docs/OPERATIONS.md for owner steps, monitoring, backups and schema-compatible rollback. A Phase 2 rollback can ignore cancellation/freshness and must not be performed blindly.

## GitHub source handoff — November 15, 2026

The owner supplied `https://github.com/ricoxvl/campusconnect`. Its `main` branch contained only the product case-study README; a separate draft documentation PR was left untouched. The original README is preserved in docs/PRODUCT-CASE-STUDY.md. The application source, migrations, tests, configuration examples and setup documentation form the source snapshot; local credentials, D1 files, dependencies, build output and scratch artifacts are excluded.

Before upload, all 74 Vitest tests and the production build were rerun successfully. The selected source files passed a check for the actual local administrator token, private keys and common credential patterns; `.dev.vars` and generated directories remain ignored. This handoff does not rerun the historical browser checks or publish an event or deployment. Date-specific event candidates must be rechecked; the November 10 occurrence is now past.
