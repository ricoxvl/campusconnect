import { URL as NodeURL } from "node:url";
import { readdir, readFile } from "node:fs/promises";
import { Miniflare } from "miniflare";
import type { Env } from "../env";
import type { EventInput } from "../validation";
import { addDays, campusDate, campusInstant } from "../../shared/schedule";
export const TOKEN = "local-test-secret-00000000000000000000000000000000";
export async function testDatabase() {
  const mf = new Miniflare({
    modules: true,
    script: 'export default {fetch(){return new Response("test");}}',
    compatibilityDate: "2026-08-01",
    d1Databases: ["DB"],
  });
  const DB = await mf.getD1Database("DB");
  const directory = new NodeURL("../migrations/", import.meta.url);
  for (const file of (await readdir(directory))
    .filter((name) => name.endsWith(".sql"))
    .sort()) {
    const sql = await readFile(new NodeURL(file, directory), "utf8");
    for (const statement of sql
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean))
      await DB.prepare(statement).run();
  }
  const env: Env = {
    DB: DB as unknown as Env["DB"],
    ENVIRONMENT: "development",
    ALLOW_FICTIONAL_EVENTS: "true",
    ADMIN_DEV_TOKEN: TOKEN,
    ALLOWED_ORIGINS: "http://localhost:5173",
  };
  return { mf, env };
}
export async function clearEvents(env: Env) {
  await env.DB.batch([
    env.DB.prepare("DELETE FROM admin_audit"),
    env.DB.prepare("DELETE FROM event_interests"),
    env.DB.prepare("DELETE FROM events"),
    env.DB.prepare("DELETE FROM organizers"),
    env.DB.prepare(
      "INSERT INTO organizers(id,name,url) VALUES ('test-organizer','Fictional test organizer',NULL)",
    ),
  ]);
}
export function futureDate(day = 3, hour = 14, minute = 0) {
  const today = campusDate();
  const weekday = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7;
  return new Date(
    campusInstant(addDays(today, 7 - weekday + day), hour * 60 + minute),
  ).toISOString();
}
export function fixture(overrides: Partial<EventInput> = {}): EventInput {
  return {
    id: crypto.randomUUID(),
    title: "Sample coding circle",
    description: "Fictional coding exercises for testing.",
    categoryId: "technology",
    interestIds: ["academics"],
    organizerId: "test-organizer",
    startsAt: futureDate(3, 14, 30),
    endsAt: futureDate(3, 15, 30),
    location: "Fictional campus room",
    source: { name: "Fictional test dataset", url: null },
    fictional: true,
    verification: {
      status: "unverified",
      lastVerifiedAt: null,
      evidence: null,
    },
    newcomer: { status: "unknown", details: null, evidence: null },
    registration: null,
    whatToExpect: "Fictional test scenario.",
    status: "published",
    occurrenceStatus: "scheduled",
    changeNote: null,
    registrationCandidate: null,
    ...overrides,
  };
}
