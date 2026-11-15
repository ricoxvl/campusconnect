import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/;

/** Parse Wrangler JSONC, respecting string literals, comments and trailing commas. */
export function parseJsonc(input) {
  let clean = "";
  let quoted = false, escaped = false, lineComment = false, blockComment = false;
  for (let i = 0; i < input.length; i++) {
    const c = input[i], next = input[i + 1];
    if (lineComment) {
      if (c === "\n") {
        lineComment = false;
        clean += "\n";
      } else clean += " ";
      continue;
    }
    if (blockComment) {
      if (c === "*" && next === "/") {
        clean += "  ";
        i++;
        blockComment = false;
      } else clean += c === "\n" ? "\n" : " ";
      continue;
    }
    if (quoted) {
      clean += c;
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') quoted = false;
      continue;
    }
    if (c === '"') {
      quoted = true;
      clean += c;
    } else if (c === "/" && next === "/") {
      clean += "  ";
      lineComment = true;
      i++;
    } else if (c === "/" && next === "*") {
      clean += "  ";
      blockComment = true;
      i++;
    } else {
      clean += c;
    }
  }
  let output = "", inString = false, escape = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if (inString) {
      output += c;
      if (escape) escape = false;
      else if (c === "\\") escape = true;
      else if (c === '"') inString = false;
    } else if (c === '"') {
      inString = true;
      output += c;
    } else if (c === ",") {
      let j = i + 1;
      while (j < clean.length && /\s/.test(clean[j])) j++;
      if (clean[j] !== "}" && clean[j] !== "]") output += c;
    } else {
      output += c;
    }
  }
  return JSON.parse(output);
}

function requireValue(values, key) {
  const value = values[key]?.trim();
  if (!value) throw new Error(`Missing required release setting: ${key}`);
  return value;
}

/**
 * Build a restricted, same-origin pilot release without committing account IDs,
 * administrator email addresses, tokens, or Cloudflare Access settings.
 * Cloudflare Access policies must be configured and independently checked
 * in Zero Trust; this script cannot verify their actual existence.
 */
export function createPilotConfig(base, values) {
  const id = requireValue(values, "CAMPUSCONNECT_D1_DATABASE_ID");
  if (!UUID.test(id) || /^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(id)) {
    throw new Error("Production D1 database ID must be a real Cloudflare UUID.");
  }
  const host = requireValue(values, "CAMPUSCONNECT_HOST").toLowerCase();
  if (!/^campusconnect-production\.[a-z0-9-]+\.workers\.dev$/.test(host)) {
    throw new Error(
      "Initial pilot requires the precise campusconnect-production.<account>.workers.dev hostname.",
    );
  }
  const team = requireValue(values, "CAMPUSCONNECT_ACCESS_TEAM_DOMAIN").toLowerCase();
  if (!/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(team)) {
    throw new Error("Invalid Cloudflare Access team domain.");
  }
  const aud = requireValue(values, "CAMPUSCONNECT_ACCESS_AUD");
  if (!/^[a-zA-Z0-9_-]{10,256}$/.test(aud)) {
    throw new Error("Invalid Cloudflare Access API application audience.");
  }
  const emails = requireValue(values, "CAMPUSCONNECT_ADMIN_EMAILS")
    .split(",")
    .map((s) => s.trim().toLowerCase());
  if (emails.length > 10 || emails.some((e) => !EMAIL.test(e))) {
    throw new Error("Provide 1–10 valid, comma-separated administrator emails.");
  }
  if (new Set(emails).size !== emails.length) {
    throw new Error("Duplicate administrator email in allowlist.");
  }
  if (!base?.env?.production || !Array.isArray(base.env.production.d1_databases)) {
    throw new Error("Missing existing Wrangler production environment.");
  }
  if (base.env.production.d1_databases.length !== 1 ||
      base.env.production.d1_databases[0].binding !== "DB") {
    throw new Error("Expected exactly one existing production D1 DB binding.");
  }
  if (base.env.production.vars?.ALLOW_FICTIONAL_EVENTS !== "false") {
    throw new Error("Production must explicitly disable fictional events.");
  }

  const production = base.env.production;
  return {
    ...base,
    env: {
      ...base.env,
      production: {
        ...production,
        // Initial private review can use a no-cost workers.dev URL.
        // Hostname-based Access MUST protect /admin* and /api/v1/admin*.
        workers_dev: true,
        routes: [],
        d1_databases: production.d1_databases.map((db) => ({
          ...db,
          database_id: id,
        })),
        vars: {
          ...production.vars,
          ENVIRONMENT: "production",
          ALLOW_FICTIONAL_EVENTS: "false",
          ALLOWED_ORIGINS: `https://${host}`,
          ACCESS_TEAM_DOMAIN: team,
          ACCESS_AUD: aud,
          ADMIN_EMAILS: emails.join(","),
        },
      },
    },
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (
    process.env.CAMPUSCONNECT_CONFIRM_FRESH_DB !== "true" ||
    process.env.CAMPUSCONNECT_CONFIRM_ACCESS_POLICY !== "true"
  ) {
    throw new Error(
      "Both explicit fresh-database and Cloudflare Access policy confirmations are required.",
    );
  }
  const source = parseJsonc(readFileSync("wrangler.jsonc", "utf8"));
  const config = createPilotConfig(source, process.env);
  const path = "wrangler.release.jsonc";
  writeFileSync(path, JSON.stringify(config, null, 2) + "\n", {
    flag: "w",
    mode: 0o600,
  });
  console.log(
    "Validated pilot release configuration generated locally (ignored by Git); " +
      "review Access policies before live use.",
  );
}
