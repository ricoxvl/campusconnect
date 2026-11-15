import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import App from "./App";
import { AppProvider } from "./context/AppContext";
import { emptyPreferences, STORAGE_KEYS } from "./lib/storage";
import { mockRepository, emptyPage } from "./test/repository";
import type { EventRepository } from "./types";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-07T12:00:00-06:00"));
});
function mount(path = "/", repository?: Partial<EventRepository>) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppProvider repository={{ ...mockRepository, ...repository }}>
        <App />
      </AppProvider>
    </MemoryRouter>,
  );
}
const preset = () =>
  localStorage.setItem(
    STORAGE_KEYS.preferences,
    JSON.stringify({
      ...emptyPreferences,
      interests: ["Technology"],
      days: ["Thu"],
      periods: ["Afternoon"],
    }),
  );

describe("the seven-screen primary journey", () => {
  it("validates onboarding, keeps backward edits, recommends, saves, refreshes and removes", async () => {
    const user = userEvent.setup();
    const app = mount();
    expect(
      screen.getByRole("heading", { name: "Find your place on campus." }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: /Find my first 3/ }));
    await user.click(
      screen.getByRole("button", { name: /Continue to availability/ }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Choose at least one interest",
    );
    await user.click(screen.getByRole("button", { name: "Technology" }));
    await user.click(
      screen.getByRole("button", { name: "Career & networking" }),
    );
    await user.click(
      screen.getByRole("button", { name: /Continue to availability/ }),
    );
    await user.click(screen.getByRole("button", { name: /Show my Top 3/ }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Select at least one day and a time",
    );
    await user.click(screen.getByRole("button", { name: "Thu" }));
    await user.click(screen.getByRole("button", { name: /Afternoon/ }));
    await user.click(screen.getByRole("link", { name: "Back to interests" }));
    expect(screen.getByRole("button", { name: "Technology" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      screen.getByRole("button", { name: "Career & networking" }),
    ).toHaveAttribute("aria-pressed", "true");
    await user.click(
      screen.getByRole("button", { name: /Continue to availability/ }),
    );
    expect(screen.getByRole("button", { name: "Thu" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /Afternoon/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await user.click(screen.getByRole("button", { name: /Show my Top 3/ }));
    expect(await screen.findAllByRole("article")).toHaveLength(3);
    const first = screen.getAllByRole("article")[0];
    expect(first).toHaveTextContent(
      "Matches Technology + Career & networking + Thu afternoon.",
    );
    await user.click(within(first).getByRole("button", { name: /^Save/ }));
    await user.click(screen.getByRole("link", { name: /Saved/ }));
    expect(
      screen.getByRole("heading", { name: "My Campus Plan" }),
    ).toBeInTheDocument();
    expect(await screen.findAllByRole("article")).toHaveLength(1);
    app.unmount();
    mount("/plan");
    const restored = await screen.findByRole("article");
    expect(restored).toHaveTextContent("Sample student tech meetup");
    await user.click(within(restored).getByRole("button", { name: /^Remove/ }));
    expect(
      await screen.findByText(/No events saved yet\./),
    ).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.saved)!)).toEqual([]);
  });

  it("supports no schedule preference and preserves prior schedule choices", async () => {
    preset();
    const user = userEvent.setup();
    mount("/onboarding/availability");
    await user.click(
      screen.getByRole("button", { name: /No schedule preference/ }),
    );
    expect(screen.getByText("Any day")).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: /No schedule preference/ }),
    );
    expect(screen.getByRole("button", { name: "Thu" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await user.click(screen.getByRole("button", { name: /Any time/ }));
    await user.click(screen.getByRole("button", { name: /Afternoon/ }));
    expect(screen.getByRole("button", { name: /Afternoon/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /Any time/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    await user.click(
      screen.getByRole("button", { name: /No schedule preference/ }),
    );
    await user.click(screen.getByRole("button", { name: /Show my Top 3/ }));
    expect(await screen.findAllByRole("article")).toHaveLength(3);
    expect(
      screen.getAllByText(/Matches Technology \+ no schedule preference/),
    ).toHaveLength(3);
  });
});

describe("Phase 3 preference fallback", () => {
  it("recommends by interests without requiring availability or changing saves", async () => {
    localStorage.setItem(
      STORAGE_KEYS.preferences,
      JSON.stringify({ ...emptyPreferences, interests: ["Technology"] }),
    );
    localStorage.setItem(STORAGE_KEYS.saved, JSON.stringify(["coding-circle"]));
    mount("/recommendations");
    expect(await screen.findAllByRole("article")).toHaveLength(3);
    expect(screen.getByText(/No availability selected/)).toBeInTheDocument();
    expect(
      JSON.parse(localStorage.getItem(STORAGE_KEYS.preferences)!).days,
    ).toEqual([]);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.saved)!)).toEqual([
      "coding-circle",
    ]);
  });
});

describe("explore and details", () => {
  it("combines filters, clears no results, and preserves search when returning from details", async () => {
    preset();
    const user = userEvent.setup();
    mount("/explore");
    expect(await screen.findAllByRole("article")).toHaveLength(18);
    await user.type(
      screen.getByRole("searchbox", { name: "Search campus events" }),
      "coding",
    );
    await user.click(
      within(
        screen.getByRole("group", { name: "Quick interest filters" }),
      ).getByRole("button", { name: "Technology" }),
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Date filter" }),
      "next-week",
    );
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Availability filter" }),
      "mine",
    );
    expect(await screen.findAllByRole("article")).toHaveLength(1);
    await user.click(
      screen.getByRole("link", {
        name: /View details for Sample coding circle/,
      }),
    );
    expect(
      await screen.findByRole("heading", { name: "Sample coding circle" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Do not use this listing to make attendance plans/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Open official event page/ }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "New here? Know before you go." }),
    ).toBeInTheDocument();
    const saves = screen.getAllByRole("button", {
      name: /^Save Sample coding/,
    });
    expect(saves).toHaveLength(2);
    await user.click(saves[0]);
    expect(
      screen
        .getAllByRole("button", { name: /^Remove Sample coding/ })
        .every((b) => b.getAttribute("aria-pressed") === "true"),
    ).toBe(true);
    await user.click(screen.getByRole("button", { name: "Back to events" }));
    expect(screen.getByRole("searchbox")).toHaveValue("coding");
    expect(screen.getByRole("combobox", { name: "Date filter" })).toHaveValue(
      "next-week",
    );
    expect(
      screen.getByRole("button", { name: /^Remove Sample coding/ }),
    ).toHaveAttribute("aria-pressed", "true");
    await user.type(screen.getByRole("searchbox"), " robotics");
    expect(
      await screen.findByRole("heading", { name: "No events match just yet" }),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole("button", { name: /Clear search and filters/ }),
    );
    expect(screen.getByRole("searchbox")).toHaveValue("");
    expect(await screen.findAllByRole("article")).toHaveLength(18);
    await user.click(screen.getByText("All filters →"));
    await user.click(screen.getByRole("button", { name: "Volunteering" }));
    expect(await screen.findAllByRole("article")).toHaveLength(2);
  });
  it("shows no newcomer claims when there is no supporting event data", async () => {
    mount("/events/tech-meetup");
    expect(
      await screen.findByRole("heading", {
        name: "Sample student tech meetup",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "New here? Know before you go." }),
    ).not.toBeInTheDocument();
    expect(screen.getByText("Information unverified")).toBeInTheDocument();
  });
  it("shows recommendation and saved empty states plus unknown routes and events", async () => {
    const app = mount("/recommendations");
    expect(
      screen.getByRole("heading", { name: "Let’s find your starting point" }),
    ).toBeInTheDocument();
    app.unmount();
    const app2 = mount("/events/missing");
    expect(
      await screen.findByRole("heading", { name: "Event not found" }),
    ).toBeInTheDocument();
    app2.unmount();
    mount("/unknown");
    expect(
      screen.getByRole("heading", { name: "Page not found" }),
    ).toBeInTheDocument();
  });
});

describe("async and persistence states", () => {
  it("renders a genuine loading state then an empty catalog", async () => {
    let resolve!: (value: []) => void;
    mount("/explore", {
      query: () =>
        new Promise((r) => {
          resolve = () => r(emptyPage);
        }),
    });
    expect(screen.getByText("Loading events…")).toBeInTheDocument();
    await waitFor(() => expect(resolve).toBeTypeOf("function"));
    await act(async () => {
      resolve([]);
    });
    expect(
      screen.getByRole("heading", { name: "No events available yet" }),
    ).toBeInTheDocument();
  });
  it("recovers from a failed repository request using retry", async () => {
    const list = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(emptyPage);
    const user = userEvent.setup();
    mount("/explore", { query: list });
    expect(
      await screen.findByRole("heading", { name: "Events couldn’t load" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Try again/ }));
    expect(
      await screen.findByRole("heading", { name: "No events available yet" }),
    ).toBeInTheDocument();
    expect(list).toHaveBeenCalledTimes(2);
  });
  it("synchronizes bookmarks from other tabs and handles browser storage failure", async () => {
    preset();
    const app = mount("/explore?q=coding");
    await screen.findByRole("article");
    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: STORAGE_KEYS.saved,
          newValue: '["coding-circle"]',
        }),
      );
    });
    expect(
      screen.getByRole("button", { name: /^Remove Sample coding/ }),
    ).toHaveAttribute("aria-pressed", "true");
    app.unmount();
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    mount("/plan");
    await waitFor(() =>
      expect(
        screen.getByText(/Browser storage is unavailable/),
      ).toBeInTheDocument(),
    );
  });
});
