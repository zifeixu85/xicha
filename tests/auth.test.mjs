import assert from "node:assert/strict";
import test from "node:test";
import {
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  SignJWT,
} from "jose";
import { authenticateRequest } from "../server/auth.mjs";
import speechHandler from "../api/speech.js";

const AUTH_URL = "https://project.neonauth.example/neondb/auth";
const NOW = new Date("2026-08-17T08:00:00.000Z");

const createNeonAuthMock = async () => {
  const primary = await generateKeyPair("ES256");
  const forged = await generateKeyPair("ES256");
  const publicJwk = await exportJWK(primary.publicKey);
  const keySet = createLocalJWKSet({
    keys: [{ ...publicJwk, alg: "ES256", kid: "neon-test-key", use: "sig" }],
  });

  const sign = ({
    privateKey = primary.privateKey,
    subject = "user-from-neon",
    expiresAt = Math.floor(NOW.getTime() / 1_000) + 900,
    claims = {},
  } = {}) => new SignJWT({ email: "signed@example.test", role: "authenticated", ...claims })
    .setProtectedHeader({ alg: "ES256", kid: "neon-test-key" })
    .setIssuer(AUTH_URL)
    .setAudience(AUTH_URL)
    .setSubject(subject)
    .setIssuedAt(Math.floor(NOW.getTime() / 1_000))
    .setExpirationTime(expiresAt)
    .sign(privateKey);

  return { keySet, sign, forgedPrivateKey: forged.privateKey };
};

test("auth accepts a valid Neon JWT and only trusts its verified subject", async () => {
  const neon = await createNeonAuthMock();
  const token = await neon.sign();
  const auth = await authenticateRequest({
    headers: { authorization: `Bearer ${token}` },
    body: { userId: "client-spoof", email: "client-spoof@example.test" },
  }, { authUrl: AUTH_URL, keySet: neon.keySet, now: NOW });

  assert.equal(auth.user.id, "user-from-neon");
  assert.equal(auth.user.email, undefined);
  assert.equal(auth.claims, undefined);
});

test("auth rejects a missing bearer token", async () => {
  await assert.rejects(
    authenticateRequest({ headers: {} }, { authUrl: AUTH_URL }),
    (error) => error.statusCode === 401 && error.code === "AUTH_REQUIRED",
  );
});

test("auth rejects a forged Neon JWT", async () => {
  const neon = await createNeonAuthMock();
  const token = await neon.sign({ privateKey: neon.forgedPrivateKey });
  await assert.rejects(
    authenticateRequest({ headers: { authorization: `Bearer ${token}` } }, {
      authUrl: AUTH_URL,
      keySet: neon.keySet,
      now: NOW,
    }),
    (error) => error.statusCode === 401 && error.code === "AUTH_REQUIRED",
  );
});

test("auth rejects an expired Neon JWT", async () => {
  const neon = await createNeonAuthMock();
  const token = await neon.sign({ expiresAt: Math.floor(NOW.getTime() / 1_000) - 1 });
  await assert.rejects(
    authenticateRequest({ headers: { authorization: `Bearer ${token}` } }, {
      authUrl: AUTH_URL,
      keySet: neon.keySet,
      now: NOW,
    }),
    (error) => error.statusCode === 401 && error.code === "AUTH_REQUIRED",
  );
});

test("auth rejects Neon anonymous tokens even when their signature is valid", async () => {
  const neon = await createNeonAuthMock();
  for (const claims of [{ role: "anonymous" }, { role: "authenticated", isAnonymous: true }]) {
    const token = await neon.sign({ subject: "temporary-user", claims });
    await assert.rejects(
      authenticateRequest({ headers: { authorization: `Bearer ${token}` } }, {
        authUrl: AUTH_URL,
        keySet: neon.keySet,
        now: NOW,
      }),
      (error) => error.statusCode === 401 && error.code === "AUTH_REQUIRED",
    );
  }
});

test("auth reports JWKS failures as unavailable", async () => {
  const neon = await createNeonAuthMock();
  const token = await neon.sign();
  await assert.rejects(
    authenticateRequest({ headers: { authorization: `Bearer ${token}` } }, {
      authUrl: AUTH_URL,
      keySet: async () => { throw new Error("mock Neon Auth is offline"); },
      now: NOW,
    }),
    (error) => error.statusCode === 503 && error.code === "AUTH_UNAVAILABLE",
  );
});

test("speech handler rejects unauthenticated requests before generation", async () => {
  const headers = new Map();
  const response = {
    statusCode: 200,
    payload: null,
    setHeader(name, value) { headers.set(name, value); },
    status(statusCode) { this.statusCode = statusCode; return this; },
    json(payload) { this.payload = payload; return this; },
  };

  await speechHandler({
    method: "POST",
    headers: {},
    body: { text: "任意文本", token: "ticket" },
  }, response);

  assert.equal(response.statusCode, 401);
  assert.equal(response.payload.code, "AUTH_REQUIRED");
  assert.equal(headers.get("WWW-Authenticate"), "Bearer");
});
