import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";
import type { Env } from "./env";
import { HttpError } from "./http";
const keySets = new Map<string, JWTVerifyGetKey>();
async function tokenMatches(candidate: string, expected: string) {
  const digest = (value: string) =>
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  const [left, right] = await Promise.all([
    digest(candidate),
    digest(expected),
  ]);
  const a = new Uint8Array(left),
    b = new Uint8Array(right);
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}
export async function requireAdmin(
  request: Request,
  env: Env,
  resolveKey?: JWTVerifyGetKey,
): Promise<string> {
  const host = new URL(request.url).hostname;
  if (
    env.ENVIRONMENT === "development" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(host) &&
    (env.ADMIN_DEV_TOKEN?.length ?? 0) >= 32
  ) {
    const token =
      request.headers.get("Authorization")?.replace(/^Bearer /, "") ?? "";
    if (
      token.length <= 1024 &&
      (await tokenMatches(token, env.ADMIN_DEV_TOKEN!))
    )
      return "local-development-admin";
  }
  const team = env.ACCESS_TEAM_DOMAIN;
  const admins = (env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  if (
    !team ||
    !/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(team) ||
    !env.ACCESS_AUD ||
    !admins.length
  )
    throw new HttpError(
      401,
      "unauthorized",
      "Administrator authentication is required.",
    );
  const assertion = request.headers.get("Cf-Access-Jwt-Assertion");
  if (!assertion || assertion.length > 16000)
    throw new HttpError(
      401,
      "unauthorized",
      "Administrator authentication is required.",
    );
  if (!keySets.has(team))
    keySets.set(
      team,
      createRemoteJWKSet(new URL(`https://${team}/cdn-cgi/access/certs`)),
    );
  let email: string;
  try {
    const { payload } = await jwtVerify(
      assertion,
      resolveKey ?? keySets.get(team)!,
      {
        issuer: `https://${team}`,
        audience: env.ACCESS_AUD,
        algorithms: ["RS256"],
        requiredClaims: ["exp", "iat", "sub", "email"],
      },
    );
    if (typeof payload.email !== "string") throw new Error("Missing identity");
    email = payload.email.toLowerCase();
  } catch {
    throw new HttpError(
      401,
      "unauthorized",
      "Administrator authentication is required.",
    );
  }
  if (!admins.includes(email))
    throw new HttpError(
      403,
      "forbidden",
      "This account is not an administrator.",
    );
  return email;
}
