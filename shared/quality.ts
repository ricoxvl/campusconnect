import type { CampusEvent } from "./contracts";
export function canonicalSource(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    url.hash = "";
    for (const key of [...url.searchParams.keys()])
      if (/^utm_|^(fbclid|gclid)$/i.test(key)) url.searchParams.delete(key);
    url.searchParams.sort();
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    return url.toString();
  } catch {
    return null;
  }
}
const normalized = (text: string) =>
  text.normalize("NFKC").toLowerCase().trim().replace(/\s+/g, " ");
export function identityKeys(event: {
  title: string;
  startsAt: string;
  organizerId?: string;
  organizer?: string;
  location: string;
  source: { url: string | null };
}): string[] {
  const time = Date.parse(event.startsAt);
  const source = canonicalSource(event.source.url);
  return [
    ...(source ? [`source:${source}|${time}`] : []),
    `identity:${normalized(event.title)}|${time}|${normalized(event.organizerId ?? event.organizer ?? "")}|${normalized(event.location)}`,
  ];
}
export function uniqueEvents<T extends CampusEvent>(events: T[]): T[] {
  const seen = new Set<string>();
  return events.filter((event) => {
    const keys = identityKeys(event);
    if (keys.some((key) => seen.has(key))) return false;
    keys.forEach((key) => seen.add(key));
    return true;
  });
}
export function reviewDays(raw?: string): number {
  const n = Number(raw);
  return raw?.trim() && Number.isFinite(n) && n >= 1 && n <= 90 ? n : 7;
}
export function isStale(
  lastVerifiedAt: string | null | undefined,
  now: number,
  days = 7,
): boolean {
  const value = lastVerifiedAt ? Date.parse(lastVerifiedAt) : NaN;
  return (
    !Number.isFinite(value) || value > now || value < now - days * 86400000
  );
}
