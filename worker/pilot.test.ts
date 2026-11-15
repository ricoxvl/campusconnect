import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import worker from "./index";
import { parseCsv } from "./csv";
import { canonicalSource } from "../shared/quality";
import { saveEvent } from "./database";
import {
  clearEvents,
  fixture,
  futureDate,
  testDatabase,
  TOKEN,
} from "./test/database";
let harness: Awaited<ReturnType<typeof testDatabase>>;
const header =
  "title,description,category_id,interest_ids,organizer_id,starts_at,ends_at,location,source_name,source_url,registration_url,registration_details,fictional";
function csvRow(
  title = "Sample CSV event",
  source = "",
  fictional = true,
  start = futureDate(3, 14),
  end = futureDate(3, 15),
  registration = "",
) {
  return [
    title,
    "Test description",
    "technology",
    "academics",
    "test-organizer",
    start,
    end,
    "Test room",
    "Test source",
    source,
    registration,
    registration ? "Confirm official registration instructions" : "",
    String(fictional),
  ]
    .map((s) => `"${s.replaceAll('"', '""')}"`)
    .join(",");
}
function csv(...rows: string[]) {
  return header + "\r\n" + rows.join("\r\n");
}
function call(path: string, method = "GET", body?: unknown, auth = true) {
  return worker.fetch(
    new Request(`http://localhost/api/v1${path}`, {
      method,
      headers: {
        ...(auth ? { Authorization: `Bearer ${TOKEN}` } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }),
    harness.env,
  );
}
async function add(extra: Parameters<typeof fixture>[0] = {}) {
  const event = fixture(extra);
  return saveEvent(harness.env, event, event.id!, Date.now(), true);
}
beforeAll(async () => {
  harness = await testDatabase();
});
afterAll(async () => {
  await harness?.mf.dispose();
});
beforeEach(async () => {
  await clearEvents(harness.env);
});
describe("CSV parsing and protected draft import", () => {
  it("parses BOM, CRLF, quoted commas, escaped quotes and multiline fields", () => {
    const input =
      "\uFEFF" +
      csv(
        csvRow('Sample "quoted", title').replace(
          "Test description",
          "Line one\nLine two",
        ),
      );
    const rows = parseCsv(input);
    expect(rows[0].title).toBe('Sample "quoted", title');
    expect(rows[0].description).toBe("Line one\nLine two");
  });
  it("rejects malformed fields, duplicate/unknown headers, verification claims, controls and oversized batches", () => {
    for (const text of [
      header + '\n"unfinished',
      header + "\nwrong,columns",
      header + ",verified\n" + csvRow() + ",true",
      header + ",title\n" + csvRow() + ",Other",
      csv(csvRow()).replace("Test description", "bad\u0000"),
      csv(...Array.from({ length: 51 }, (_, i) => csvRow(`Sample ${i}`))),
    ])
      expect(() => parseCsv(text)).toThrow();
  });
  it("requires authorization for preview, commit, quality queues and audit", async () => {
    for (const [path, method, body] of [
      ["/admin/import/preview", "POST", { csv: csv(csvRow()) }],
      ["/admin/import", "POST", { csv: csv(csvRow()), rows: [2] }],
      ["/admin/audit", "GET", undefined],
      ["/admin/events?view=review", "GET", undefined],
    ] as const)
      expect((await call(path, method, body, false)).status).toBe(401);
  });
  it("previews first and commits selected valid rows only as unverified drafts", async () => {
    const text = csv(csvRow("Sample good"), csvRow("Unlabeled workshop"));
    const preview = (await (
      await call("/admin/import/preview", "POST", { csv: text })
    ).json()) as any;
    expect(preview.data[0].errors).toEqual([]);
    expect(preview.data[1].errors.length).toBeGreaterThan(0);
    expect(
      (await call("/admin/import", "POST", { csv: text, rows: [3] })).status,
    ).toBe(422);
    const response = await call("/admin/import", "POST", {
      csv: text,
      rows: [2],
    });
    expect(response.status).toBe(200);
    const rows = (
      (await (await call("/admin/events?view=draft")).json()) as any
    ).data;
    expect(rows).toHaveLength(1);
    expect(rows[0].verification.status).toBe("unverified");
    expect(((await (await call("/events")).json()) as any).data).toEqual([]);
    expect(
      ((await (await call("/admin/audit")).json()) as any).data[0].actor,
    ).toBe("local-development-admin");
  });
  it("retains unverified registration privately and never promotes it from CSV", async () => {
    const text = csv(
      csvRow(
        "Source-backed test draft",
        "https://calendar.utdallas.edu/event/test-csv",
        false,
        futureDate(3, 14),
        futureDate(3, 15),
        "https://example.com/registration",
      ),
    );
    const preview = (await (
      await call("/admin/import/preview", "POST", { csv: text })
    ).json()) as any;
    expect(preview.data[0].errors).toEqual([]);
    await call("/admin/import", "POST", { csv: text, rows: [2] });
    const rows = ((await (await call("/admin/events")).json()) as any).data;
    expect(rows[0].registration).toBeNull();
    expect(rows[0].registrationCandidate.url).toBe(
      "https://example.com/registration",
    );
    expect(rows[0].status).toBe("draft");
  });
  it("blocks missing references, real records without sources, expired rows and unsafe URLs", async () => {
    const text = csv(
      csvRow("Test real", "", false),
      csvRow().replace("test-organizer", "missing-organizer"),
      csvRow(
        "Sample expired",
        "",
        true,
        "2020-01-01T12:00:00Z",
        "2020-01-01T13:00:00Z",
      ),
      csvRow("Test unsafe", "javascript:alert(1)", false),
    );
    const result = (await (
      await call("/admin/import/preview", "POST", { csv: text })
    ).json()) as any;
    expect(result.data.every((row: any) => row.errors.length > 0)).toBe(true);
  });
  it("detects duplicates within a file, repeat imports, and equivalent tracking URLs while preserving recurrences", async () => {
    const source = "https://calendar.utdallas.edu/event/test-csv";
    const text = csv(
      csvRow("Test occurrence", source, false),
      csvRow("Test occurrence", source + "?utm_source=mail#details", false),
      csvRow(
        "Test occurrence",
        source,
        false,
        futureDate(4, 14),
        futureDate(4, 15),
      ),
    );
    const preview = (
      (await (
        await call("/admin/import/preview", "POST", { csv: text })
      ).json()) as any
    ).data;
    expect(preview[0].errors).toEqual([]);
    expect(preview[1].errors).toContain(
      "Duplicate occurrence within this file.",
    );
    expect(preview[2].errors).toEqual([]);
    await call("/admin/import", "POST", { csv: text, rows: [2, 4] });
    const again = (
      (await (
        await call("/admin/import/preview", "POST", { csv: text })
      ).json()) as any
    ).data;
    expect(again[0].duplicateOf).toBeDefined();
    expect(
      (await call("/admin/import", "POST", { csv: text, rows: [2] })).status,
    ).toBe(422);
  });
  it("normalizes tracking parameters without losing event identifiers", () => {
    expect(
      canonicalSource(
        "https://calendar.utdallas.edu/event/test/?id=2&utm_campaign=x#details",
      ),
    ).toBe("https://calendar.utdallas.edu/event/test?id=2");
  });
});
describe("event quality and lifecycle", () => {
  it("hides independently stale registration and requires its own renewed check", async () => {
    const event = await add({
      fictional: false,
      title: "Test registration freshness",
      source: {
        name: "Test source",
        url: "https://calendar.utdallas.edu/event/test-registration",
      },
      verification: {
        status: "verified",
        lastVerifiedAt: new Date(Date.now() - 1000).toISOString(),
        evidence: "Isolated source fixture.",
      },
      registration: {
        url: "https://example.com/register",
        details: "Isolated registration fixture.",
        lastVerifiedAt: new Date(Date.now() - 1000).toISOString(),
      },
    });
    await harness.env.DB.prepare(
      "UPDATE events SET registration_verified_at=? WHERE id=?",
    )
      .bind(Date.now() - 8 * 86400000, event.id)
      .run();
    const detail = ((await (await call(`/events/${event.id}`)).json()) as any)
      .data;
    expect(detail.source.verified).toBe(true);
    expect(detail.registration).toBeUndefined();
    expect(
      (
        await call(`/admin/events/${event.id}`, "PATCH", {
          status: "published",
        })
      ).status,
    ).toBe(422);
    const queue = (
      (await (await call("/admin/events?view=review")).json()) as any
    ).data;
    expect(queue[0].qualityFlags).toContain("registration-recheck");
  });
  it("preserves verification for an unchanged organizer but invalidates actual changes atomically", async () => {
    const event = await add({
      fictional: false,
      title: "Test organizer review",
      source: {
        name: "Test source",
        url: "https://calendar.utdallas.edu/event/test-organizer",
      },
      verification: {
        status: "verified",
        lastVerifiedAt: new Date(Date.now() - 1000).toISOString(),
        evidence: "Isolated source fixture.",
      },
    });
    expect(
      (
        await call("/admin/organizers/test-organizer", "PATCH", {
          name: "Fictional test organizer",
        })
      ).status,
    ).toBe(200);
    expect((await call(`/events/${event.id}`)).status).toBe(200);
    expect(
      (
        await call("/admin/organizers/test-organizer", "PATCH", {
          name: "Updated test organizer",
        })
      ).status,
    ).toBe(200);
    expect((await call(`/events/${event.id}`)).status).toBe(404);
    const record = (
      (await (await call(`/admin/events/${event.id}`)).json()) as any
    ).data;
    expect(record.status).toBe("draft");
    expect(record.verification.status).toBe("unverified");
    const audit = ((await (await call("/admin/audit")).json()) as any).data;
    expect(
      audit.filter((entry: any) => entry.action === "organizers.updated"),
    ).toHaveLength(2);
  });
  it("hides canceled and expired events from discovery/recommendations while preserving canceled details", async () => {
    const canceled = await add({
      occurrenceStatus: "canceled",
      changeNote: "Cancellation recorded in a test source.",
    });
    const event = fixture({
      id: "expired-test",
      title: "Sample expired record",
    });
    await saveEvent(harness.env, event, event.id!, Date.now(), true);
    await harness.env.DB.prepare(
      "UPDATE events SET starts_at=?,ends_at=? WHERE id=?",
    )
      .bind(Date.now() - 7200000, Date.now() - 3600000, event.id!)
      .run();
    expect(((await (await call("/events")).json()) as any).data).toEqual([]);
    const p = {
      interests: ["Technology"],
      days: [],
      periods: [],
      noSchedulePreference: true,
    };
    expect(
      ((await (await call("/recommendations", "POST", p)).json()) as any).data,
    ).toEqual([]);
    const detail = (await (await call(`/events/${canceled.id}`)).json()) as any;
    expect(detail.data.occurrenceStatus).toBe("canceled");
    expect(
      ((await (await call("/admin/events?view=expired")).json()) as any).data,
    ).toHaveLength(1);
    expect(
      ((await (await call("/admin/events?view=canceled")).json()) as any).data,
    ).toHaveLength(1);
  });
  it("labels stale verification honestly, hides it from discovery and requires a new source check to publish", async () => {
    const event = await add({
      fictional: false,
      title: "Test source-verified record",
      source: {
        name: "Test official source",
        url: "https://calendar.utdallas.edu/event/test-review",
      },
      verification: {
        status: "verified",
        lastVerifiedAt: new Date(Date.now() - 1000).toISOString(),
        evidence: "Isolated test fixture.",
      },
    });
    await harness.env.DB.prepare(
      "UPDATE events SET last_verified_at=? WHERE id=?",
    )
      .bind(Date.now() - 8 * 86400000, event.id)
      .run();
    const detail = ((await (await call(`/events/${event.id}`)).json()) as any)
      .data;
    expect(detail.source.verified).toBe(false);
    expect(detail.reviewRequired).toBe(true);
    expect(detail.verificationStatus).toBe("unverified");
    expect(((await (await call("/events")).json()) as any).data).toEqual([]);
    expect(
      (
        await call(`/admin/events/${event.id}`, "PATCH", {
          status: "published",
        })
      ).status,
    ).toBe(422);
    expect(
      ((await (await call("/admin/events?view=review")).json()) as any).data[0]
        .qualityFlags,
    ).toContain("needs-verification");
  });
  it("enforces duplicate identities under concurrent requests and retains one atomic event/audit", async () => {
    const a = fixture({ id: "concurrent-a" }),
      b = { ...a, id: "concurrent-b" };
    const responses = await Promise.all([
      call("/admin/events", "POST", a),
      call("/admin/events", "POST", b),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(
      (await harness.env.DB.prepare("SELECT count(*) AS n FROM events").first<{
        n: number;
      }>())!.n,
    ).toBe(1);
    expect(
      (await harness.env.DB.prepare(
        "SELECT count(*) AS n FROM admin_audit",
      ).first<{ n: number }>())!.n,
    ).toBe(1);
  });
  it("suppresses legacy duplicate rows and exposes both to the administrator review queue", async () => {
    const original = await add();
    await harness.env.DB.prepare(
      `INSERT INTO events(id,title,description,category_id,organizer_id,starts_at,ends_at,location,source_name,source_url,fictional,verification_status,last_verified_at,verification_evidence,status,created_at,updated_at) SELECT 'legacy-duplicate',title,description,category_id,organizer_id,starts_at,ends_at,location,source_name,source_url,fictional,verification_status,last_verified_at,verification_evidence,status,created_at,updated_at FROM events WHERE id=?`,
    )
      .bind(original.id)
      .run();
    const list = (await (await call("/events")).json()) as any;
    expect(list.data).toHaveLength(1);
    expect(list.meta.total).toBe(1);
    const duplicates = (await (
      await call("/admin/events?view=duplicates")
    ).json()) as any;
    expect(duplicates.data).toHaveLength(2);
  });
  it("publishes, unpublishes and archives with source checks and protected audit records", async () => {
    const event = await add({ status: "draft" });
    expect(
      (
        await call(`/admin/events/${event.id}`, "PATCH", {
          status: "published",
        })
      ).status,
    ).toBe(200);
    await call(`/admin/events/${event.id}`, "PATCH", { status: "draft" });
    expect((await call(`/events/${event.id}`)).status).toBe(404);
    await call(`/admin/events/${event.id}`, "DELETE");
    const audit = ((await (await call("/admin/audit")).json()) as any).data;
    expect(audit.map((entry: any) => entry.action)).toContain("event.archived");
  });
  it("provides safe health/request correlation and denies unsupported admin methods", async () => {
    const health = await call("/health");
    expect(health.status).toBe(200);
    expect(health.headers.get("X-Request-Id")).toMatch(/^[0-9a-f-]{36}$/);
    expect(health.headers.get("X-Frame-Options")).toBe("DENY");
    expect((await call("/admin/import", "GET")).status).toBe(405);
    const failed = await worker.fetch(
      new Request("http://localhost/api/v1/health"),
      {
        ...harness.env,
        DB: {
          prepare() {
            throw new Error("sensitive connection text");
          },
        } as any,
      },
    );
    expect(failed.status).toBe(503);
    expect(await failed.text()).not.toContain("sensitive");
  });
});
