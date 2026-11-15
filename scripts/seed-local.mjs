import { writeFileSync, mkdirSync, unlinkSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { mockEvents } from "../src/data/events.ts";
// Intentionally only --local. This script cannot seed a remote or production DB.
if (process.argv.length > 2)
  throw new Error(
    "This script takes no arguments and only seeds the local database.",
  );
const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Chicago",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
const anchor = new Date(`${today}T12:00:00Z`);
const weekday = (anchor.getUTCDay() + 6) % 7;
anchor.setUTCDate(anchor.getUTCDate() + 7 - weekday);
const escaped = (value) =>
  value === null
    ? "NULL"
    : typeof value === "number"
      ? String(value)
      : `'${String(value).replaceAll("'", "''")}'`;
const shifted = (original) => {
  const dayOffset = Math.round(
    (Date.parse(original.slice(0, 10) + "T12:00:00Z") -
      Date.parse("2026-11-09T12:00:00Z")) /
      86400000,
  );
  const d = new Date(anchor);
  d.setUTCDate(d.getUTCDate() + dayOffset);
  const zone = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    timeZoneName: "shortOffset",
  })
    .formatToParts(d)
    .find((p) => p.type === "timeZoneName").value;
  const hours = Number(zone.replace("GMT", ""));
  const offset = `${hours < 0 ? "-" : "+"}${String(Math.abs(hours)).padStart(2, "0")}:00`;
  return Date.parse(
    `${d.toISOString().slice(0, 10)}T${original.slice(11, 19)}${offset}`,
  );
};
const mapping = {
  Technology: "technology",
  "Career & networking": "career",
  "Social events": "social",
  "Fitness & sports": "sports",
  Entrepreneurship: "entrepreneurship",
  "Arts & culture": "arts",
  Gaming: "gaming",
  Volunteering: "volunteering",
  Academics: "academics",
  Wellness: "wellness",
};
const now = Date.now();
const statements = [
  "INSERT OR IGNORE INTO organizers(id,name,url) VALUES ('test-organizer','Fictional student group (test organizer)',NULL)",
];
for (const event of mockEvents) {
  // Never overwrite an administrator's existing event, even with a matching ID.
  const values = [
    event.id,
    event.title,
    event.description,
    mapping[event.categories[0]],
    "test-organizer",
    shifted(event.startsAt),
    shifted(event.endsAt),
    event.location,
    event.source.name,
    1,
    "unverified",
    event.newcomer ? "confirmed" : "unknown",
    event.newcomer?.details ?? null,
    event.newcomer?.evidence ?? null,
    event.whatToExpect ?? null,
    "published",
    now,
    now,
  ];
  statements.push(
    `INSERT OR IGNORE INTO events(id,title,description,category_id,organizer_id,starts_at,ends_at,location,source_name,fictional,verification_status,newcomer_status,newcomer_details,newcomer_evidence,what_to_expect,status,created_at,updated_at) VALUES (${values.map(escaped).join(",")})`,
  );
  for (const category of event.categories.slice(1))
    statements.push(
      `INSERT OR IGNORE INTO event_interests(event_id,category_id) SELECT ${escaped(event.id)},${escaped(mapping[category])} WHERE EXISTS (SELECT 1 FROM events WHERE id=${escaped(event.id)} AND fictional=1 AND organizer_id='test-organizer')`,
    );
}
mkdirSync("work", { recursive: true });
const file = "work/seed-local.sql";
writeFileSync(file, statements.join(";\n") + ";\n");
try {
  execFileSync(
    process.execPath,
    [
      "node_modules/wrangler/bin/wrangler.js",
      "d1",
      "execute",
      "campusconnect-local",
      "--local",
      "--file",
      file,
    ],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        WRANGLER_SEND_METRICS: "false",
        XDG_CONFIG_HOME:
          process.env.XDG_CONFIG_HOME ?? `${process.cwd()}/work/config`,
      },
    },
  );
} finally {
  unlinkSync(file);
}
