import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const token = readFileSync(".dev.vars", "utf8").match(
  /ADMIN_DEV_TOKEN="([^"]+)"/,
)?.[1];
const api = "http://127.0.0.1:8787/api/v1";
const prefs = {
  interests: ["Technology"],
  days: [],
  periods: [],
  anyTime: false,
  noSchedulePreference: false,
};
test("onboarding and mobile layouts preserve the seven-screen journey", async ({
  page,
}, info) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Find your place on campus." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Find my first 3" }).click();
  await page.getByRole("button", { name: "Technology", exact: true }).click();
  await page.getByRole("button", { name: "Continue to availability" }).click();
  await page.getByRole("button", { name: /No schedule preference/ }).click();
  await page.getByRole("button", { name: "Show my Top 3" }).click();
  await expect(page.getByRole("article")).toHaveCount(3);
  await expect(
    page.getByRole("heading", { name: "Your first 3 campus experiences" }),
  ).toBeVisible();
  await page.screenshot({
    path: `work/browser-artifacts/${info.project.name}-recommendations.png`,
  });
  for (const width of [320, 390, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});
test("interests work without availability; search, filters, saved refresh and reload work", async ({
  page,
}, info) => {
  await page.goto("/");
  await page.evaluate(
    (value) =>
      localStorage.setItem(
        "campusconnect.preferences.v1",
        JSON.stringify(value),
      ),
    prefs,
  );
  await page.goto("/recommendations");
  await expect(page.getByText(/No availability selected/)).toBeVisible();
  await expect(page.getByRole("article")).toHaveCount(3);
  await page.getByRole("link", { name: /Explore all campus events/ }).click();
  await page
    .getByRole("searchbox", { name: "Search campus events" })
    .fill("coding");
  await page
    .getByRole("group", { name: "Quick interest filters" })
    .getByRole("button", { name: "Technology", exact: true })
    .click();
  await expect(page.getByRole("article")).toHaveCount(1);
  const card = page.getByRole("article");
  await card.getByRole("button", { name: /^Save / }).click();
  await expect(card.getByRole("button", { name: /^Remove / })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await card.getByRole("link", { name: /View details/ }).click();
  await expect(
    page.getByRole("heading", { name: "Sample coding circle" }),
  ).toBeVisible();
  await expect(page.getByText(/This is a fictional example/)).toBeVisible();
  await page.screenshot({
    path: `work/browser-artifacts/${info.project.name}-details.png`,
  });
  await page.getByRole("button", { name: "Back to events" }).click();
  await page.getByRole("link", { name: /Saved/ }).click();
  await expect(page.getByRole("article")).toHaveCount(1);
  await page.reload();
  await expect(page.getByRole("article")).toHaveCount(1);
  await page.getByRole("button", { name: "Refresh saved events" }).click();
  await expect(page.getByRole("article")).toHaveCount(1);
  await page.getByRole("button", { name: /^Remove / }).click();
  await expect(page.getByText("No events saved yet.")).toBeVisible();
});
test("admin CSV preview, confirmation actions and source-independent review remain protected", async ({
  page,
  request,
}, info) => {
  test.skip(!token, "Run setup:local to create the private local token.");
  expect(
    (
      await request.post(`${api}/admin/import/preview`, {
        data: { csv: "bad" },
      })
    ).status(),
  ).toBe(401);
  const title = `Sample browser import ${crypto.randomUUID()}`;
  let id: string | undefined;
  try {
    await page.goto("/admin");
    await page.getByLabel("Local development token").fill(token!);
    await page.getByRole("button", { name: "Connect local session" }).click();
    await page.getByRole("button", { name: "CSV import", exact: true }).click();
    const csv = readFileSync(
      "public/event-import-template.csv",
      "utf8",
    ).replace("Sample CSV workshop", title);
    await page.getByLabel("CSV contents").fill(csv);
    await page.getByRole("button", { name: "Preview import" }).click();
    await expect(
      page.getByText("1 ready to import; 0 need correction."),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Import 1 selected draft", exact: true })
      .click();
    await expect(
      page.getByText(/1 event imported as unverified drafts/),
    ).toBeVisible();
    await page.getByRole("button", { name: "Review imported drafts" }).click();
    const article = page
      .getByRole("article")
      .filter({ has: page.getByRole("heading", { name: title, exact: true }) });
    await expect(
      article.getByText("draft", { exact: true }).first(),
    ).toBeVisible();
    const records = await (
      await request.get(`${api}/admin/events?q=${encodeURIComponent(title)}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
    ).json();
    id = records.data[0].id;
    await article
      .getByRole("button", { name: `Publish ${title}`, exact: true })
      .click();
    await expect(
      page.getByRole("region", { name: "Confirm event action" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Confirm publication" }).click();
    await expect(article.getByText("published", { exact: true })).toBeVisible();
    await article
      .getByRole("button", { name: `Unpublish ${title}`, exact: true })
      .click();
    await page.getByRole("button", { name: "Confirm unpublish" }).click();
    await expect(
      article.getByText("draft", { exact: true }).first(),
    ).toBeVisible();
    expect((await request.get(`${api}/events/${id}`)).status()).toBe(404);
    await page.screenshot({
      path: `work/browser-artifacts/${info.project.name}-admin.png`,
    });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await article
      .getByRole("button", { name: `Archive ${title}`, exact: true })
      .click();
    await page.getByRole("button", { name: "Confirm archive" }).click();
    await expect(article.getByText("archived", { exact: true })).toBeVisible();
  } finally {
    if (id)
      await request.delete(`${api}/admin/events/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
  }
});
test("keyboard navigation exposes focus and filter controls; production headers are present", async ({
  page,
  request,
}) => {
  await page.goto("/explore");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("searchbox")).toBeFocused();
  const summary = page.getByText("All filters →");
  await summary.click();
  await page.getByRole("button", { name: "Volunteering", exact: true }).focus();
  await page.keyboard.press("Space");
  await expect(
    page.getByRole("button", { name: "Volunteering", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  expect((await request.get("http://127.0.0.1:5173/.dev.vars")).status()).toBe(
    403,
  );
  const health = await request.get(`${api}/health`);
  expect(health.status()).toBe(200);
  expect(health.headers()["x-request-id"]).toBeTruthy();
});
test("built Worker app runs under security headers", async ({
  page,
  request,
}) => {
  const response = await request.get("http://127.0.0.1:8787/");
  expect(response.headers()["content-security-policy"]).toContain(
    "frame-ancestors 'none'",
  );
  expect(response.headers()["x-content-type-options"]).toBe("nosniff");
  const failures: string[] = [];
  page.on("pageerror", (error) => failures.push(error.message));
  await page.goto("http://127.0.0.1:8787/explore");
  await expect(page.getByRole("article").first()).toBeVisible();
  await page.getByRole("searchbox").fill("coding");
  await expect(page.getByRole("article")).toHaveCount(1);
  expect(failures).toEqual([]);
});
