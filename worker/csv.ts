import { z } from "zod";
import { identityKeys } from "../shared/quality";
import type { Env } from "./env";
import {
  categories,
  importExistingEvents,
  organizers,
  saveEvent,
} from "./database";
import { HttpError } from "./http";
import { validateEvent, type EventInput } from "./validation";
export const csvRequestSchema = z
  .object({
    csv: z
      .string()
      .min(1)
      .max(60000)
      .refine(
        (value) => new TextEncoder().encode(value).byteLength <= 60000,
        "Use at most 60 KB of CSV text.",
      ),
  })
  .strict();
export const csvCommitSchema = csvRequestSchema
  .extend({ rows: z.array(z.number().int().min(2).max(51)).min(1).max(5) })
  .strict();
export const CSV_HEADERS = [
  "title",
  "description",
  "category_id",
  "interest_ids",
  "organizer_id",
  "starts_at",
  "ends_at",
  "location",
  "source_name",
  "source_url",
  "registration_url",
  "registration_details",
  "fictional",
  "what_to_expect",
] as const;
const required = [
  "title",
  "description",
  "category_id",
  "organizer_id",
  "starts_at",
  "ends_at",
  "location",
  "source_name",
];
export function parseCsv(text: string): Record<string, string>[] {
  const input = text.replace(/^\uFEFF/, "");
  if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(input))
    throw new HttpError(
      422,
      "invalid_csv",
      "CSV contains unsupported control characters.",
    );
  const records: string[][] = [];
  let row: string[] = [],
    field = "",
    quoted = false,
    closed = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i];
    if (quoted) {
      if (c === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else field += c;
      continue;
    }
    if (c === '"') {
      if (field || closed)
        throw new HttpError(
          422,
          "invalid_csv",
          "Quote characters must wrap the entire field.",
        );
      quoted = true;
      continue;
    }
    if (c === "," || c === "\n" || c === "\r") {
      row.push(field);
      field = "";
      closed = false;
      if (c !== ",") {
        if (c === "\r" && input[i + 1] === "\n") i++;
        if (row.some((value) => value.trim())) records.push(row);
        row = [];
        if (records.length > 51)
          throw new HttpError(
            422,
            "csv_limit",
            "Import at most 50 records at a time.",
          );
      }
    } else {
      if (closed)
        throw new HttpError(
          422,
          "invalid_csv",
          "Unexpected text after a quoted field.",
        );
      field += c;
    }
  }
  if (quoted)
    throw new HttpError(
      422,
      "invalid_csv",
      "A quoted CSV field was not closed.",
    );
  if (field || row.length || closed) {
    row.push(field);
    if (row.some((value) => value.trim())) records.push(row);
  }
  if (records.length < 2)
    throw new HttpError(
      422,
      "invalid_csv",
      "Include a header and at least one event.",
    );
  if (records.length > 51)
    throw new HttpError(
      422,
      "csv_limit",
      "Import at most 50 records at a time.",
    );
  const header = records.shift()!.map((name) => name.trim());
  if (
    new Set(header).size !== header.length ||
    header.some(
      (name) => !CSV_HEADERS.includes(name as (typeof CSV_HEADERS)[number]),
    ) ||
    required.some((name) => !header.includes(name))
  )
    throw new HttpError(
      422,
      "csv_headers",
      `Use the template headers. Required: ${required.join(", ")}. Verification and publication columns are not accepted.`,
    );
  return records.map((values, index) => {
    if (values.length !== header.length)
      throw new HttpError(
        422,
        "invalid_csv",
        `Record ${index + 2} has ${values.length} fields; expected ${header.length}.`,
      );
    return Object.fromEntries(
      header.map((name, i) => [name, values[i].trim()]),
    );
  });
}
export interface ImportRow {
  row: number;
  title: string;
  input: EventInput | null;
  errors: string[];
  duplicateOf?: { id: string; title: string; status: string };
}
export async function previewCsv(
  env: Env,
  csv: string,
  now: number,
): Promise<ImportRow[]> {
  const rows = parseCsv(csv);
  const categoryIds = new Set((await categories(env)).map((c) => c.id));
  const organizerIds = new Set((await organizers(env)).map((o) => o.id));
  const existingEvents = await importExistingEvents(
    env,
    rows.map((row) => Date.parse(row.starts_at)).filter(Number.isFinite),
  );
  const seen = new Set<string>();
  const preview: ImportRow[] = [];
  for (let i = 0; i < rows.length; i++) {
    const record = rows[i],
      errors: string[] = [];
    let input: EventInput | null = null;
    if (record.fictional && !["true", "false"].includes(record.fictional))
      errors.push("fictional must be true or false.");
    try {
      input = validateEvent(
        {
          title: record.title,
          description: record.description,
          categoryId: record.category_id,
          interestIds: record.interest_ids
            ? record.interest_ids
                .split("|")
                .map((x) => x.trim())
                .filter(Boolean)
            : [],
          organizerId: record.organizer_id,
          startsAt: record.starts_at,
          endsAt: record.ends_at,
          location: record.location,
          source: { name: record.source_name, url: record.source_url || null },
          fictional: record.fictional === "true",
          status: "draft",
          registrationCandidate: record.registration_url
            ? {
                url: record.registration_url,
                details: record.registration_details ?? "",
              }
            : null,
          whatToExpect: record.what_to_expect || null,
        },
        now,
      );
      if (!input.fictional && !input.source.url)
        errors.push("A real event requires an official event URL.");
      if (
        !categoryIds.has(input.categoryId) ||
        input.interestIds.some((id) => !categoryIds.has(id))
      )
        errors.push("Use existing category and interest IDs.");
      if (!organizerIds.has(input.organizerId))
        errors.push("Use an existing organizer ID.");
      if (Date.parse(input.endsAt) <= now)
        errors.push("This event has already ended.");
      if (input.fictional && input.registrationCandidate)
        errors.push("Fictional examples cannot include registration links.");
    } catch (error) {
      if (error instanceof z.ZodError)
        errors.push(
          ...error.issues.map(
            (i) => `${i.path.join(".") || "event"}: ${i.message}`,
          ),
        );
      else throw error;
    }
    let duplicateOf: ImportRow["duplicateOf"];
    if (input) {
      const keys = identityKeys(input);
      if (keys.some((key) => seen.has(key)))
        errors.push("Duplicate occurrence within this file.");
      keys.forEach((key) => seen.add(key));
      const existing = existingEvents.find((event) =>
        identityKeys(event).some((key) => keys.includes(key)),
      );
      if (existing) {
        duplicateOf = {
          id: existing.id,
          title: existing.title,
          status: existing.status!,
        };
        errors.push("This occurrence already exists. Edit the existing event.");
      }
    }
    preview.push({
      row: i + 2,
      title: record.title,
      input,
      errors,
      ...(duplicateOf ? { duplicateOf } : {}),
    });
  }
  return preview;
}
export async function commitCsv(
  env: Env,
  csv: string,
  selected: number[],
  actor: string,
  now: number,
) {
  const preview = await previewCsv(env, csv, now);
  const requested = new Set(selected);
  if (
    requested.size !== selected.length ||
    [...requested].some((row) => !preview.some((item) => item.row === row))
  )
    throw new HttpError(
      422,
      "invalid_selection",
      "Select existing preview record numbers once each.",
    );
  const rows = preview.filter((row) => requested.has(row.row));
  if (rows.some((row) => row.errors.length || !row.input))
    throw new HttpError(
      422,
      "import_not_ready",
      "Some selected records have errors or duplicates. Preview the file again.",
    );
  const results: {
    row: number;
    status: "created" | "conflict";
    id?: string;
    message: string;
  }[] = [];
  for (const row of rows) {
    const id = crypto.randomUUID();
    try {
      await saveEvent(env, row.input!, id, now, true, actor);
      results.push({
        row: row.row,
        status: "created",
        id,
        message:
          "Created as an unverified draft. Review the official source before publication.",
      });
    } catch (error) {
      if (
        (error instanceof HttpError && error.status === 409) ||
        (error instanceof Error && /UNIQUE constraint/.test(error.message))
      )
        results.push({
          row: row.row,
          status: "conflict",
          message:
            "Another import or edit already created this occurrence. Refresh the preview.",
        });
      else throw error;
    }
  }
  return results;
}
