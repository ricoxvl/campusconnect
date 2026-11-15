import { readFileSync, readdirSync } from "node:fs";
import assert from "node:assert/strict";
// Run while npm run dev is active. Read-only; does not change event data.
for (const port of [5173, 8787]) {
  for (const path of [
    "/",
    "/onboarding/interests",
    "/onboarding/availability",
    "/recommendations",
    "/explore",
    "/events/coding-circle",
    "/plan",
    "/admin",
  ]) {
    const res = await fetch(`http://127.0.0.1:${port}${path}`);
    assert.equal(res.status, 200);
    assert.match(await res.text(), /id="root"/);
  }
  const list = await fetch(`http://127.0.0.1:${port}/api/v1/events`);
  assert.equal(list.status, 200);
  const body = await list.json();
  assert(body.meta.total >= 18);
  assert(body.data.every((e) => e.status === "published"));
  console.log(
    `Port ${port}: all 8 screen routes serve the SPA; API retrieves D1 records.`,
  );
}
const base = "http://127.0.0.1:8787/api/v1";
const filtered = await (
  await fetch(
    `${base}/events?q=coding&category=technology&day=Thu&period=Afternoon`,
  )
).json();
assert(filtered.data.some((e) => e.id === "coding-circle"));
const recs = await (
  await fetch(`${base}/recommendations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      interests: ["Technology"],
      days: ["Thu"],
      periods: ["Afternoon"],
      anyTime: false,
      noSchedulePreference: false,
    }),
  })
).json();
assert.equal(recs.data.length, 3);
assert(recs.data.every((r) => r.reason.includes("Thu afternoon")));
assert.equal((await fetch(`${base}/admin/session`)).status, 401);
const token = readFileSync(".dev.vars", "utf8").match(
  /ADMIN_DEV_TOKEN="([^"]+)"/,
)[1];
assert.equal(
  (
    await fetch(`${base}/admin/session`, {
      headers: { Authorization: `Bearer ${token}` },
    })
  ).status,
  200,
);
assert.equal(
  (
    await fetch(`${base}/events`, {
      headers: { Origin: "https://untrusted.example" },
    })
  ).status,
  403,
);
assert.equal((await fetch("http://127.0.0.1:5173/.dev.vars")).status, 403);
const files = readdirSync("dist/assets").filter((name) => name.endsWith(".js"));
for (const name of files) {
  const text = readFileSync(`dist/assets/${name}`, "utf8");
  assert(!text.includes(token));
  assert(!text.includes("Sample coding circle"));
  assert(!text.includes("local-test-secret-"));
}
console.log(
  "Wrangler filtering, Top 3, administrator authorization, CORS, private-file blocking and frontend bundle checks passed.",
);
