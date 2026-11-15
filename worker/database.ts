import type {
  CampusEvent,
  Category,
  EventPage,
  Organizer,
  Preferences,
  Recommendation,
} from "../shared/contracts";
import { calendarRange, scheduleMatch } from "../shared/schedule";
import type { Env } from "./env";
import {
  canonicalSource,
  identityKeys,
  isStale,
  reviewDays,
} from "../shared/quality";
import { auditStatement } from "./audit";
import { HttpError } from "./http";
import {
  compareRecommendations,
  scoreEvent,
  scoringWeights,
} from "./recommendations";
import type { EventInput, Query } from "./validation";

interface Row {
  id: string;
  title: string;
  description: string;
  category_id: string;
  organizer_id: string;
  starts_at: number;
  ends_at: number;
  location: string;
  source_name: string;
  source_url: string | null;
  fictional: number;
  verification_status: "verified" | "unverified";
  last_verified_at: number | null;
  verification_evidence: string | null;
  newcomer_status: "confirmed" | "unconfirmed" | "unknown";
  newcomer_details: string | null;
  newcomer_evidence: string | null;
  registration_url: string | null;
  registration_details: string | null;
  registration_verified_at: number | null;
  what_to_expect: string | null;
  status: "draft" | "published" | "archived";
  created_at: number;
  updated_at: number;
  occurrence_status: "scheduled" | "canceled";
  change_note: string | null;
  pending_registration_url: string | null;
  pending_registration_details: string | null;
  source_key: string | null;
  identity_key: string | null;
  category_name: string;
  organizer_name: string;
  interest_json: string;
}
const SELECT = `SELECT e.*, c.name AS category_name, o.name AS organizer_name,
  (SELECT json_group_array(json_object('id',ic.id,'name',ic.name)) FROM event_interests ei JOIN categories ic ON ic.id=ei.category_id WHERE ei.event_id=e.id) AS interest_json
  FROM events e JOIN categories c ON c.id=e.category_id JOIN organizers o ON o.id=e.organizer_id`;
const iso = (value: number | null) =>
  value === null ? null : new Date(value).toISOString();
