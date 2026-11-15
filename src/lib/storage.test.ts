import { describe, expect, it, vi } from "vitest";
import {
  emptyPreferences,
  parsePreferences,
  parseSaved,
  readStorage,
  STORAGE_KEYS,
  toggleSaved,
  writeStorage,
} from "./storage";
describe("saved-event logic", () => {
  it("saves multiple events independently and removes one without mutating the input", () => {
    const first = toggleSaved([], "one");
    const both = toggleSaved(first, "two");
    expect(first).toEqual(["one"]);
    expect(both).toEqual(["one", "two"]);
    expect(toggleSaved(both, "one")).toEqual(["two"]);
    expect(both).toEqual(["one", "two"]);
  });
  it("round-trips across storage reads, removes duplicates and tolerates corrupt values", () => {
    expect(writeStorage(STORAGE_KEYS.saved, ["one", "two"])).toBe(true);
    expect(parseSaved(readStorage(STORAGE_KEYS.saved))).toEqual(["one", "two"]);
    expect(parseSaved('["one",3,null,"one",""]')).toEqual(["one"]);
    for (const raw of [null, "broken", "{}", "null"])
      expect(parseSaved(raw)).toEqual([]);
  });
  it("falls back safely when storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    expect(readStorage("test")).toBeNull();
    expect(writeStorage("test", [])).toBe(false);
  });
});
describe("preference persistence", () => {
  it("keeps valid choices and rejects unknown input or damaged storage", () => {
    expect(
      parsePreferences(
        '{"interests":["Technology",3,"Technology"],"days":["Thu","bad"],"periods":["Afternoon"],"anyTime":"true","noSchedulePreference":true}',
      ),
    ).toEqual({
      interests: ["Technology"],
      days: ["Thu"],
      periods: ["Afternoon"],
      anyTime: false,
      noSchedulePreference: true,
    });
    expect(parsePreferences("broken")).toEqual(emptyPreferences);
  });
});
