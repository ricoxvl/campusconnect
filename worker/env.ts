export interface Env {
  DB: D1Database;
  ASSETS?: { fetch(request: Request): Promise<Response> };
  ENVIRONMENT: "development" | "production";
  ALLOWED_ORIGINS?: string;
  ALLOW_FICTIONAL_EVENTS?: string;
  ADMIN_DEV_TOKEN?: string;
  ACCESS_TEAM_DOMAIN?: string;
  ACCESS_AUD?: string;
  ADMIN_EMAILS?: string;
  INTEREST_WEIGHT?: string;
  SCHEDULE_WEIGHT?: string;
  REVERIFY_AFTER_DAYS?: string;
}
import type { D1Database } from "@cloudflare/workers-types";
