import { z } from "zod";
import { DAYS, PERIODS } from "../shared/contracts";
export const idSchema = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/);
const text = (max: number) => z.string().trim().min(1).max(max);
const https = z
  .url()
  .max(2048)
  .refine((value) => {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password;
  }, "Use an HTTPS URL without credentials");
export const instant = z.iso
  .datetime({ offset: true })
  .refine((value) => Number.isFinite(Date.parse(value)), "Invalid timestamp");
export const preferencesSchema = z
  .object({
    interests: z.array(text(80)).max(30),
    days: z.array(z.enum(DAYS)).max(7),
    periods: z.array(z.enum(PERIODS)).max(3),
    anyTime: z.boolean().default(false),
    noSchedulePreference: z.boolean().default(false),
  })
  .strict()
  .superRefine((p, ctx) => {
    if (
      !p.noSchedulePreference &&
      (!p.days.length || (!p.anyTime && !p.periods.length))
    )
      ctx.addIssue({
        code: "custom",
        message: "Choose days and time periods, or no schedule preference.",
      });
  });
export const querySchema = z
  .object({
    q: z.string().trim().max(200).default(""),
    category: z.array(text(80)).max(30).default([]),
    from: instant.optional(),
    to: instant.optional(),
    day: z.array(z.enum(DAYS)).max(7).default([]),
    period: z.array(z.enum(PERIODS)).max(3).default([]),
    anyTime: z.enum(["true", "false"]).default("false"),
    date: z.enum(["all", "today", "week", "next-week"]).default("all"),
    page: z.coerce.number().int().min(1).max(10000).default(1),
    pageSize: z.coerce.number().int().min(1).max(50).default(18),
    sort: z.enum(["soonest", "latest"]).default("soonest"),
  })
  .strict()
  .superRefine((q, ctx) => {
    if (q.from && q.to && Date.parse(q.from) >= Date.parse(q.to))
      ctx.addIssue({ code: "custom", message: "from must be before to" });
  });
export type Query = z.infer<typeof querySchema>;
export const categorySchema = z
  .object({ id: idSchema.optional(), name: text(80) })
  .strict();
export const organizerSchema = z
  .object({
    id: idSchema.optional(),
    name: text(160),
    url: https.nullable().default(null),
  })
  .strict();
export const eventSchema = z
  .object({
    id: idSchema.optional(),
    title: text(180),
    description: text(10000),
    categoryId: idSchema,
    interestIds: z.array(idSchema).max(30).default([]),
    organizerId: idSchema,
    startsAt: instant,
    endsAt: instant,
    location: text(300),
    source: z
      .object({ name: text(180), url: https.nullable().default(null) })
      .strict(),
    fictional: z.boolean().default(false),
    verification: z
      .object({
        status: z.enum(["verified", "unverified"]),
        lastVerifiedAt: instant.nullable().default(null),
        evidence: z.string().trim().max(2000).nullable().default(null),
      })
      .strict()
      .default({ status: "unverified", lastVerifiedAt: null, evidence: null }),
    newcomer: z
      .object({
        status: z.enum(["confirmed", "unconfirmed", "unknown"]),
        details: z.string().trim().max(2000).nullable().default(null),
        evidence: z.string().trim().max(2000).nullable().default(null),
      })
      .strict()
      .default({ status: "unknown", details: null, evidence: null }),
    registration: z
      .object({ url: https, details: text(2000), lastVerifiedAt: instant })
      .strict()
      .nullable()
      .default(null),
    whatToExpect: z.string().trim().max(3000).nullable().default(null),
    status: z.enum(["draft", "published", "archived"]).default("draft"),
    occurrenceStatus: z.enum(["scheduled", "canceled"]).default("scheduled"),
    changeNote: z.string().trim().max(2000).nullable().default(null),
    registrationCandidate: z
      .object({ url: https, details: z.string().trim().max(2000).default("") })
      .strict()
      .nullable()
      .default(null),
  })
  .strict();
const fields = eventSchema.shape;
// PATCH fields must not inherit create-time defaults: omitted values stay untouched.
export const eventPatchSchema = z
  .object({
    title: fields.title.optional(),
    description: fields.description.optional(),
    categoryId: fields.categoryId.optional(),
    interestIds: fields.interestIds.removeDefault().optional(),
    organizerId: fields.organizerId.optional(),
    startsAt: fields.startsAt.optional(),
    endsAt: fields.endsAt.optional(),
    location: fields.location.optional(),
    source: fields.source.optional(),
    fictional: fields.fictional.removeDefault().optional(),
    verification: fields.verification.removeDefault().optional(),
    newcomer: fields.newcomer.removeDefault().optional(),
    registration: fields.registration.removeDefault().optional(),
    whatToExpect: fields.whatToExpect.removeDefault().optional(),
    status: fields.status.removeDefault().optional(),
    occurrenceStatus: fields.occurrenceStatus.removeDefault().optional(),
    changeNote: fields.changeNote.removeDefault().optional(),
    registrationCandidate: fields.registrationCandidate
      .removeDefault()
      .optional(),
  })
  .strict();
export type EventInput = z.infer<typeof eventSchema>;
export function validateEvent(value: unknown, now: number): EventInput {
  const event = eventSchema.parse(value);
  const issues: string[] = [];
  if (Date.parse(event.endsAt) <= Date.parse(event.startsAt))
    issues.push("End time must be after start time.");
  if (event.occurrenceStatus === "canceled" && !event.changeNote)
    issues.push("Provide a cancellation note referencing what changed.");
  if (event.fictional && event.registrationCandidate)
    issues.push("Fictional examples cannot include registration links.");
  if (event.fictional && event.verification.status === "verified")
    issues.push("Fictional events cannot be verified.");
  if (
    event.verification.status === "verified" &&
    (!event.source.url ||
      !event.verification.lastVerifiedAt ||
      !event.verification.evidence)
  )
    issues.push(
      "Verification requires an official source URL, last-verified timestamp and evidence.",
    );
  if (
    event.verification.lastVerifiedAt &&
    Date.parse(event.verification.lastVerifiedAt) > now
  )
    issues.push("Verification dates cannot be in the future.");
  if (
    event.status === "published" &&
    !event.fictional &&
    event.verification.status !== "verified"
  )
    issues.push("Real events must be verified before publication.");
  if (event.status === "published" && Date.parse(event.endsAt) <= now)
    issues.push("An expired event cannot be published.");
  if (event.fictional && !/\b(sample|fictional|test)\b/i.test(event.title))
    issues.push(
      "Fictional event titles must explicitly include Sample, Fictional, or Test.",
    );
  if (
    event.newcomer.status === "confirmed" &&
    (!event.newcomer.details || !event.newcomer.evidence)
  )
    issues.push(
      "Confirmed newcomer status requires details and supporting evidence.",
    );
  if (
    event.registration &&
    (event.fictional ||
      event.verification.status !== "verified" ||
      Date.parse(event.registration.lastVerifiedAt) > now)
  )
    issues.push(
      "Registration information requires a verified real event and a nonfuture verification date.",
    );
  if (issues.length)
    throw new z.ZodError(
      issues.map((message) => ({ code: "custom" as const, path: [], message })),
    );
  return event;
}
