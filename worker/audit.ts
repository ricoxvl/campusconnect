import type { Env } from "./env";
export function auditStatement(
  env: Env,
  actor: string,
  action: string,
  id: string,
  now: number,
) {
  return env.DB.prepare(
    "INSERT INTO admin_audit(id,actor,action,resource_id,happened_at) VALUES (?,?,?,?,?)",
  ).bind(crypto.randomUUID(), actor, action, id, now);
}
