# Local development and future deployment

The implementation has been exercised locally. **These deployment steps are instructions only; no production deployment, remote migration, or cloud resource creation was performed. Obtain project-owner approval before running live commands.**

## Configuration separation

`wrangler.jsonc` uses a development Worker name, a local placeholder D1 binding, explicit loopback origins, and fictional examples enabled. `.dev.vars` is a private local file, excluded from Git and the browser bundle. `env.production` has a distinct Worker name and database binding, fictional examples disabled, no public workers.dev URL, and blank origin/Access settings. The production database UUID is an intentionally nonfunctional placeholder; replace it with a separately created production database ID.

Use `npm run dev` for Vite + Wrangler, or `npm run preview` after `npm run build` to exercise the built app directly through the local Worker. `npm run db:migrate` and `npm run db:seed` are local-only. Do not add `--remote` to local examples or use the seed against a live database. Migrations 0001 and additive 0002 must both be applied. Migration 0002 adds cancellation/quality and audit fields. Run migration application twice locally to confirm Wrangler reports no outstanding migrations on the second run. Do not edit a migration after it has been released to a real database; add a new numbered migration.

## Before any approved production deployment

1. Review the current Cloudflare Workers, D1, and Zero Trust Access free-plan limits. This app uses one Worker, one D1 database, static assets, and manual data entry, with no paid recommendation service. Do not enable a paid plan to make a deployment succeed without approval.
2. After approval, create a dedicated production D1 database and replace the production binding's placeholder ID. Never reuse the development database.
3. Choose the production hostname and configure an exact `ALLOWED_ORIGINS` value including its scheme, hostname, and port if nonstandard. Same-origin SPA/API hosting is recommended. Do not use `*` for credentialed traffic.
4. Create a Cloudflare Access self-hosted application protecting both `/admin*` and `/api/v1/admin*` on that hostname. Allow only authorized administrator identities and require your organization's appropriate sign-in policy. Record the team domain and application audience.
5. Configure production `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD`, and `ADMIN_EMAILS` (comma-separated exact emails) in production Worker settings/configuration. These are validation settings; do not put them or any future secret in `VITE_` variables. Production must have `ENVIRONMENT=production` and `ALLOW_FICTIONAL_EVENTS=false`. Never configure `ADMIN_DEV_TOKEN` in production.
6. Configure a Worker custom domain/route for the reviewed hostname. The supplied configuration keeps workers.dev disabled. If a different access path is enabled later, the Worker still independently verifies JWT signatures and the admin allowlist.
7. Build and run all tests, then `npm run test:browser` against local fixtures. Review `docs/PILOT-READINESS.md`. Use `npx wrangler deploy --env production --dry-run --outdir work/production-build` for packaging review; dry-run does not publish or apply migrations. Inspect that the production binding and restrictive variables are selected.
8. Before an approved live migration, back up any existing production database through your Cloudflare administration process and record a compatible Worker version and restore point using `docs/OPERATIONS.md`. Review the SQL against the intended binding.

## Live commands — run only after approval and configuration

```sh
# Create the dedicated database only after approval.
npx wrangler d1 create campusconnect-production
# Copy its returned ID into env.production.d1_databases first.

# Apply schema only to that reviewed production binding.
npx wrangler d1 migrations apply campusconnect-production --env production --remote

npm run build
npm test
npx wrangler deploy --env production
```

No default `deploy` npm script or CI deployment job is supplied, reducing accidental live changes. Cloudflare credentials are handled by Wrangler login or secure CI secrets after approval, never frontend code or committed files. Do not paste production tokens into chat.

## Post-deployment checks

- Student list/details/categories/recommendation requests work on the selected hostname.
- Anonymous admin requests are rejected, even when they fabricate an assertion header or local bearer token.
- A signed-in allowlisted administrator can create a draft, add verified source details, publish, edit with renewed verification, and archive it.
- A real event without verification cannot be published. Fictional test data is never public in production.
- Origins outside the explicit allowlist are rejected.
- Archived/deleted saved records become removable unavailable entries; a temporary outage retains bookmarks and shows retry.
- Local mobile/desktop Chromium checks passed; repeat the pilot flows on physical iPhone Safari/Android Chrome and the actual hostname before inviting students. Local jsdom/Chromium emulation does not replace these device and Access checks.

## Manual real-event entry

Use an official university or organizer source, check title, dates/timezone, location, organizer, eligibility, and registration manually, and record what was checked plus the date. Confirm newcomer details only when explicitly supported. The platform does not scrape or independently verify a URL automatically. An administrator's verification attestation is the source of truth; false or stale information must not be published. Archive outdated or withdrawn events promptly.

## Phase 3 configuration and operational gates

Set `REVERIFY_AFTER_DAYS` to the reviewed freshness window (default 7 days, accepted 1–90). Independently stale registration URLs are omitted from public data. Production request logs use 10% sampling; review provider limits/retention and support ownership. `/api/v1/health` checks D1; it does not establish event truth or admin login correctness. Built assets include CSP and related security headers via `public/_headers`.

Use the reviewed CSV/manual workflow after approved deployment. Neither migrations nor deployment auto-publish candidates. Do not seed production with development examples. Recheck November 2026 candidate dates before use; import them as unverified drafts and verify/publish individually only when authorized.

Follow [OPERATIONS.md](OPERATIONS.md) for release backups, monitoring and rollback. A blind Phase 2 rollback is unsafe because older code ignores cancellation/freshness; use a Phase 3-compatible version or unpublish affected records under an approved recovery plan first. All live recovery commands require approval. Complete [PILOT-READINESS.md](PILOT-READINESS.md) before a limited invitation.
