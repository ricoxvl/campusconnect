import { z } from "zod";
import type { Env } from "./env";
import { auditStatement } from "./audit";
import {
  commitCsv,
  csvCommitSchema,
  csvRequestSchema,
  previewCsv,
} from "./csv";
import { requireAdmin } from "./auth";
import { HttpError, json, readJson } from "./http";
import {
  adminEvent,
  categories,
  getEvent,
  listAdminEvents,
  listEvents,
  organizers,
  publicEvent,
  recommendations,
  saveEvent,
} from "./database";
import {
  categorySchema,
  eventPatchSchema,
  idSchema,
  organizerSchema,
  preferencesSchema,
  querySchema,
  validateEvent,
} from "./validation";

function parseQuery(url: URL) {
  const values: Record<string, unknown> = {};
  for (const key of new Set(url.searchParams.keys()))
    values[key] = ["category", "day", "period"].includes(key)
      ? url.searchParams.getAll(key)
      : url.searchParams.get(key);
  return querySchema.parse(values);
}
async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url),
    path = url.pathname.replace(/\/$/, "");
  const now = Date.now();
  if (path === "/api/v1/health") {
    if (request.method !== "GET")
      throw new HttpError(405, "method_not_allowed", "Method not allowed.");
    try {
      await env.DB.prepare("SELECT 1").first();
      return json({ data: { status: "ok" } });
    } catch {
      throw new HttpError(
        503,
        "database_unavailable",
        "The service is temporarily unavailable.",
      );
    }
  }
  const publicMethod =
    path === "/api/v1/recommendations"
      ? "POST"
      : path === "/api/v1/events" ||
          path === "/api/v1/categories" ||
          /^\/api\/v1\/events\/[^/]+$/.test(path)
        ? "GET"
        : null;
  if (publicMethod && request.method !== publicMethod)
    throw new HttpError(405, "method_not_allowed", "Method not allowed.");
  if (path === "/api/v1/categories" && request.method === "GET")
    return json({ data: await categories(env) });
  if (path === "/api/v1/events" && request.method === "GET")
    return json(await listEvents(env, parseQuery(url), now));
  const eventMatch = path.match(/^\/api\/v1\/events\/([^/]+)$/);
  if (eventMatch && request.method === "GET") {
    const row = await getEvent(env, idSchema.parse(eventMatch[1]));
    if (!row) throw new HttpError(404, "not_found", "Event not found.");
    return json({ data: publicEvent(row, env, now) });
  }
  if (path === "/api/v1/recommendations" && request.method === "POST")
    return json({
      data: await recommendations(
        env,
        preferencesSchema.parse(await readJson(request)),
        now,
        querySchema.parse({}),
      ),
    });
  if (path.startsWith("/api/v1/admin")) {
    const identity = await requireAdmin(request, env);
    const methods =
      path === "/api/v1/admin/session"
        ? ["GET"]
        : path === "/api/v1/admin/events"
          ? ["GET", "POST"]
          : /^\/api\/v1\/admin\/events\/[^/]+$/.test(path)
            ? ["GET", "PATCH", "DELETE"]
            : /^\/api\/v1\/admin\/(categories|organizers)$/.test(path)
              ? ["GET", "POST"]
              : /^\/api\/v1\/admin\/(categories|organizers)\/[^/]+$/.test(path)
                ? ["PATCH", "DELETE"]
                : null;
    if (methods && !methods.includes(request.method))
      throw new HttpError(405, "method_not_allowed", "Method not allowed.");
    if (
      path === "/api/v1/admin/import/preview" ||
      path === "/api/v1/admin/import"
    ) {
      if (request.method !== "POST")
        throw new HttpError(405, "method_not_allowed", "Method not allowed.");
      if (path.endsWith("/preview")) {
        const body = csvRequestSchema.parse(await readJson(request, 131072));
        return json({ data: await previewCsv(env, body.csv, now) });
      }
      const body = csvCommitSchema.parse(await readJson(request, 131072));
      return json({
        data: await commitCsv(env, body.csv, body.rows, identity, now),
      });
    }
    if (path === "/api/v1/admin/audit" && request.method === "GET")
      return json({
        data: (
          await env.DB.prepare(
            "SELECT actor,action,resource_id AS resourceId,happened_at AS happenedAt FROM admin_audit ORDER BY happened_at DESC LIMIT 50",
          ).all()
        ).results,
      });
    if (path === "/api/v1/admin/session" && request.method === "GET")
      return json({ data: { identity } });
    if (path === "/api/v1/admin/events") {
      if (request.method === "GET") {
        const values = Object.fromEntries(url.searchParams);
        const q = z
          .object({
            q: querySchema.shape.q,
            page: querySchema.shape.page,
            pageSize: querySchema.shape.pageSize,
            view: z
              .enum([
                "all",
                "review",
                "duplicates",
                "expired",
                "draft",
                "published",
                "archived",
                "canceled",
              ])
              .default("all"),
          })
          .strict()
          .parse(values);
        return json(
          await listAdminEvents(env, q.page, q.pageSize, q.view, q.q, now),
        );
      }
      if (request.method === "POST") {
        const event = validateEvent(await readJson(request), now);
        return json(
          {
            data: await saveEvent(
              env,
              event,
              event.id ?? crypto.randomUUID(),
              now,
              true,
              identity,
            ),
          },
          201,
        );
      }
    }
    const adminMatch = path.match(/^\/api\/v1\/admin\/events\/([^/]+)$/);
    if (adminMatch) {
      const id = idSchema.parse(adminMatch[1]);
      const row = await getEvent(env, id, true);
      if (!row) throw new HttpError(404, "not_found", "Event not found.");
      if (request.method === "GET") return json({ data: adminEvent(row) });
      if (request.method === "DELETE") {
        if (row.status !== "archived")
          await env.DB.batch([
            env.DB.prepare(
              "UPDATE events SET status='archived',updated_at=? WHERE id=?",
            ).bind(now, id),
            auditStatement(env, identity, "event.archived", id, now),
          ]);
        return new Response(null, { status: 204 });
      }
      if (request.method === "PATCH") {
        const patch = eventPatchSchema.parse(await readJson(request));
        if (!Object.keys(patch).length)
          throw new HttpError(
            422,
            "empty_patch",
            "Provide at least one field to update.",
          );
        const { updatedAt: _updated, ...existing } = adminEvent(row);
        const merged = { ...existing, ...patch };
        if (
          !existing.fictional &&
          existing.verification.status === "verified" &&
          Object.keys(patch).some((k) => k !== "status") &&
          !patch.verification
        ) {
          merged.verification = {
            status: "unverified",
            lastVerifiedAt: null,
            evidence: null,
          };
          merged.registration = null;
          if (merged.status === "published") merged.status = "draft";
        }
        return json({
          data: await saveEvent(
            env,
            validateEvent(merged, now),
            id,
            now,
            false,
            identity,
          ),
        });
      }
    }
    const entity = path.match(
      /^\/api\/v1\/admin\/(categories|organizers)(?:\/([^/]+))?$/,
    );
    if (entity) {
      const table = entity[1] as "categories" | "organizers";
      const id = entity[2] ? idSchema.parse(entity[2]) : null;
      if (!id && request.method === "GET")
        return json({
          data:
            table === "categories"
              ? await categories(env)
              : await organizers(env),
        });
      if (!id && request.method === "POST") {
        const body = await readJson(request);
        if (table === "categories") {
          const value = categorySchema.parse(body);
          const newId = value.id ?? crypto.randomUUID();
          await env.DB.batch([
            env.DB.prepare("INSERT INTO categories(id,name) VALUES (?,?)").bind(
              newId,
              value.name,
            ),
            auditStatement(env, identity, "categories.created", newId, now),
          ]);
          return json({ data: { id: newId, name: value.name } }, 201);
        }
        const value = organizerSchema.parse(body);
        const newId = value.id ?? crypto.randomUUID();
        await env.DB.batch([
          env.DB.prepare(
            "INSERT INTO organizers(id,name,url) VALUES (?,?,?)",
          ).bind(newId, value.name, value.url),
          auditStatement(env, identity, "organizers.created", newId, now),
        ]);
        return json({ data: { ...value, id: newId } }, 201);
      }
      if (id) {
        if (
          !(await env.DB.prepare(`SELECT id FROM ${table} WHERE id=?`)
            .bind(id)
            .first())
        )
          throw new HttpError(404, "not_found", "Record not found.");
        if (request.method === "DELETE") {
          await env.DB.batch([
            env.DB.prepare(`DELETE FROM ${table} WHERE id=?`).bind(id),
            auditStatement(env, identity, `${table}.deleted`, id, now),
          ]);
          return new Response(null, { status: 204 });
        }
        if (request.method === "PATCH") {
          if (table === "categories") {
            const value = categorySchema
              .omit({ id: true })
              .parse(await readJson(request));
            await env.DB.batch([
              env.DB.prepare("UPDATE categories SET name=? WHERE id=?").bind(
                value.name,
                id,
              ),
              auditStatement(env, identity, "categories.updated", id, now),
            ]);
            return json({ data: { id, ...value } });
          }
          const patch = organizerSchema
            .omit({ id: true })
            .extend({
              name: organizerSchema.shape.name.optional(),
              url: organizerSchema.shape.url.removeDefault().optional(),
            })
            .parse(await readJson(request));
          if (!Object.keys(patch).length)
            throw new HttpError(
              422,
              "empty_patch",
              "Provide at least one field to update.",
            );
          const previous = await env.DB.prepare(
            "SELECT name,url FROM organizers WHERE id=?",
          )
            .bind(id)
            .first<{ name: string; url: string | null }>();
          const value = { ...previous!, ...patch };
          await env.DB.batch([
            env.DB.prepare(
              "UPDATE organizers SET name=?,url=? WHERE id=?",
            ).bind(value.name, value.url, id),
            ...(previous!.name !== value.name || previous!.url !== value.url
              ? [
                  env.DB.prepare(
                    "UPDATE events SET verification_status='unverified',last_verified_at=NULL,verification_evidence=NULL,registration_url=NULL,registration_details=NULL,registration_verified_at=NULL,status=CASE WHEN status='published' THEN 'draft' ELSE status END,updated_at=? WHERE organizer_id=? AND fictional=0 AND verification_status='verified'",
                  ).bind(now, id),
                ]
              : []),
            auditStatement(env, identity, "organizers.updated", id, now),
          ]);
          return json({ data: { id, ...value } });
        }
      }
    }
  }
  if (path.startsWith("/api/"))
    throw new HttpError(404, "not_found", "API route not found.");
  if (env.ASSETS && ["GET", "HEAD"].includes(request.method))
    return env.ASSETS.fetch(request);
  throw new HttpError(404, "not_found", "Route not found.");
}
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const requestId = crypto.randomUUID(),
      started = Date.now();
    const origin = request.headers.get("Origin");
    const allowed = (env.ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean);
    let response: Response;
    try {
      if (origin && !allowed.includes(origin))
        throw new HttpError(
          403,
          "origin_not_allowed",
          "This origin is not allowed.",
        );
      if (request.method === "OPTIONS") {
        if (!origin || !allowed.includes(origin))
          throw new HttpError(
            403,
            "origin_not_allowed",
            "This origin is not allowed.",
          );
        const method = request.headers.get("Access-Control-Request-Method");
        if (!method || !["GET", "POST", "PATCH", "DELETE"].includes(method))
          throw new HttpError(405, "method_not_allowed", "Method not allowed.");
        response = new Response(null, {
          status: 204,
          headers: {
            "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Access-Control-Max-Age": "600",
          },
        });
      } else response = await route(request, env);
    } catch (error) {
      if (error instanceof z.ZodError)
        response = json(
          {
            error: {
              code: "validation_error",
              message: "Invalid input.",
              details: error.issues.map((i) => ({
                path: i.path.join("."),
                message: i.message,
              })),
            },
          },
          422,
        );
      else if (error instanceof HttpError)
        response = json(
          { error: { code: error.code, message: error.message } },
          error.status,
        );
      else if (
        error instanceof Error &&
        /UNIQUE constraint|FOREIGN KEY constraint|CHECK constraint/.test(
          error.message,
        )
      )
        response = json(
          {
            error: {
              code: "conflict",
              message:
                "The operation conflicts with an existing or referenced record.",
            },
          },
          409,
        );
      else {
        console.error(
          JSON.stringify({
            event: "api.failure",
            requestId,
            kind: error instanceof Error ? error.name : "UnknownError",
          }),
        );
        response = json(
          {
            error: {
              code: "internal_error",
              message: "The request could not be completed.",
            },
          },
          500,
        );
      }
    }
    const headers = new Headers(response.headers);
    headers.set("X-Request-Id", requestId);
    if (
      env.ENVIRONMENT === "production" &&
      new URL(request.url).pathname.startsWith("/api/")
    )
      console.info(
        JSON.stringify({
          event: "api.request",
          requestId,
          method: request.method,
          route: new URL(request.url).pathname
            .replace(/\/events\/[^/]+/g, "/events/:id")
            .replace(/\/(categories|organizers)\/[^/]+/g, "/$1/:id"),
          status: response.status,
          durationMs: Date.now() - started,
        }),
      );
    if (new URL(request.url).pathname.startsWith("/api/"))
      headers.set("Cache-Control", "no-store");
    headers.set("X-Content-Type-Options", "nosniff");
    headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    headers.set("X-Frame-Options", "DENY");
    headers.set(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=()",
    );
    if (origin && allowed.includes(origin)) {
      headers.set("Access-Control-Allow-Origin", origin);
      headers.set("Access-Control-Allow-Credentials", "true");
      headers.set("Access-Control-Expose-Headers", "X-Request-Id");
      headers.append("Vary", "Origin");
    }
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
