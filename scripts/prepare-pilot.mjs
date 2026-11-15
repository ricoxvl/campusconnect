import { readFileSync } from "node:fs";
// Explicitly local-only. This workflow never publishes or accesses a remote DB.
if (process.argv.length > 2)
  throw new Error(
    "This command only prepares local drafts and takes no arguments.",
  );
const token = readFileSync(".dev.vars", "utf8").match(
  /ADMIN_DEV_TOKEN="([^"]+)"/,
)?.[1];
if (!token) throw new Error("Run setup:local and start npm run dev first.");
const base = "http://127.0.0.1:8787/api/v1/admin";
async function request(path, method = "GET", body) {
  const response = await fetch(base + path, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(data.error?.message ?? "Local preparation failed.");
  return data;
}
const review = JSON.parse(
  readFileSync("docs/data/pilot-source-review-2026-11-15.json", "utf8"),
);
const existing = (await request("/organizers")).data;
for (const organizer of review.organizers)
  if (!existing.some((item) => item.id === organizer.id))
    await request("/organizers", "POST", organizer);
const csv = readFileSync("docs/data/pilot-candidates-2026-11-15.csv", "utf8");
const preview = (await request("/import/preview", "POST", { csv })).data;
const rows = preview.filter((row) => !row.errors.length).map((row) => row.row);
if (!rows.length) {
  console.log(
    "No new valid candidates. Existing records were preserved; check preview errors or source dates.",
  );
  process.exit(0);
}
const result = await request("/import", "POST", { csv, rows });
console.log(
  `${result.data.filter((row) => row.status === "created").length} source-backed local drafts prepared. Nothing was verified or published. Recheck the official sources in /admin.`,
);
