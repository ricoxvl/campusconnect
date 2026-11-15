import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import worker from "./index";
import {
  clearEvents,
  fixture,
  futureDate,
  testDatabase,
  TOKEN,
} from "./test/database";
import { saveEvent } from "./database";
import type { Env } from "./env";
import type { EventInput } from "./validation";
let harness: Awaited<ReturnType<typeof testDatabase>>, env: Env;
function call(
  path: string,
  method = "GET",
  body?: unknown,
  admin = false,
  extra: Record<string, string> = {},
) {
  return worker.fetch(
    new Request(`http://localhost${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...(admin ? { Authorization: `Bearer ${TOKEN}` } : {}),
        ...extra,
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    }),
    env,
  );
}
async function add(overrides: Partial<EventInput> = {}) {
  const e = fixture(overrides);
  if (overrides.title === undefined) e.title += ` ${e.id}`;
  await saveEvent(env, e, e.id!, Date.now(), true);
  return e;
}
beforeAll(async () => {
  harness = await testDatabase();
  env = harness.env;
});
afterAll(async () => {
  await harness?.mf.dispose();
});
beforeEach(async () => {
  await clearEvents(env);
});
describe("D1 migrations and constraints", () => {
  it("creates the relational schema and required indexes", async () => {
    const tables = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='table'",
    ).all<{ name: string }>();
    expect(tables.results.map((r) => r.name)).toEqual(
      expect.arrayContaining([
        "events",
        "categories",
        "organizers",
        "event_interests",
      ]),
    );
    const indexes = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type='index'",
    ).all<{ name: string }>();
    expect(indexes.results.map((r) => r.name)).toContain("events_status_start");
    expect(
      (await env.DB.prepare("SELECT count(*) AS n FROM categories").first<{
        n: number;
      }>())!.n,
    ).toBeGreaterThanOrEqual(10);
  });
  it("enforces end times, foreign keys, unique IDs and verification rules in SQL", async () => {
    const e = await add();
    await expect(
      env.DB.prepare("UPDATE events SET ends_at=starts_at WHERE id=?")
        .bind(e.id!)
        .run(),
    ).rejects.toThrow();
    await expect(
      env.DB.prepare("UPDATE events SET organizer_id='missing' WHERE id=?")
        .bind(e.id!)
        .run(),
    ).rejects.toThrow();
    await expect(
      env.DB.prepare("UPDATE events SET fictional=0 WHERE id=?")
        .bind(e.id!)
        .run(),
    ).rejects.toThrow();
    await expect(add({ id: e.id })).rejects.toThrow();
    expect((await call(`/api/v1/events/${e.id}`)).status).toBe(200);
  });
});
describe("public event API", () => {
  it("returns published records, hides draft/archived/unverified records and preserves source truth", async () => {
    const published = await add();
    await add({ status: "draft" });
    await add({ status: "archived" });
    const response = await call("/api/v1/events");
    const body = (await response.json()) as any;
    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe(published.id);
    expect(body.data[0].source).toEqual({
      name: "Fictional test dataset",
      url: null,
      verified: false,
    });
    expect(body.data[0].startsAt).toMatch(/Z$/);
    expect(body.data[0].categories).toEqual(["Technology", "Academics"]);
    expect(body.data[0]).not.toHaveProperty("verification_evidence");
    const production = await worker.fetch(
      new Request("https://example.com/api/v1/events"),
      { ...env, ENVIRONMENT: "production" },
    );
    expect(((await production.json()) as any).data).toEqual([]);
  });
  it("combines literal keyword, category, UTC date range, weekday and full availability filters", async () => {
    const e = await add();
    await add({
      title: "Sample social",
      categoryId: "social",
      interestIds: [],
      startsAt: futureDate(5, 14),
      endsAt: futureDate(5, 15),
    });
    const query = new URLSearchParams({
      q: "CODING",
      category: "academics",
      from: futureDate(3, 0),
      to: futureDate(4, 0),
      day: "Thu",
      period: "Afternoon",
    });
    expect(
      ((await (await call(`/api/v1/events?${query}`)).json()) as any).data.map(
        (x: any) => x.id,
      ),
    ).toEqual([e.id]);
    expect(
      ((await (await call("/api/v1/events?q=%25")).json()) as any).data,
    ).toEqual([]);
    expect(
      (
        (await (
          await call("/api/v1/events?category=social&day=Thu")
        ).json()) as any
      ).data,
    ).toEqual([]);
    expect(
      (
        (await (
          await call("/api/v1/events?q=%27%20OR%201%3D1--")
        ).json()) as any
      ).data,
    ).toEqual([]);
  });
  it("paginates after filtering, counts correctly and sorts deterministically", async () => {
    for (let i = 0; i < 23; i++)
      await add({ id: `test-${String(i).padStart(2, "0")}` });
    const first = (await (
      await call("/api/v1/events?page=1&pageSize=20")
    ).json()) as any;
    const second = (await (
      await call("/api/v1/events?page=2&pageSize=20")
    ).json()) as any;
    expect(first.data).toHaveLength(20);
    expect(second.data).toHaveLength(3);
    expect(first.meta).toEqual({
      page: 1,
      pageSize: 20,
      total: 23,
      totalPages: 2,
    });
    expect(
      new Set([...first.data, ...second.data].map((x: any) => x.id)).size,
    ).toBe(23);
    await add({
      id: "later",
      startsAt: futureDate(4, 14),
      endsAt: futureDate(4, 15),
    });
    expect(
      ((await (await call("/api/v1/events?sort=latest")).json()) as any).data[0]
        .id,
    ).toBe("later");
  });
  it("resolves event IDs independently of catalog pagination, and hides archived details", async () => {
    const e = await add();
    expect((await call(`/api/v1/events/${e.id}`)).status).toBe(200);
    expect((await call("/api/v1/events/missing")).status).toBe(404);
    await call(`/api/v1/admin/events/${e.id}`, "DELETE", undefined, true);
    expect((await call(`/api/v1/events/${e.id}`)).status).toBe(404);
  });
  it("validates queries, JSON, media type and request size without leaking SQL", async () => {
    for (const query of [
      "page=0",
      "pageSize=100",
      "sort=bad",
      "day=Funday",
      "from=bad",
      "unexpected=true",
    ])
      expect((await call(`/api/v1/events?${query}`)).status).toBe(422);
    const invalid = await worker.fetch(
      new Request("http://localhost/api/v1/recommendations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      }),
      env,
    );
    expect(invalid.status).toBe(400);
    expect((await call("/api/v1/recommendations", "POST")).status).toBe(415);
    const large = await call("/api/v1/recommendations", "POST", {
      interests: ["x".repeat(70000)],
    });
    expect(large.status).toBe(413);
    const recommendations = await call("/api/v1/recommendations", "POST", {
      interests: ["Technology"],
      days: [],
      periods: [],
      noSchedulePreference: false,
    });
    expect(recommendations.status).toBe(422);
  });
  it("returns all configured categories and restricts CORS to explicit trusted origins", async () => {
    const categories = await call("/api/v1/categories");
    expect(
      ((await categories.json()) as any).data.length,
    ).toBeGreaterThanOrEqual(10);
    const denied = await call("/api/v1/events", "GET", undefined, false, {
      Origin: "https://evil.example",
    });
    expect(denied.status).toBe(403);
    expect(denied.headers.has("Access-Control-Allow-Origin")).toBe(false);
    const allowed = await call("/api/v1/events", "GET", undefined, false, {
      Origin: "http://localhost:5173",
    });
    expect(allowed.headers.get("Access-Control-Allow-Origin")).toBe(
      "http://localhost:5173",
    );
    const preflight = await call(
      "/api/v1/admin/events",
      "OPTIONS",
      undefined,
      false,
      {
        Origin: "http://localhost:5173",
        "Access-Control-Request-Method": "POST",
      },
    );
    expect(preflight.status).toBe(204);
  });
});
describe("recommendations through D1", () => {
  it("ranks multi-interest matches, returns up to three, and explains actual schedule fits", async () => {
    const best = await add();
    await add({ interestIds: [] });
    await add({ interestIds: [], categoryId: "social" });
    const p = {
      interests: ["Technology", "Academics"],
      days: ["Thu"],
      periods: ["Afternoon"],
      anyTime: false,
      noSchedulePreference: false,
    };
    const result = (await (
      await call("/api/v1/recommendations", "POST", p)
    ).json()) as any;
    expect(result.data).toHaveLength(2);
    expect(result.data[0].event.id).toBe(best.id);
    expect(result.data[0].score).toBe(25);
    expect(result.data[0].reason).toContain(
      "Technology + Academics + Thu afternoon",
    );
    expect(
      (
        (await (
          await call("/api/v1/recommendations", "POST", { ...p, days: ["Sun"] })
        ).json()) as any
      ).data,
    ).toEqual([]);
    expect(
      (
        (await (
          await call("/api/v1/recommendations", "POST", {
            ...p,
            interests: [],
            days: [],
            periods: [],
            noSchedulePreference: true,
          })
        ).json()) as any
      ).data,
    ).toHaveLength(3);
  });
});
describe("administrator API", () => {
  it("rejects unauthenticated writes and never accepts a local token in production", async () => {
    expect((await call("/api/v1/admin/events", "POST", fixture())).status).toBe(
      401,
    );
    expect((await call("/api/v1/admin/events", "GET")).status).toBe(401);
    const production = await worker.fetch(
      new Request("http://localhost/api/v1/admin/session", {
        headers: { Authorization: `Bearer ${TOKEN}` },
      }),
      { ...env, ENVIRONMENT: "production" },
    );
    expect(production.status).toBe(401);
    const remote = await worker.fetch(
      new Request("https://example.com/api/v1/admin/session", {
        headers: { Authorization: `Bearer ${TOKEN}` },
      }),
      env,
    );
    expect(remote.status).toBe(401);
  });
  it("creates drafts, requires verified real publication and invalidates verification after edits", async () => {
    const draft = fixture({
      fictional: false,
      status: "draft",
      title: "Manually checked event",
    });
    expect(
      (await call("/api/v1/admin/events", "POST", draft, true)).status,
    ).toBe(201);
    expect(
      (
        await call(
          `/api/v1/admin/events/${draft.id}`,
          "PATCH",
          { status: "published" },
          true,
        )
      ).status,
    ).toBe(422);
    const checked = {
      status: "verified",
      lastVerifiedAt: new Date(Date.now() - 1000).toISOString(),
      evidence: "Manually checked the official source and organizer details.",
    };
    const published = await call(
      `/api/v1/admin/events/${draft.id}`,
      "PATCH",
      {
        status: "published",
        verification: checked,
        source: {
          name: "Official source",
          url: "https://calendar.utdallas.edu/",
        },
      },
      true,
    );
    expect(published.status).toBe(200);
    expect((await call(`/api/v1/events/${draft.id}`)).status).toBe(200);
    const edited = await call(
      `/api/v1/admin/events/${draft.id}`,
      "PATCH",
      { location: "Updated location" },
      true,
    );
    expect(edited.status).toBe(200);
    expect(((await edited.json()) as any).data.verification.status).toBe(
      "unverified",
    );
    expect((await call(`/api/v1/events/${draft.id}`)).status).toBe(404);
  });
  it("refuses invented verification, unsubstantiated newcomer claims, unverified registration and invalid references", async () => {
    const cases = [
      fixture({
        verification: {
          status: "verified",
          lastVerifiedAt: null,
          evidence: null,
        },
      }),
      fixture({
        newcomer: { status: "confirmed", details: "", evidence: null },
      }),
      fixture({ organizerId: "missing" }),
      fixture({ title: "Unlabeled event" }),
      fixture({
        registration: {
          url: "https://example.com/",
          details: "test",
          lastVerifiedAt: new Date().toISOString(),
        },
      }),
      fixture({ source: { name: "bad", url: "javascript:alert(1)" } }),
    ];
    for (const event of cases)
      expect(
        (await call("/api/v1/admin/events", "POST", event, true)).status,
      ).toBe(422);
    expect(
      (
        await call(
          "/api/v1/admin/events",
          "POST",
          { ...fixture(), isAdmin: true },
          true,
        )
      ).status,
    ).toBe(422);
  });
  it("preserves omitted fields in a partial update instead of applying create defaults", async () => {
    const original = await add({
      newcomer: {
        status: "confirmed",
        details: "Fictional introduction",
        evidence: "Fictional test note",
      },
    });
    const response = await call(
      `/api/v1/admin/events/${original.id}`,
      "PATCH",
      { title: "Sample updated title" },
      true,
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as any;
    expect(body.data.fictional).toBe(true);
    expect(body.data.status).toBe("published");
    expect(body.data.interestIds).toEqual(["academics"]);
    expect(body.data.newcomer.details).toBe("Fictional introduction");
  });
  it("archives instead of destroying records and returns conflicts for referenced metadata", async () => {
    const e = await add();
    expect(
      (await call(`/api/v1/admin/events/${e.id}`, "DELETE", undefined, true))
        .status,
    ).toBe(204);
    expect(
      (
        (await (
          await call(`/api/v1/admin/events/${e.id}`, "GET", undefined, true)
        ).json()) as any
      ).data.status,
    ).toBe("archived");
    expect(
      (
        await call(
          "/api/v1/admin/categories/technology",
          "DELETE",
          undefined,
          true,
        )
      ).status,
    ).toBe(409);
    expect(
      (
        await call(
          "/api/v1/admin/organizers/test-organizer",
          "DELETE",
          undefined,
          true,
        )
      ).status,
    ).toBe(409);
  });
  it("preserves omitted organizer fields and invalidates affected real-event verification", async () => {
    await env.DB.prepare(
      "UPDATE organizers SET url='https://utdallas.edu/' WHERE id='test-organizer'",
    ).run();
    const e = await add({
      fictional: false,
      title: "Test verified record",
      source: {
        name: "Official source test fixture",
        url: "https://calendar.utdallas.edu/",
      },
      verification: {
        status: "verified",
        lastVerifiedAt: new Date(Date.now() - 1000).toISOString(),
        evidence: "Isolated test fixture, not a live listing.",
      },
    });
    const response = await call(
      "/api/v1/admin/organizers/test-organizer",
      "PATCH",
      { name: "Updated test organizer" },
      true,
    );
    expect(response.status).toBe(200);
    expect(((await response.json()) as any).data.url).toBe(
      "https://utdallas.edu/",
    );
    const updated = (await (
      await call(`/api/v1/admin/events/${e.id}`, "GET", undefined, true)
    ).json()) as any;
    expect(updated.data.status).toBe("draft");
    expect(updated.data.verification.status).toBe("unverified");
  });
  it("creates, edits, and removes categories and organizers with validation", async () => {
    expect(
      (
        await call(
          "/api/v1/admin/categories",
          "POST",
          { id: "new-category", name: "New category" },
          true,
        )
      ).status,
    ).toBe(201);
    expect(
      (
        await call(
          "/api/v1/admin/categories/new-category",
          "PATCH",
          { name: "Renamed category" },
          true,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await call(
          "/api/v1/admin/organizers",
          "POST",
          { id: "new-organizer", name: "Test organizer", url: null },
          true,
        )
      ).status,
    ).toBe(201);
    expect(
      (
        await call(
          "/api/v1/admin/organizers/new-organizer",
          "PATCH",
          { name: "Updated organizer", url: "https://utdallas.edu/" },
          true,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await call(
          "/api/v1/admin/categories/new-category",
          "DELETE",
          undefined,
          true,
        )
      ).status,
    ).toBe(204);
    expect(
      (
        await call(
          "/api/v1/admin/organizers/new-organizer",
          "DELETE",
          undefined,
          true,
        )
      ).status,
    ).toBe(204);
  });
});
