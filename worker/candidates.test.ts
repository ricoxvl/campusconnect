import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CSV_HEADERS, parseCsv } from "./csv";

const csv = readFileSync(
  new URL("../docs/data/pilot-candidates-2026-11-15.csv", import.meta.url),
  "utf8",
);
const manifest = JSON.parse(
  readFileSync(
    new URL("../docs/data/pilot-source-review-2026-11-15.json", import.meta.url),
    "utf8",
  ),
) as {
  publicationStatus: string;
  verificationStatus: string;
  candidateCount: number;
  timezone: string;
  organizers: Array<{ id: string; name: string }>;
  sources: Array<{ url: string; occurrences: string[] }>;
};
const rows = parseCsv(csv);

describe("November 15 pilot candidate curation", () => {
  it("uses exactly the bounded CSV import schema", () => {
    expect(csv.trimStart().split("\n")[0].split(",")).toEqual(CSV_HEADERS);
    expect(rows).toHaveLength(manifest.candidateCount);
    expect(rows).toHaveLength(15);
    expect(new TextEncoder().encode(csv).byteLength).toBeLessThan(60_001);
  });

  it("contains only official-source draft candidates with known organizers and valid dated occurrences", () => {
    const organizers = new Set(manifest.organizers.map((o) => o.id));
    const sources = new Map(
      manifest.sources.map((s) => [s.url, new Set(s.occurrences)]),
    );
    const categories = new Set([
      "technology", "career", "social", "sports", "entrepreneurship",
      "arts", "gaming", "volunteering", "academics", "wellness",
    ]);
    expect(manifest.publicationStatus).toBe("NOT_PUBLISHED");
    expect(manifest.verificationStatus).toBe("HUMAN_REVIEW_REQUIRED");
    expect(manifest.timezone).toBe("America/Chicago");
    expect(organizers.size).toBe(manifest.organizers.length);
    expect(sources.size).toBe(manifest.sources.length);

    const identities = new Set<string>();
    for (const event of rows) {
      expect(event.fictional).toBe("false");
      expect(event.registration_url).toBe("");
      expect(event.source_name).toBe("UT Dallas Comet Calendar");
      expect(event.source_url.startsWith("https://calendar.utdallas.edu/event/")).toBe(true);
      expect(organizers.has(event.organizer_id)).toBe(true);
      expect(categories.has(event.category_id)).toBe(true);
      expect(event.interest_ids.split("|").every((id) => categories.has(id))).toBe(true);
      expect(event.starts_at.endsWith("-06:00")).toBe(true);
      expect(event.ends_at.endsWith("-06:00")).toBe(true);
      expect(Date.parse(event.starts_at)).toBeGreaterThan(Date.parse("2026-11-15T00:00:00-06:00"));
      expect(Date.parse(event.ends_at)).toBeGreaterThan(Date.parse(event.starts_at));
      expect(sources.get(event.source_url)?.has(event.starts_at)).toBe(true);
      const identity = `${event.source_url}|${event.starts_at}`;
      expect(identities.has(identity)).toBe(false);
      identities.add(identity);
    }
  });

  it("records no extra or undocumented recurring occurrences", () => {
    const expected = manifest.sources.reduce((n, s) => n + s.occurrences.length, 0);
    expect(expected).toBe(rows.length);
  });
});
