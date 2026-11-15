import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import "@testing-library/jest-dom/vitest";
import { createRequire } from "node:module";
import { webcrypto } from "node:crypto";
import { MemoryRouter } from "react-router-dom";
import App from "./App";
import { AppProvider } from "./context/AppContext";
import { STORAGE_KEYS } from "./lib/storage";
import worker from "../worker/index";
import { saveEvent } from "../worker/database";
import {
  clearEvents,
  fixture,
  futureDate,
  testDatabase,
  TOKEN,
} from "../worker/test/database";
// Start D1 with Node's native Web API objects, then add only the DOM globals
// React needs. Keeping Node Request/Response/URL avoids a jsdom realm mismatch
// in Miniflare's RPC proxy.
const harness = await testDatabase();
const { JSDOM } = createRequire(import.meta.url)("jsdom");
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost:5173",
  pretendToBeVisual: true,
});
for (const key of [
  "window",
  "document",
  "navigator",
  "localStorage",
  "HTMLElement",
  "Element",
  "Node",
  "MutationObserver",
])
  Object.defineProperty(globalThis, key, {
    configurable: true,
    writable: true,
    value: dom.window[key],
  });
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const { render, screen, waitFor, within, cleanup, act, fireEvent } =
  await import("@testing-library/react/pure");
