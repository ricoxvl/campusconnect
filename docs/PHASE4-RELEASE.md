# Phase 4 — First CampusConnect pilot URL (Cloudflare Workers + D1)

**Status:** Configuration and manually triggered workflow are prepared. This document does **not** indicate that a live URL, Cloudflare account, D1 database or Access application already exists. No event was published.

CampusConnect is an independent student-built application, not affiliated with UT Dallas. The initial deployment is a **restricted pilot preparation**, not an invitation to students. The public catalog intentionally starts empty because fictional development records are disabled in production.

## Why Cloudflare rather than Render?

The existing backend uses Cloudflare Workers and a bound D1 database, rather than a generic Node process and Postgres. The first live URL can use Cloudflare's free `workers.dev` hostname without purchasing a domain. A later custom-domain deployment needs a separate, reviewed change. The Worker must continue to reject admin requests from anyone without an approved signed Cloudflare Access JWT.

## Required one-time Cloudflare steps (owner)

1. Open the [Cloudflare dashboard](https://dash.cloudflare.com/), select the intended Cloudflare account and confirm Free-tier limits.
2. Find your account-level Workers subdomain under Workers & Pages. The hostname for this release **must** match `campusconnect-production.<your-account-subdomain>.workers.dev`. Do not guess the suffix.
3. Create a dedicated **empty** D1 database named `campusconnect-production` in this account. Copy its returned UUID privately. Do not use the local placeholder ID, another product's database, or an existing production database. Migrations 0001/0002 will be applied by the workflow to this single fresh database.
4. Configure Cloudflare Zero Trust / Access for the production hostname. Create self-hosted Access applications or destinations matching **both** `/admin*` and `/api/v1/admin*` and allow only the intended curator email(s). Verify path matching using Cloudflare's current Access UI. If using separate Access apps, record the application audience **for the API path** as `CAMPUSCONNECT_ACCESS_AUD`; that is the signed JWT audience checked by the Worker. Set `CAMPUSCONNECT_ACCESS_TEAM_DOMAIN` to the `<team>.cloudflareaccess.com` issuer hostname. This is a hostname-based **path** protection, not a Worker-level policy for the entire site, since students should eventually reach public pages without signing in.
5. Create a scoped Cloudflare API token with Worker deploy and D1 database/migration permissions, as advised in Cloudflare's current docs. Locate the Cloudflare account ID. **Never paste the token or administrator addresses into code, an issue, a PR, or chat.**

The Worker also validates signed Access JWTs and the exact administrator allowlist server-side. Access is needed at the edge too, because exposing the admin shell unnecessarily is avoidable.

## Required GitHub configuration (owner)

These settings live in the existing [CampusConnect repository](https://github.com/ricoxvl/campusconnect). Create a GitHub Actions **Environment named `pilot`** under Settings → Environments, and configure **required reviewers** if your repository plan allows it. The workflow has no automatic trigger. It only runs manually and is available from the Actions tab **after its PR is merged to the default branch**.

Set these **Environment variables** (Settings → Environments → pilot → Variables):

| Variable | Example shape |
| --- | --- |
| `CAMPUSCONNECT_D1_DATABASE_ID` | Real UUID of the new `campusconnect-production` D1 database |
| `CAMPUSCONNECT_HOST` | `campusconnect-production.<your-subdomain>.workers.dev` (host only, no `https://`) |
| `CAMPUSCONNECT_ACCESS_TEAM_DOMAIN` | `<team>.cloudflareaccess.com` |
| `CAMPUSCONNECT_ACCESS_AUD` | Audience of the Access application protecting `/api/v1/admin*` |

Set these **Environment secrets** (not repository files or frontend variables):

- `CLOUDFLARE_API_TOKEN` — Cloudflare API token scoped for this deployment.
- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare account ID.
- `CAMPUSCONNECT_ADMIN_EMAILS` — one or more approved email addresses, comma-separated.

Never use a `VITE_` variable for these values, since Vite may ship such variables to browsers.

## Manual release procedure

1. Review and merge the Phase 4 workflow PR only after GitHub CI passes and you understand the configuration. The earlier Phase 3 candidate queue PR is independent; **do not merge it accidentally**.
2. Complete the owner configuration above, create the Access path policies and verify the dedicated database is empty.
3. In GitHub: Actions → **Deploy CampusConnect pilot (manual only)** → Run workflow. Both confirmation checkboxes must be checked truthfully:
   - I created a dedicated production D1 database and reviewed migrations.
   - I configured Cloudflare Access for `/admin*` and `/api/v1/admin*`.
4. The action runs application tests and build, release-configuration unit tests, a Workers dry-run, remote D1 migrations, and finally the Worker deploy to `workers.dev`. It validates that a real UUID, exact hostname, team issuer, API audience and admin allowlist are present. Any missing value aborts before live steps.
5. After deployment, it reads `/api/v1/health`, `/api/v1/categories` and `/api/v1/events` and checks that anonymous access to `/api/v1/admin/session` is **not** successful. Find the resulting URL in the GitHub run summary. Passing those checks does **not** prove the Access configuration or event content is correct.

The workflow writes a temporary `wrangler.release.jsonc` file inside the job, which is ignored by Git. It sets `workers_dev=true` **only** for this intentional pilot release, while the checked-in production configuration remains fail-closed with `workers_dev=false`, a placeholder database and blank access values. The output is never uploaded as a workflow artifact. It sets `ALLOW_FICTIONAL_EVENTS=false` and exact same-origin CORS.

## Mandatory post-deploy checks before students

- In a private browser window, inspect the public landing page, categories, empty event list and navigation. Any event content must come from actual verified and explicitly published real records, not development fixtures.
- Check `/admin` and `/api/v1/admin/session` while signed out: Access should block/redirect. Try an authenticated but non-allowlisted identity and verify 403 from the backend; do not treat a generic Access login page as sufficient evidence.
- With a genuinely allowlisted admin identity, verify creating, editing, previewing and archiving a **draft**. Test actual event publication only after fresh source review and owner approval.
- Use the exact Comet Calendar source URLs in the candidate queue; event occurrence dates, eligibility, organizer, registration and locations may change. Never publish passed, incomplete or unverified occurrences.
- Test iPhone Safari and Android Chrome physically; inspect loading/error states, preference personalization, Top 3, search, saved events and official source links. Check accessibility, slow-network handling and timezone presentation.
- Review usage, free-tier quotas, security headers, request logs, error handling and ownership of daily source review.
- Establish a recovery point and operator before allowing live edits. An earlier Worker version does not reverse an applied D1 migration. Follow `docs/OPERATIONS.md` and `docs/PILOT-READINESS.md`.

## What remains manual

No connected Cloudflare deployment capability, API token, production database ID, account hostname or Access configuration is contained in this GitHub repository. Therefore creation of the first URL must wait for the owner's Cloudflare and GitHub setup. Do not run a deploy using guessed credentials or configure billing just to bypass Free-tier limits.

Cloudflare sources:
- https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/
- https://developers.cloudflare.com/workers/configuration/cloudflare-access/
- https://developers.cloudflare.com/workers/configuration/routing/workers-dev/
- https://developers.cloudflare.com/d1/get-started/
