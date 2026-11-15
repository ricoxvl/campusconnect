# Limited UT Dallas student pilot checklist

The local Phase 3 implementation is tested; **the pilot is not deployed or cleared to launch**. No production resource, remote migration or real-event publication occurred. Use VALIDATION.md for measured results and limits.

## Implemented and exercised locally

- [x] Existing Phase 2 baseline tested before incremental changes.
- [x] Additive local D1 migration; schema/query/atomic write tests.
- [x] Protected responsive admin editor, metadata managers, CSV preview/import, publication/unpublish/archive confirmations and audit history.
- [x] Source-backed candidate manifest and three local **unverified drafts**, with explicit unresolved review steps.
- [x] Duplicate detection, cancellation, verification/registration freshness, expired-event exclusion and quality queues.
- [x] Up to three deterministic interest/availability recommendations with explanations, including interest-only students.
- [x] Student loading/error/empty states, official source links, saved-record refresh and persistent preferences/bookmarks.
- [x] Automated frontend/backend/integration tests and mobile/desktop Chromium journeys; built-app security headers exercised locally.
- [x] Separate development/production configuration, secret example, dry-run packaging, operations and rollback documentation.

## Owner steps before inviting students

- [ ] Review the source snapshot on `main` in [ricoxvl/campusconnect](https://github.com/ricoxvl/campusconnect), confirm CI results, and choose the approved pilot release commit. The earlier project overview is preserved in PRODUCT-CASE-STUDY.md; the existing draft documentation PR is separate.
- [ ] Select a pilot owner, authorized curator identities, support contact and a small invitation scope. Do not imply university affiliation.
- [ ] Review current free-tier quotas/logging retention and approve the specific deployment/configuration. Do not create paid services.
- [ ] Configure the production hostname, dedicated D1 UUID, exact origin, Access team/audience and ADMIN_EMAILS; keep workers.dev disabled and fictional records false.
- [ ] Configure Access policies for `/admin*` **and** `/api/v1/admin*`; exercise a real allowed login, an authenticated non-admin denial and an anonymous API denial on the actual hostname. Local JWT tests cannot replace this.
- [ ] Back up any existing production data and record a compatible rollback version/bookmark. Review migrations 0001 and 0002; apply remotely only after approval. Never use the fictional seed or local pilot helper against production.
- [ ] Add/review real candidates using CSV or the editor. Freshly check each occurrence against official sources; resolve Harvest host/meeting-point ambiguity, recurrence dates and eligibility before verifying. Empty/missing registration is preferable to a guess.
- [ ] Publish only currently scheduled, future, source-verified listings after explicit approval. Clear duplicate/stale review flags, and verify canceled/expired events never appear in lists/recommendations. Do not blanket-publish draft imports.
- [ ] Exercise actual-domain list/search/combined filters/details/Top 3 and source/registration links; save an event, update/cancel/unpublish it, refresh the plan and confirm bookmarks/preferences survive.
- [ ] Test real iPhone Safari and Android Chrome with touch, zoom/text scaling, rotation, keyboard/screen reader, slow network/offline/retry and resume-from-background behavior. Chromium emulation passed, but physical devices/Safari were not available here.
- [ ] Check request IDs, health, provider error/latency/quota views and chosen support/notification process. Assign daily source review and near-event rechecks; rehearse compatible rollback instructions before opening the pilot.

## Deliberate limits

Manual source review remains necessary; no scraper, feed sync, cancellation detector, automatic verification, paid monitor or student authentication was added. Small catalog scans and last-write-wins editing suit a limited curated pilot, not unrestricted concurrent administration or a large public catalog. Browser checks use Chromium emulation, not an accessibility certification or cross-browser certification. A deployment approval or actual student invite is a separate step.
