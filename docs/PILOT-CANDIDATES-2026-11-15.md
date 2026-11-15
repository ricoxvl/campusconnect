# Pilot event queue — reviewed source snapshot, November 15, 2026

**Status: review-only. Nothing has been published, verified in the admin system, or deployed.** This document supports manual curation of a limited UT Dallas student pilot; CampusConnect is an independent student project and does not represent UT Dallas.

## Prepared inputs

- `docs/data/pilot-candidates-2026-11-15.csv`: **15 distinct future occurrences** dated November 16–December 8, 2026. These are source-backed, **unverified real-event drafts**, not public events.
- `docs/data/pilot-source-review-2026-11-15.json`: eight source-attributed organizer candidates, nine exact event source URLs, recurrence dates and review flags.
- The existing `npm run prepare:pilot` helper now reads those two dated files **only against loopback local development**. It never marks events verified/published and cannot point to a production API. It preserves earlier local records and duplicate checks report previously imported occurrences.
- The prior `docs/data/pilot-candidates.csv` and `pilot-source-review.json` remain as a November 7 historical record; they contain the **expired November 10 occurrence** and must not be used as today's active candidate list.

## Candidate event mix

| Source-backed listing | Candidate occurrences (Central time) | Primary focus | Review gate |
| --- | --- | --- | --- |
| Hunger & Homelessness Awareness Week Kickoff | Nov 16, noon–3 PM | Volunteering | Confirm same-day location and availability |
| Conversational English Class and US Culture | Nov 16, Nov 30 and Dec 7, noon–1:30 PM | Social/culture | Verify international-student/spouse audience and SSB 2.400 vs. ICP room label |
| Travel-themed friendship bracelets | Nov 16, 2–4 PM; Nov 19, noon–2 PM | Social/culture | Confirm the Commons building; the source names the Undergraduate Lounge but not the building |
| Vinyasa Yoga | Nov 16 and Nov 18, 3–4 PM | Fitness | Confirm UREC access and participation requirements |
| Jonsson School: Effective Communication | Nov 16, 4–5 PM | Career/community | Confirm organization-leadership audience |
| Nokia Tabling in ECS South | Nov 17, 9 AM–1 PM | Career/technology | Confirm eligible majors and levels; do not imply all students are eligible |
| Global Family Cafe | Nov 17, Dec 1 and Dec 8, 9:30–11:30 AM | Social/culture | Use the exact `global-family-cafe-1151` page; another similarly named page lists a different location; review minors policy |
| SOC Grocery Bingo | Nov 19, 12:30–2:30 PM | Social | Check that rooms A and B and participant rules are current |
| Fall into Rhythm: Anime Orchestra Ensemble | Nov 20, 6:30–8 PM | Arts/gaming | Verify outdoor Plinth vs indoor weather fallback |

All times were transcribed from individual official Comet Calendar pages viewed on November 15, 2026. Any dates in the table can become stale. For source URLs and individual occurrence evidence, consult the JSON source review file. Categories and interest tags are CampusConnect's curation suggestions and are **not** university classifications.

## Manual review before publishing

1. Open each exact individual Comet Calendar event URL shortly before publishing. Compare the occurrence's date, timezone, start/end, location, source organization, eligibility, cancellation notices and registration instructions. Verify information from the page, not only the candidate CSV.
2. Resolve all source contradictions and missing details, especially the JSOM Commons building and the two intercultural recurring-event pages. Do **not** guess. Exclude already-ended rows.
3. Verify new organizer names and IDs in the administrator interface. Candidate IDs are local curation identifiers, not affiliated/university-issued credentials.
4. Use the CSV Preview UI for validation. Commit only selected valid rows; the importer creates unverified drafts with private registration candidate fields. Do not auto-publish them.
5. Review each draft, write evidence of date/time/source checks, explicitly attest and publish **only after the project owner approves live release**. Leave newcomer status unknown unless the official source supports a stronger claim.
6. Verify public API results, Top 3, search, time zone, links and saved-event refresh against real published records. Avoid showing fictional examples in production.
7. Re-review daily during the pilot and before each occurrence. Archive expired entries, cancel source-confirmed cancellations and never silently shift an expired event into the future.

## Local smoke path (no production changes)

```sh
npm ci
npm run setup:local
npm run db:migrate
npm run db:seed
npm run dev
# In a second terminal:
npm run prepare:pilot
npm test
npm run build
```

The source snapshot itself does not establish that new candidates are current when you run these commands. The local importer will report errors for expired/duplicate rows and will not publish them. Production D1 UUID, Cloudflare Access credentials, domain, approved deployment and human source review are still required. See `docs/PILOT-READINESS.md` and `docs/OPERATIONS.md`.
