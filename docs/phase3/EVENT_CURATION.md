# CampusConnect Phase 3 — Verified UT Dallas event curation

**Status:** Research and operating procedure only. This does not publish event listings or implement the importer. The GitHub repository currently contains a case-study README, not the application source. Integrate these procedures after Codex has synced the existing Phase 1/2 code.

## Verified source register (checked November 15, 2026)

| Priority | Source | URL | Use and limitations |
| --- | --- | --- | --- |
| Primary | UT Dallas **Comet Calendar** | https://calendar.utdallas.edu/ | University event calendar. Follow through to an **individual event page** before extracting any date, time, room, or eligibility. |
| Primary | Comet Calendar: upcoming events | https://calendar.utdallas.edu/calendar/upcoming | Discovery list only; verify individual entries because schedule and status may change. |
| Secondary | Student Organization Center | https://soc.utdallas.edu/events/ | Find organization-sponsored events; confirm each event from a dated official announcement. |
| Secondary | Student Union & Activities Advisory Board (SUAAB) | https://calendar.utdallas.edu/group/suaab | University student-programming group; verify each event, cost, audience, and requirements. |
| Secondary | UT Dallas Student Volunteerism / EngageUTD | https://volunteer.utdallas.edu/engageutd/ | Volunteer opportunities may live in GivePulse or behind university SSO. Do not scrape or copy private, authenticated data. |
| Conditional | University Career Center / 12twenty | https://career.utdallas.edu/12twenty-students/ | Career-event registration is through UT Dallas SSO. Do not ingest authenticated events automatically. Publicly announced events can be added after manual verification. |

The university describes Comet Calendar as an events publication managed through university departments and University Web Services: https://eventplanning.utdallas.edu/publicizing-your-event/comet-calendar/.

**CampusConnect is an independent student project, not an official UT Dallas calendar, partner, or university-approved service.** Link back to the official source and respect source terms. No bulk scraping is authorized by this document.

## Manual event-entry procedure

1. Open the event's official, publicly accessible **individual listing**. An aggregate calendar card is insufficient.
2. Capture exact title, organizer, start date/time, location, category, and the specific source URL. Record end time **only if shown**; never invent it.
3. Record timezone as `America/Chicago`; convert to UTC for storage with the correct daylight-saving offset.
4. Capture registration or eligibility **only when verified**. For unknown fields store `null` or `unknown`, never `false` by default.
5. Capture source evidence and the UTC time of the last manual check.
6. Check duplicates by canonical source URL and by normalized title + start time + location. Use review, not silent overwrite, for near matches.
7. Save as **draft**, review against the live source, then publish with an administrator authorization gate.
8. Reverify upcoming events at least 48 hours before a pilot session, and sooner if the organizer indicates changes.
9. Expired/canceled events must be omitted from Explore and Top 3 recommendations, even when their underlying rows remain stored for audit.
10. Preserve the verified source URL and clearly label updates or unknown information in the student UI.

## Publication gate

All must pass to mark an event published:
- Source URL resolves to a relevant **specific** event page and was reviewed manually.
- Event is upcoming at time of publication.
- Title, start date/time, organizer and meaningful location/mode are substantiated.
- No contradictory time, registration, cancellation, or audience details.
- Event is not a duplicate of a published item.
- The entry records reviewer identity (admin only) and `verified_at`.
- Unverified optional fields remain `unknown` rather than receiving unsupported default claims.
- The URL, title and wording don't suggest an official UT Dallas partnership.

If any check fails, leave the record as `draft` or `needs_review`. No event in the source register is automatically approved.

## Recommended event fields (contract, not an existing schema)

```ts
type EventStatus = "draft" | "needs_review" | "published" | "archived" | "canceled";
type VerificationStatus = "unverified" | "verified" | "needs_recheck";
type TriState = "yes" | "no" | "unknown";

interface CuratedEvent {
  id: string;
  title: string;
  description: string | null;
  category: string;
  interest_tags: string[];
  starts_at_utc: string; // ISO 8601
  ends_at_utc: string | null;
  timezone: "America/Chicago";
  location: string | null;
  location_mode: "in_person" | "online" | "hybrid" | "unknown";
  organizer: string;
  source_url: string;
  registration_url: string | null;
  eligibility_note: string | null;
  cost_note: string | null;
  newcomer_friendly: TriState;
  accessibility_note: string | null;
  status: EventStatus;
  verification_status: VerificationStatus;
  verified_at_utc: string | null;
  source_checked_at_utc: string;
  source_name: string;
}
```

The Phase 2 code and actual migrations must be inspected before adopting this proposed contract. Maintain compatibility with existing field names and API responses.

## Pilot catalog and operations

- Aim for **20–30 verified upcoming events** across diverse interests as an initial operational target, not a claim about inventory.
- Include realistic commuter considerations: start/end times, locations, and registration needs where confirmed.
- If fewer than three events match a student's interests/availability, explain the shortfall instead of inventing recommendations.
- Keep source checking and student-pilot metrics separate. Do not record attendance, RSVPs, retention, or user-test improvements without measurement and consent.
- Do not collect student emails/NetIDs for the MVP. Bookmarks remain local unless the product design changes with a privacy review.
- Maintain the official calendar source in each event detail view so students can verify changes before attending.
