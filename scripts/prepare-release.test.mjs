import test from "node:test";
import assert from "node:assert/strict";
import { createPilotConfig, parseJsonc } from "./prepare-release.mjs";
import { readFileSync } from "node:fs";

const base = {
  name: "campusconnect-development",
  workers_dev: false,
  vars: { ENVIRONMENT: "development" },
  env: {
    production: {
      name: "campusconnect-production",
      workers_dev: false,
      d1_databases: [
        {
          binding: "DB",
          database_name: "campusconnect-production",
          database_id: "00000000-0000-0000-0000-000000000002",
          migrations_dir: "worker/migrations",
        },
      ],
      vars: {
        ENVIRONMENT: "production",
        ALLOW_FICTIONAL_EVENTS: "false",
        ALLOWED_ORIGINS: "",
      },
    },
  },
};

const required = {
  CAMPUSCONNECT_D1_DATABASE_ID: "5bc8b581-0abb-4c41-a746-47dd174d7a15",
  CAMPUSCONNECT_HOST: "campusconnect-production.example-workers.workers.dev",
  CAMPUSCONNECT_ACCESS_TEAM_DOMAIN: "example.cloudflareaccess.com",
  CAMPUSCONNECT_ACCESS_AUD: "f43a724dc9914ab2897dff7a299c723e",
  CAMPUSCONNECT_ADMIN_EMAILS: "owner@example.org",
};

test("uses actual D1 ID and exact same-origin URL; fictional events stay disabled", () => {
  const config = createPilotConfig(base, required);
  assert.equal(config.env.production.workers_dev, true);
  assert.deepEqual(config.env.production.routes, []);
  assert.equal(
    config.env.production.d1_databases[0].database_id,
    required.CAMPUSCONNECT_D1_DATABASE_ID,
  );
  assert.equal(
    config.env.production.vars.ALLOWED_ORIGINS,
    `https://${required.CAMPUSCONNECT_HOST}`,
  );
  assert.equal(config.env.production.vars.ACCESS_TEAM_DOMAIN, required.CAMPUSCONNECT_ACCESS_TEAM_DOMAIN);
  assert.equal(config.env.production.vars.ACCESS_AUD, required.CAMPUSCONNECT_ACCESS_AUD);
  assert.equal(config.env.production.vars.ADMIN_EMAILS, "owner@example.org");
  assert.equal(config.env.production.vars.ALLOW_FICTIONAL_EVENTS, "false");
  assert.equal(config.env.production.vars.ENVIRONMENT, "production");
  assert.equal(base.env.production.workers_dev, false);
  assert.equal(base.env.production.d1_databases[0].database_id, "00000000-0000-0000-0000-000000000002");
});

test("refuses missing, placeholder and malformed production configuration", () => {
  for (const [key, value] of [
    ["CAMPUSCONNECT_D1_DATABASE_ID", ""],
    ["CAMPUSCONNECT_D1_DATABASE_ID", "00000000-0000-0000-0000-000000000000"],
    ["CAMPUSCONNECT_D1_DATABASE_ID", "00000000-0000-0000-0000-000000000002"],
    ["CAMPUSCONNECT_HOST", "localhost:8787"],
    ["CAMPUSCONNECT_HOST", "attacker.example.com"],
    ["CAMPUSCONNECT_ACCESS_TEAM_DOMAIN", "example.com"],
    ["CAMPUSCONNECT_ACCESS_AUD", ""],
    ["CAMPUSCONNECT_ADMIN_EMAILS", ""],
    ["CAMPUSCONNECT_ADMIN_EMAILS", "not-an-email"],
    ["CAMPUSCONNECT_ADMIN_EMAILS", "owner@example.org,owner@example.org"],
  ]) {
    assert.throws(
      () => createPilotConfig(base, { ...required, [key]: value }),
      undefined,
      `Expected to reject invalid ${key}: ${value}`,
    );
  }
  const unsafe = structuredClone(base);
  unsafe.env.production.vars.ALLOW_FICTIONAL_EVENTS = "true";
  assert.throws(() => createPilotConfig(unsafe, required));
});


test("parses the real Wrangler JSONC (including its trailing commas)", () => {
  const real = readFileSync(new URL("../wrangler.jsonc", import.meta.url), "utf8");
  const parsed = parseJsonc(real);
  assert.equal(parsed.env.production.name, "campusconnect-production");
  assert.equal(parsed.env.production.vars.ALLOW_FICTIONAL_EVENTS, "false");
});

test("JSONC parser handles comments and URLs without corrupting strings", () => {
  const sample = [
    "{",
    '  // An example comment',
    '  "source": "https://calendar.utdallas.edu/example",',
    '  "nested": {"items": [1, 2,],}, /* trailing comment */',
    "}",
  ].join("\n");
  assert.deepEqual(parseJsonc(sample), {
    source: "https://calendar.utdallas.edu/example",
    nested: { items: [1, 2] },
  });
});
