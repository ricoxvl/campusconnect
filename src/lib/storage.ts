import { DAYS, PERIODS, type Preferences } from "../types";
export const STORAGE_KEYS = {
  preferences: "campusconnect.preferences.v1",
  saved: "campusconnect.saved.v1",
};
export const emptyPreferences: Preferences = {
  interests: [],
  days: [],
  periods: [],
  anyTime: false,
  noSchedulePreference: false,
};
export function parsePreferences(raw: string | null): Preferences {
  try {
    const p = JSON.parse(raw ?? "null");
    if (!p || typeof p !== "object") return { ...emptyPreferences };
    const only = <T extends string>(
      items: unknown,
      allowed: readonly T[],
    ): T[] =>
      Array.isArray(items)
        ? [...new Set(items.filter((x): x is T => allowed.includes(x)))]
        : [];
    return {
      interests: Array.isArray(p.interests)
        ? [
            ...new Set<string>(
              p.interests.filter(
                (x: unknown): x is string =>
                  typeof x === "string" &&
                  x.trim().length > 0 &&
                  x.length <= 80,
              ),
            ),
          ].slice(0, 30)
        : [],
      days: only(p.days, DAYS),
      periods: only(p.periods, PERIODS),
      anyTime: p.anyTime === true,
      noSchedulePreference: p.noSchedulePreference === true,
    };
  } catch {
    return { ...emptyPreferences };
  }
}
export function parseSaved(raw: string | null): string[] {
  try {
    const items = JSON.parse(raw ?? "[]");
    return Array.isArray(items)
      ? [
          ...new Set(
            items.filter(
              (id): id is string =>
                typeof id === "string" &&
                /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(id),
            ),
          ),
        ]
      : [];
  } catch {
    return [];
  }
}
export function toggleSaved(saved: string[], id: string): string[] {
  return saved.includes(id) ? saved.filter((x) => x !== id) : [...saved, id];
}
export function readStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
export function writeStorage(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