const { default: userEvent } = await import("@testing-library/user-event");
let calls: string[];
let codingId: string;
function mount(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppProvider>
        <App />
      </AppProvider>
    </MemoryRouter>,
  );
}
async function loadedArticles(count: number) {
  await waitFor(() =>
    expect(screen.getAllByRole("article")).toHaveLength(count),
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
afterAll(async () => {
  await harness.mf.dispose();
  dom.window.close();
});
beforeEach(async () => {
  localStorage.clear();
  dom.window.scrollTo = vi.fn();
  vi.stubGlobal("scrollTo", vi.fn());
  await clearEvents(harness.env);
  const coding = fixture({ id: "coding-integration" });
  codingId = coding.id!;
  await saveEvent(harness.env, coding, codingId, Date.now(), true);
  const social = fixture({
    id: "social-integration",
    title: "Sample social event",
    description: "Fictional social gathering for testing.",
    categoryId: "social",
    interestIds: [],
    startsAt: futureDate(5, 14),
    endsAt: futureDate(5, 15),
  });
  await saveEvent(harness.env, social, social.id!, Date.now(), true);
  calls = [];
  vi.stubGlobal("crypto", webcrypto);
  const realFetch = globalThis.fetch.bind(globalThis);
  vi.spyOn(globalThis, "fetch").mockImplementation((input, init) => {
    const path =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    if (!path.startsWith("/api/v1")) return realFetch(input, init);
    calls.push(path);
    return worker.fetch(
      new Request(`http://localhost${path}`, {
        ...init,
        headers: { ...init?.headers, Origin: "http://localhost:5173" },
      }),
      harness.env,
    );
  });
});
describe("React → API client → Worker → D1 integration", () => {
  it("searches database records, gets server recommendations, persists saves, and handles archived bookmarks", async () => {
    localStorage.setItem(
      STORAGE_KEYS.preferences,
      JSON.stringify({
        interests: ["Technology", "Academics"],
        days: ["Thu"],
        periods: ["Afternoon"],
        anyTime: false,
        noSchedulePreference: false,
      }),
    );
    const user = userEvent.setup();
    const app = mount("/explore");
    await loadedArticles(2);
    await user.type(screen.getByRole("searchbox"), "coding");
    await loadedArticles(1);
    expect(calls.some((path) => path.includes("q=coding"))).toBe(true);
    await user.click(
      screen.getByRole("button", { name: /^Save Sample coding/ }),
    );
    await user.click(
      screen.getByRole("link", { name: /View details for Sample coding/ }),
    );
    expect(
      await screen.findByRole("heading", { name: "Sample coding circle" }),
    ).toBeInTheDocument();
    expect(calls).toContain(`/api/v1/events/${codingId}`);
    await user.click(screen.getByRole("button", { name: "Back to events" }));
    await loadedArticles(1);
    await user.click(screen.getByRole("link", { name: "Home" }));
    await loadedArticles(1);
    expect(
      screen.getByText("Matches Technology + Academics + Thu afternoon."),
    ).toBeInTheDocument();
    expect(calls).toContain("/api/v1/recommendations");
    await user.click(screen.getByRole("link", { name: /Saved/ }));
    await loadedArticles(1);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.saved)!)).toEqual([
      codingId,
    ]);
    await harness.env.DB.prepare(
      "UPDATE events SET status='archived' WHERE id=?",
    )
      .bind(codingId)
      .run();
    app.unmount();
    mount("/plan");
    expect(
      await screen.findByRole("heading", { name: "Unavailable saved events" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove" }));
    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.saved)!)).toEqual([]),
    );
  }, 30000);
  it("keeps API failure separate from a genuinely unavailable saved event", async () => {
    localStorage.setItem(STORAGE_KEYS.saved, JSON.stringify([codingId]));
    const original = harness.env.DB;
    const app = mount("/plan");
    await loadedArticles(1);
    app.unmount();
    // Simulate a failed request; a temporary outage must not turn saves into deletions.
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          error: { code: "internal_error", message: "Temporary outage" },
        }),
        { status: 500, headers: { "Content-Type": "application/json" } },
      ),
    );
    mount("/plan");
    expect(
      await screen.findByRole("heading", { name: "Events couldn’t load" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Unavailable saved events" }),
    ).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.saved)!)).toEqual([
      codingId,
    ]);
    expect(harness.env.DB).toBe(original);
  }, 30000);
  it("refreshes changed saved records on focus and explains cancellations", async () => {
    localStorage.setItem(STORAGE_KEYS.saved, JSON.stringify([codingId]));
    mount("/plan");
    await loadedArticles(1);
    await harness.env.DB.prepare(
      "UPDATE events SET title='Sample changed record',occurrence_status='canceled',change_note='Test cancellation update' WHERE id=?",
    )
      .bind(codingId)
      .run();
    act(() => window.dispatchEvent(new window.Event("focus")));
    expect(
      await screen.findByRole("heading", { name: "Canceled events" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Sample changed record" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Test cancellation update/)).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(STORAGE_KEYS.saved)!)).toEqual([
      codingId,
    ]);
  }, 30000);
  it("previews and imports CSV through the dashboard as unpublished drafts", async () => {
    const user = userEvent.setup();
    mount("/admin");
    await screen.findByLabelText("Local development token");
    await user.type(screen.getByLabelText("Local development token"), TOKEN);
    await user.click(
      screen.getByRole("button", { name: "Connect local session" }),
    );
    await user.click(await screen.findByRole("button", { name: "CSV import" }));
    const text =
      "title,description,category_id,interest_ids,organizer_id,starts_at,ends_at,location,source_name,source_url,registration_url,registration_details,fictional\n" +
      Array.from(
        { length: 6 },
        (_, i) =>
          `Sample dashboard import ${i},Fictional test record,technology,academics,test-organizer,${futureDate(3, 14)},${futureDate(3, 15)},Test import room,Test source,,,,true`,
      ).join("\n");
    fireEvent.change(screen.getByLabelText("CSV contents"), {
      target: { value: text },
    });
    await user.click(screen.getByRole("button", { name: "Preview import" }));
    await screen.findByText(/6 ready to import/);
    await user.click(
      screen.getByRole("button", { name: "Import 6 selected drafts" }),
    );
    expect(
      await screen.findByText(
        /6 events imported as unverified drafts/,
        {},
        { timeout: 10000 },
      ),
    ).toBeInTheDocument();
    expect(
      calls.filter((path) => path === "/api/v1/admin/import"),
    ).toHaveLength(2);
    const imported = await harness.env.DB.prepare(
      "SELECT status,verification_status FROM events WHERE title LIKE 'Sample dashboard import %'",
    ).all<{ status: string; verification_status: string }>();
    expect(imported.results).toHaveLength(6);
    expect(
      imported.results.every(
        (row) =>
          row.status === "draft" && row.verification_status === "unverified",
      ),
    ).toBe(true);
  }, 30000);
  it("authenticates the local admin UI, creates a draft, edits and publishes it, then archives it", async () => {
    const user = userEvent.setup();
    mount("/admin");
    await screen.findByLabelText("Local development token");
    await user.type(screen.getByLabelText("Local development token"), TOKEN);
    await user.click(
      screen.getByRole("button", { name: "Connect local session" }),
    );
    await screen.findByRole("button", { name: "Create event" });
    await user.click(screen.getByRole("button", { name: "Create event" }));
    await user.type(screen.getByLabelText("Title"), "Sample admin integration");
    await user.type(
      screen.getByLabelText("Description"),
      "Fictional administrator test only.",
    );
    await user.selectOptions(
      screen.getByLabelText("Primary category"),
      "technology",
    );
    await user.type(
      screen.getByLabelText("Start time (ISO 8601)"),
      futureDate(3, 16),
    );
    await user.type(
      screen.getByLabelText("End time (ISO 8601)"),
      futureDate(3, 17),
    );
    await user.type(screen.getByLabelText("Location"), "Example only");
    await user.type(
      screen.getByLabelText("Source name"),
      "Fictional test dataset",
    );
    await user.click(
      screen.getByRole("checkbox", { name: /Fictional test example/ }),
    );
    await user.click(screen.getByRole("button", { name: "Save event" }));
    const entry = await screen.findByRole("heading", {
      name: "Sample admin integration",
    });
    const article = entry.closest("article")!;
    expect(article).toHaveTextContent("draft");
    await user.click(
      within(article).getByRole("button", {
        name: "Edit Sample admin integration",
      }),
    );
    await user.clear(screen.getByLabelText("Location"));
    await user.type(
      screen.getByLabelText("Location"),
      "Updated example location",
    );
    await user.selectOptions(
      screen.getByLabelText("Publication status"),
      "published",
    );
    await user.click(screen.getByRole("button", { name: "Save event" }));
    await screen.findByRole("heading", { name: "Sample admin integration" });
    await waitFor(() =>
      expect(
        screen
          .getByRole("heading", { name: "Sample admin integration" })
          .closest("article"),
      ).toHaveTextContent("published"),
    );
    await user.click(
      within(
        screen
          .getByRole("heading", { name: "Sample admin integration" })
          .closest("article")!,
      ).getByRole("button", { name: "Archive Sample admin integration" }),
    );
    await user.click(screen.getByRole("button", { name: "Confirm archive" }));
    await waitFor(() =>
      expect(
        screen
          .getByRole("heading", { name: "Sample admin integration" })
          .closest("article"),
      ).toHaveTextContent("archived"),
    );
    expect(localStorage.getItem("ADMIN_DEV_TOKEN")).toBeNull();
  }, 30000);
});
