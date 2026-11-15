import { beforeAll, describe, expect, it } from "vitest";
import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  SignJWT,
  type JWTVerifyGetKey,
} from "jose";
import { requireAdmin } from "./auth";
import type { Env } from "./env";
let keys: Awaited<ReturnType<typeof generateKeyPair>>,
  resolveKey: JWTVerifyGetKey;
const env = {
  ENVIRONMENT: "production",
  ACCESS_TEAM_DOMAIN: "test-team.cloudflareaccess.com",
  ACCESS_AUD: "test-audience",
  ADMIN_EMAILS: "admin@example.com",
} as Env;
beforeAll(async () => {
  keys = await generateKeyPair("RS256");
  resolveKey = createLocalJWKSet({
    keys: [
      { ...(await exportJWK(keys.publicKey)), kid: "test-key", alg: "RS256" },
    ],
  });
});
async function assertion(
  email = "admin@example.com",
  audience = "test-audience",
  issuer = "https://test-team.cloudflareaccess.com",
  expired = false,
) {
  return new SignJWT({ email })
    .setProtectedHeader({ alg: "RS256", kid: "test-key" })
    .setIssuer(issuer)
    .setAudience(audience)
    .setSubject("test-admin")
    .setIssuedAt()
    .setExpirationTime(expired ? "0s" : "5m")
    .sign(keys.privateKey);
}
const request = (token: string) =>
  new Request("https://campus.example/api/v1/admin/events", {
    headers: { "Cf-Access-Jwt-Assertion": token },
  });
describe("Cloudflare Access authorization", () => {
  it("verifies signed RS256 JWTs and requires an allowlisted identity", async () => {
    expect(
      await requireAdmin(request(await assertion()), env, resolveKey),
    ).toBe("admin@example.com");
    await expect(
      requireAdmin(
        request(await assertion("student@example.com")),
        env,
        resolveKey,
      ),
    ).rejects.toMatchObject({ status: 403 });
  });
  it("rejects wrong issuer, audience, expiry, unsigned input, and forged signatures", async () => {
    for (const token of [
      await assertion("admin@example.com", "wrong"),
      await assertion(
        "admin@example.com",
        "test-audience",
        "https://evil.example",
      ),
      await assertion(
        "admin@example.com",
        "test-audience",
        "https://test-team.cloudflareaccess.com",
        true,
      ),
      "admin@example.com",
      `${await assertion()}forged`,
    ])
      await expect(
        requireAdmin(request(token), env, resolveKey),
      ).rejects.toMatchObject({ status: 401 });
  });
  it("fails closed when Access or the administrator allowlist is missing", async () => {
    const token = await assertion();
    await expect(
      requireAdmin(request(token), { ...env, ADMIN_EMAILS: "" }, resolveKey),
    ).rejects.toMatchObject({ status: 401 });
    await expect(
      requireAdmin(request(token), { ...env, ACCESS_AUD: "" }, resolveKey),
    ).rejects.toMatchObject({ status: 401 });
  });
});
