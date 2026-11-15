# CSV import and review

Open `/admin`, authenticate, create required category/organizer records, then choose **CSV import**. IDs are displayed in the metadata managers. Download `/event-import-template.csv`; its sample event is fictional. Use UTF-8 CSV with one header and at most 50 records, at most 60,000 bytes of CSV text. Quoted commas, escaped double quotes, CRLF and multiline fields are supported.

| Header | Meaning |
| --- | --- |
| `title`, `description` | Required factual text; fictional titles must include Sample, Fictional or Test. |
| `category_id` | Required existing primary category ID. |
| `interest_ids` | Optional existing IDs separated with `\|`. |
| `organizer_id` | Required existing organizer ID. Create it first; imports never invent organizers. |
| `starts_at`, `ends_at` | Required ISO 8601 instants with explicit UTC offset; end after start. |
| `location` | Required actual campus location; unresolved details block human approval. |
| `source_name` | Required source label. |
| `source_url` | Official HTTPS event URL; required for real rows. |
| `registration_url`, `registration_details` | Optional private, unverified registration candidate. Never published by import. |
| `fictional` | `true` for labeled development examples; `false` or blank for real candidates. |
| `what_to_expect` | Optional source-supported attendance information. |

Only these headers are accepted. Verification, last-verified, newcomer approval and publication columns are deliberately rejected. Unknown IDs, invalid/unsafe URLs, malformed fields, expired occurrences, and duplicate occurrences produce preview errors. Header/CSV syntax errors block the file; record errors block those rows only. Preview shows logical record numbers (header is 1), not physical lines when fields span lines.

## Two-stage workflow

1. Upload/paste the CSV and select Preview import. This has no writes and does not fetch external URLs.
2. Inspect every row and duplicate reference, correct errors, then preview again. Select valid rows to import.
3. Confirm import. The server re-parses and revalidates the original CSV against current database records; it never trusts the preview payload. Each request selects at most **five** record numbers. The dashboard submits larger selections in batches and reports progress.
4. Open Review imported drafts. Every new record is a scheduled **draft**, with unverified source information and unknown newcomer status. Registration candidates stay admin-only. Follow SOURCE-VERIFICATION.md for source checks, verification and a separate publication confirmation.

An individual event, tags and audit entry commit atomically. An entire file is not a single transaction: earlier rows/batches can succeed before a later failure. If interrupted, refresh and preview the file again; duplicate checks identify completed rows. Do not assume nothing was imported and resend blindly. Concurrent duplicate writes are rejected by unique database indexes; the importer reports row conflicts. Correct existing events in the event editor rather than treating CSV as an update/overwrite feature.

Duplicates compare canonical source URL plus start instant, or normalized title + start instant + organizer ID + location. Tracking/fragment variations do not create a new occurrence; a different recurrence date does. A postponed event must be edited under its existing ID. Archived duplicates do not reserve an active identity. Legacy duplicates remain visible in the review queue and are suppressed in public lists/recommendations until curated.

The preview/commit HTTP JSON limit is 131,072 bytes to allow escaping; CSV itself remains limited to 60,000 bytes. Normal admin JSON requests remain 64 KiB. Batching bounds D1 queries per request and keeps the workflow suitable for a small pilot; it does not promise unlimited free hosting or bulk ingestion.