export function publicEvent(
  row: Row,
  env?: Env,
  now = Date.now(),
): CampusEvent {
  const stale =
    !row.fictional &&
    isStale(
      iso(row.last_verified_at),
      now,
      reviewDays(env?.REVERIFY_AFTER_DAYS),
    );
  const interests = JSON.parse(row.interest_json || "[]") as Category[];
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    categories: [
      ...new Set([row.category_name, ...interests.map((c) => c.name)]),
    ],
    startsAt: iso(row.starts_at)!,
    endsAt: iso(row.ends_at)!,
    timeZone: "America/Chicago",
    location: row.location,
    organizer: row.organizer_name,
    organizerId: row.organizer_id,
    source: {
      name: row.source_name,
      url: row.source_url,
      verified:
        !row.fictional && row.verification_status === "verified" && !stale,
    },
    fictional: !!row.fictional,
    verificationStatus: stale ? "unverified" : row.verification_status,
    lastVerifiedAt: iso(row.last_verified_at),
    status: row.status,
    occurrenceStatus: row.occurrence_status,
    changeNote: row.change_note,
    updatedAt: iso(row.updated_at)!,
    reviewRequired: stale,
    newcomerStatus: stale ? "unknown" : row.newcomer_status,
    ...(row.newcomer_status !== "unknown" && row.newcomer_details && !stale
      ? {
          newcomer: {
            friendly: row.newcomer_status === "confirmed",
            details: row.newcomer_details,
            evidence:
              row.newcomer_evidence ?? "Not confirmed by the organizer.",
          },
        }
      : {}),
    ...(row.registration_url &&
    !stale &&
    !isStale(
      iso(row.registration_verified_at),
      now,
      reviewDays(env?.REVERIFY_AFTER_DAYS),
    )
      ? {
          registration: {
            url: row.registration_url,
            details: row.registration_details!,
            lastVerifiedAt: iso(row.registration_verified_at)!,
          },
        }
      : {}),
    ...(row.what_to_expect ? { whatToExpect: row.what_to_expect } : {}),
  };
}
export function adminEvent(
  row: Row,
): EventInput & { id: string; updatedAt: string } {
  const interests = JSON.parse(row.interest_json || "[]") as Category[];
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    categoryId: row.category_id,
    interestIds: interests.map((c) => c.id),
    organizerId: row.organizer_id,
    startsAt: iso(row.starts_at)!,
    endsAt: iso(row.ends_at)!,
    location: row.location,
    source: { name: row.source_name, url: row.source_url },
    fictional: !!row.fictional,
    verification: {
      status: row.verification_status,
      lastVerifiedAt: iso(row.last_verified_at),
      evidence: row.verification_evidence,
    },
    newcomer: {
      status: row.newcomer_status,
      details: row.newcomer_details,
      evidence: row.newcomer_evidence,
    },
    registration: row.registration_url
      ? {
          url: row.registration_url,
          details: row.registration_details!,
          lastVerifiedAt: iso(row.registration_verified_at)!,
        }
      : null,
    whatToExpect: row.what_to_expect,
    status: row.status,
    occurrenceStatus: row.occurrence_status,
    changeNote: row.change_note,
    registrationCandidate: row.pending_registration_url
      ? {
          url: row.pending_registration_url,
          details: row.pending_registration_details ?? "",
        }
      : null,
    updatedAt: iso(row.updated_at)!,
  };
}
function publicWhere(env: Env) {
  return `e.status='published' AND ${env.ENVIRONMENT === "development" && env.ALLOW_FICTIONAL_EVENTS === "true" ? "(e.fictional=1 OR e.verification_status='verified')" : "e.fictional=0 AND e.verification_status='verified'"}`;
}
export async function getEvent(env: Env, id: string, admin = false) {
  return env.DB.prepare(
    `${SELECT} WHERE e.id=? ${admin ? "" : `AND ${publicWhere(env)}`}`,
  )
    .bind(id)
    .first<Row>();
}
export async function categories(env: Env) {
  return (
    await env.DB.prepare(
      "SELECT id,name FROM categories ORDER BY name COLLATE NOCASE",
    ).all<Category>()
  ).results;
}
export async function organizers(env: Env) {
  return (
    await env.DB.prepare(
      "SELECT id,name,url FROM organizers ORDER BY name COLLATE NOCASE",
    ).all<Organizer>()
  ).results;
}
function candidateQuery(env: Env, q: Query, now: number) {
  const clauses = [
    publicWhere(env),
    "e.starts_at>=?",
    "e.occurrence_status='scheduled'",
    "(e.fictional=1 OR e.last_verified_at>=?)",
  ];
  const values: (string | number)[] = [
    now,
    now - reviewDays(env.REVERIFY_AFTER_DAYS) * 86400000,
  ];
  if (q.q) {
    clauses.push(
      `instr(lower(e.title || ' ' || e.description || ' ' || e.location || ' ' || o.name || ' ' || c.name || ' ' || coalesce((SELECT group_concat(sc.name,' ') FROM event_interests si JOIN categories sc ON sc.id=si.category_id WHERE si.event_id=e.id),'')),lower(?))>0`,
    );
    values.push(q.q);
  }
  if (q.category.length) {
    clauses.push(
      `EXISTS (SELECT 1 FROM categories fc WHERE (fc.id IN (SELECT value FROM json_each(?)) OR fc.name IN (SELECT value FROM json_each(?))) AND (fc.id=e.category_id OR EXISTS (SELECT 1 FROM event_interests fi WHERE fi.event_id=e.id AND fi.category_id=fc.id)))`,
    );
    values.push(JSON.stringify(q.category), JSON.stringify(q.category));
  }
  if (q.from) {
    clauses.push("e.starts_at>=?");
    values.push(Date.parse(q.from));
  }
  if (q.to) {
    clauses.push("e.starts_at<?");
    values.push(Date.parse(q.to));
  }
  const range = calendarRange(q.date, now);
  if (range) {
    clauses.push("e.starts_at>=? AND e.starts_at<?");
    values.push(...range);
  }
  return {
    sql: `${SELECT} WHERE ${clauses.join(" AND ")} ORDER BY e.starts_at ${q.sort === "latest" ? "DESC" : "ASC"},e.id ASC`,
    values,
  };
}
async function* candidates(env: Env, q: Query, now: number) {
  const { sql, values } = candidateQuery(env, q, now);
  const seen = new Set<string>();
  for (let offset = 0; ; offset += 100) {
    const { results } = await env.DB.prepare(`${sql} LIMIT ? OFFSET ?`)
      .bind(...values, 100, offset)
      .all<Row>();
    for (const row of results) {
      const event = publicEvent(row, env, now);
      const keys = identityKeys(event);
      if (keys.some((key) => seen.has(key))) continue;
      keys.forEach((key) => seen.add(key));
      yield event;
    }
    if (results.length < 100) return;
  }
}
export async function listEvents(
  env: Env,
  q: Query,
  now: number,
): Promise<EventPage> {
  let total = 0;
  const data: CampusEvent[] = [];
  const offset = (q.page - 1) * q.pageSize;
  for await (const event of candidates(env, q, now)) {
    if (q.day.length || q.period.length) {
      // An omitted dimension means any day/time for filtering (not onboarding).
      const p: Preferences = {
        interests: [],
        days: q.day.length
          ? q.day
          : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        periods: q.period,
        anyTime: q.anyTime === "true" || !q.period.length,
        noSchedulePreference: false,
      };
      if (!scheduleMatch(event, p).matches) continue;
    }
    if (total >= offset && data.length < q.pageSize) data.push(event);
    total++;
  }
  return {
    data,
    meta: {
      page: q.page,
      pageSize: q.pageSize,
      total,
      totalPages: Math.ceil(total / q.pageSize),
    },
  };
}
export async function recommendations(
  env: Env,
  p: Preferences,
  now: number,
  base: Query,
): Promise<Recommendation[]> {
  const best: Recommendation[] = [];
  const weights = scoringWeights(env.INTEREST_WEIGHT, env.SCHEDULE_WEIGHT);
  for await (const event of candidates(
    env,
    { ...base, category: p.interests },
    now,
  )) {
    const result = scoreEvent(event, p, now, weights);
    if (!result) continue;
    best.push(result);
    best.sort(compareRecommendations);
    if (best.length > 3) best.pop();
  }
  return best;
}
export async function saveEvent(
  env: Env,
  event: EventInput,
  id: string,
  now: number,
  create: boolean,
  actor = "local-system",
) {
  const categoryIds = [...new Set([event.categoryId, ...event.interestIds])];
  const { results } = await env.DB.prepare(
    "SELECT id FROM categories WHERE id IN (SELECT value FROM json_each(?))",
  )
    .bind(JSON.stringify(categoryIds))
    .all<{ id: string }>();
  if (
    results.length !== categoryIds.length ||
    !(await env.DB.prepare("SELECT id FROM organizers WHERE id=?")
      .bind(event.organizerId)
      .first())
  )
    throw new HttpError(
      422,
      "invalid_reference",
      "Choose existing categories and organizer.",
    );
  if (
    event.fictional &&
    event.status === "published" &&
    (env.ENVIRONMENT !== "development" || env.ALLOW_FICTIONAL_EVENTS !== "true")
  )
    throw new HttpError(
      422,
      "fictional_not_publishable",
      "Fictional events can only be published in explicitly enabled development mode.",
    );
  if (
    event.status === "published" &&
    !event.fictional &&
    isStale(
      event.verification.lastVerifiedAt,
      now,
      reviewDays(env.REVERIFY_AFTER_DAYS),
    )
  )
    throw new HttpError(
      422,
      "verification_stale",
      "Check the official source again before publishing this event.",
    );
  if (
    event.status === "published" &&
    event.registration &&
    isStale(
      event.registration.lastVerifiedAt,
      now,
      reviewDays(env.REVERIFY_AFTER_DAYS),
    )
  )
    throw new HttpError(
      422,
      "registration_stale",
      "Check registration details again before publishing.",
    );
  const keys = identityKeys({ ...event, organizerId: event.organizerId });
  if (event.status !== "archived") {
    const { results: others } = await env.DB.prepare(
      `${SELECT} WHERE e.starts_at=? AND e.id!=? AND e.status!='archived'`,
    )
      .bind(Date.parse(event.startsAt), id)
      .all<Row>();
    if (
      others.some((row) =>
        identityKeys(publicEvent(row, env, now)).some((key) =>
          keys.includes(key),
        ),
      )
    )
      throw new HttpError(
        409,
        "duplicate_event",
        "This occurrence already exists. Review and edit the existing event.",
      );
  }
  const columns = [
    "title",
    "description",
    "category_id",
    "organizer_id",
    "starts_at",
    "ends_at",
    "location",
    "source_name",
    "source_url",
    "fictional",
    "verification_status",
    "last_verified_at",
    "verification_evidence",
    "newcomer_status",
    "newcomer_details",
    "newcomer_evidence",
    "registration_url",
    "registration_details",
    "registration_verified_at",
    "what_to_expect",
    "status",
    "updated_at",
    "occurrence_status",
    "change_note",
    "pending_registration_url",
    "pending_registration_details",
    "source_key",
    "identity_key",
  ];
  const values = [
    event.title,
    event.description,
    event.categoryId,
    event.organizerId,
    Date.parse(event.startsAt),
    Date.parse(event.endsAt),
    event.location,
    event.source.name,
    event.source.url,
    Number(event.fictional),
    event.verification.status,
    event.verification.lastVerifiedAt
      ? Date.parse(event.verification.lastVerifiedAt)
      : null,
    event.verification.evidence,
    event.newcomer.status,
    event.newcomer.details,
    event.newcomer.evidence,
    event.registration?.url ?? null,
    event.registration?.details ?? null,
    event.registration ? Date.parse(event.registration.lastVerifiedAt) : null,
    event.whatToExpect,
    event.status,
    now,
    event.occurrenceStatus ?? "scheduled",
    event.changeNote ?? null,
    event.registrationCandidate?.url ?? null,
    event.registrationCandidate?.details ?? null,
    event.source.url
      ? `source:${canonicalSource(event.source.url)}|${Date.parse(event.startsAt)}`
      : null,
    keys.find((key) => key.startsWith("identity:"))!,
  ];
  const statements = [
    create
      ? env.DB.prepare(
          `INSERT INTO events(id,created_at,${columns.join(",")}) VALUES (${Array(
            columns.length + 2,
          )
            .fill("?")
            .join(",")})`,
        ).bind(id, now, ...values)
      : env.DB.prepare(
          `UPDATE events SET ${columns.map((c) => `${c}=?`).join(",")} WHERE id=?`,
        ).bind(...values, id),
    env.DB.prepare("DELETE FROM event_interests WHERE event_id=?").bind(id),
    env.DB.prepare(
      "INSERT INTO event_interests(event_id,category_id) SELECT ?,value FROM json_each(?) WHERE value!=?",
    ).bind(
      id,
      JSON.stringify([...new Set(event.interestIds)]),
      event.categoryId,
    ),
  ];
  statements.push(
    auditStatement(
      env,
      actor,
      create ? "event.created" : "event.updated",
      id,
      now,
    ),
  );
  await env.DB.batch(statements);
  return adminEvent((await getEvent(env, id, true))!);
}
export async function listAdminEvents(
  env: Env,
  page: number,
  pageSize: number,
  view = "all",
  query = "",
  now = Date.now(),
) {
  const { results } = await env.DB.prepare(
    `${SELECT} ORDER BY e.updated_at DESC,e.id`,
  ).all<Row>();
  const groups = new Map<string, string[]>();
  for (const row of results.filter((r) => r.status !== "archived"))
    for (const key of identityKeys(publicEvent(row, env, now)))
      groups.set(key, [...(groups.get(key) ?? []), row.id]);
  const duplicateIds = new Set(
    [...groups.values()].filter((ids) => ids.length > 1).flat(),
  );
  const all = results.map((row) => {
    const flags: string[] = [];
    if (row.status === "draft") flags.push("draft");
    if (
      !row.fictional &&
      (row.verification_status !== "verified" ||
        isStale(
          iso(row.last_verified_at),
          now,
          reviewDays(env.REVERIFY_AFTER_DAYS),
        ))
    )
      flags.push("needs-verification");
    if (row.ends_at <= now) flags.push("expired");
    if (row.occurrence_status === "canceled") flags.push("canceled");
    if (row.change_note && row.occurrence_status !== "canceled")
      flags.push("updated");
    if (
      row.registration_url &&
      isStale(
        iso(row.registration_verified_at),
        now,
        reviewDays(env.REVERIFY_AFTER_DAYS),
      )
    )
      flags.push("registration-recheck");
    if (duplicateIds.has(row.id)) flags.push("duplicate");
    return { ...adminEvent(row), qualityFlags: flags };
  });
  const summary = {
    total: all.length,
    review: all.filter(
      (e) =>
        e.status !== "archived" &&
        (e.qualityFlags.includes("needs-verification") ||
          e.qualityFlags.includes("registration-recheck") ||
          e.status === "draft"),
    ).length,
    duplicates: duplicateIds.size,
    expired: all.filter((e) => e.qualityFlags.includes("expired")).length,
    canceled: all.filter((e) => e.qualityFlags.includes("canceled")).length,
  };
  const filtered = all.filter(
    (e) =>
      (!query ||
        [e.title, e.location, e.source.name]
          .join(" ")
          .toLowerCase()
          .includes(query.toLowerCase())) &&
      (view === "all" ||
        (view === "review" &&
          e.status !== "archived" &&
          (e.qualityFlags.includes("needs-verification") ||
            e.qualityFlags.includes("registration-recheck") ||
            e.status === "draft")) ||
        (view === "duplicates" && e.qualityFlags.includes("duplicate")) ||
        (view === "expired" && e.qualityFlags.includes("expired")) ||
        (view === "canceled" && e.occurrenceStatus === "canceled") ||
        e.status === view),
  );
  return {
    data: filtered.slice((page - 1) * pageSize, page * pageSize),
    meta: {
      page,
      pageSize,
      total: filtered.length,
      totalPages: Math.ceil(filtered.length / pageSize),
    },
    summary,
  };
}

export async function findDuplicate(
  env: Env,
  event: EventInput,
  ignoreId = "",
) {
  const keys = identityKeys(event);
  const { results } = await env.DB.prepare(
    `${SELECT} WHERE e.starts_at=? AND e.id!=? AND e.status!='archived'`,
  )
    .bind(Date.parse(event.startsAt), ignoreId)
    .all<Row>();
  const row = results.find((row) =>
    identityKeys(publicEvent(row, env)).some((key) => keys.includes(key)),
  );
  return row ? { id: row.id, title: row.title, status: row.status } : null;
}

export async function importExistingEvents(env: Env, starts: number[]) {
  const { results } = await env.DB.prepare(
    `${SELECT} WHERE e.starts_at IN (SELECT value FROM json_each(?)) AND e.status!='archived'`,
  )
    .bind(JSON.stringify(starts))
    .all<Row>();
  return results.map((row) => publicEvent(row, env));
}
