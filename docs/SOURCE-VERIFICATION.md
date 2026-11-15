# Source verification and manual curation

CampusConnect is an independent student project, not an official UT Dallas service. It has no automated university integration, crawler, or source-verification service. A working URL or successful CSV preview is not verification. An authorized human must check each occurrence before publication.

## Discovery sources

| Public source | Use and observation on November 7, 2026 |
| --- | --- |
| [Official Comet Calendar](https://calendar.utdallas.edu/) | Discover university listings; open the individual event and check the selected occurrence. |
| [SUAAB group calendar](https://calendar.utdallas.edu/group/suaab) | Official calendar group for student programming; accessible discovery page. Group membership alone does not verify an event. |
| [Student Organization Center events](https://soc.utdallas.edu/events/) | Discovery starting point for organization activity; returned HTTP 502 in this session. No current event was inferred from this page. |

Use a university-hosted event page or a clearly authenticated hosting organization's public announcement. Check ownership and source currency manually; a calendar domain is not a guarantee that every submission is current. Do not copy private pages, bypass access restrictions, scrape in bulk, or infer affiliation/partnership.

## Prepared candidates, not published listings

`docs/data/pilot-candidates.csv` contains three manually researched occurrences. `pilot-source-review.json` records the observation timestamp (2026-11-07T23:03:51Z), organizer metadata and unresolved checks. The local preparation command imported them as **unverified drafts**. No real listing was verified or published by this work.

| Source | Explicit occurrence facts observed | Required final check |
| --- | --- | --- |
| [Spanglish Connection](https://calendar.utdallas.edu/event/spanglish-connection-fall26) | November 10 and November 17, 2026; 3–4:30 PM Central; SSB 4.500. Listed hosts: Student Counseling Center and Center for Students in Recovery. | The base page date is October 27; check the explicit recurrence list, not a generic upcoming badge. Confirm both occurrences remain scheduled and attendance eligibility. |
| [Comets Around the World: Harvest & Gratitude](https://calendar.utdallas.edu/event/comets-around-the-world-harvest-gratitude) | November 17, 2026; noon–2 PM Central; location field SU Mall, description mentions Plinth; listed department Student Wellness. | Confirm exact meeting point and hosting responsibility; department metadata was used for the draft organizer. |

Descriptions are brief paraphrases of the inspected listings. No registration URL was shown on either inspected page; registration remains empty. Newcomer status is unknown; do not infer it from an event title or general welcoming language. Categories/interests are curator classifications, not official endorsements. Organizer URLs remain null because none was verified. These date-specific candidates will become obsolete; skip/archive ended occurrences and research fresh candidates rather than shifting their dates.

## Review checklist for every occurrence

1. Open the individual official source using the dashboard link. Check page ownership and the actual date/recurrence. If unavailable, keep a draft and record the issue; do not fill gaps from memory.
2. Confirm title, factual description, campus location/room, hosting organization, start **and end** time, timezone, attendance eligibility and any cancellation/update notice. Resolve conflicting facts before publishing. If the end time is absent, leave the record unpublished until confirmed; never estimate one.
3. Use explicit ISO offsets when importing. The listed November 2026 examples use `-06:00`; summer dates generally use `-05:00`. Display is always America/Chicago. Each recurrence is a separate record with its actual start/end.
4. Confirm a registration link belongs to the stated event and check cost/eligibility/instructions. Leave registration empty when absent. CSV registration links are only private candidates; they become public only after explicit verification.
5. Leave newcomer status unknown unless explicit source evidence supports confirmed/unconfirmed details. Record evidence when asserting confirmed status. Avoid unsupported attendance promises.
6. Review duplicates by source plus start time and title/organizer/location plus start time. Edit the existing occurrence if its date/location changes; avoid creating another ID. Archive accidental duplicates after deciding which ID to retain for bookmarks.
7. Record factual verification evidence (source and facts checked, unresolved issues resolved), set the current last-verified time, explicitly attest, save, then review and confirm publication. A checked box without a genuine source review is not adequate.
8. Open the published student view and official source link. Check mobile time/location, eligibility and labels. Confirm production never shows fictional examples.

## Ongoing changes

Review daily during the pilot and again within 24 hours of an event where practical. The software cannot detect a change on an external website. Seven-day expiry is a backstop, not a substitute for review. Freshness is configurable with `REVERIFY_AFTER_DAYS` (1–90, default 7).

For cancellation, set occurrence status canceled and a source-supported change note; renew verification if facts changed. This removes discovery/recommendations while preserving a clear notice in published saved details. If facts cannot be confirmed, unpublish immediately; saved IDs remain as unavailable entries. For updates, edit the same ID, add a concise change note, recheck the source and attest again. Fact changes without renewed verification revert real published records to drafts. Ended events stop being recommended automatically; archive historical records through the expired queue when appropriate.
