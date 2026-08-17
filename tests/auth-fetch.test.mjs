import assert from "node:assert/strict";
import test from "node:test";
import {
  authFetch,
  AuthRequiredError,
  CrossOriginAuthError,
} from "../src/auth-fetch.js";

test("auth fetch attaches the latest in-memory session token and keeps other headers", async () => {
  let captured;
  const response = await authFetch("/api/image", {
    method: "POST",
    headers: {
      Authorization: "Bearer caller-supplied-value",
      "Content-Type": "application/json",
    },
    body: "{}",
  }, {
    session: { session: { token: "stale-token" } },
    getSession: async () => ({ data: { session: { token: "fresh-neon-token" } } }),
    fetchImpl: async (input, init) => {
      captured = { input, init };
      return new Response(null, { status: 204 });
    },
  });

  assert.equal(response.status, 204);
  assert.equal(captured.input, "/api/image");
  assert.equal(captured.init.headers.get("Authorization"), "Bearer fresh-neon-token");
  assert.equal(captured.init.headers.get("Content-Type"), "application/json");
});

test("auth fetch never forwards a session token cross-origin", async () => {
  await assert.rejects(
    authFetch("https://evil.example/api/video", {}, {
      origin: "https://app.example",
      session: { session: { token: "must-not-leak" } },
      fetchImpl: async () => assert.fail("fetch should not be called"),
    }),
    (error) => error instanceof CrossOriginAuthError && error.code === "AUTH_CROSS_ORIGIN",
  );
});

test("auth fetch preserves Request headers while applying explicit overrides", async () => {
  let capturedHeaders;
  const request = new Request("https://app.example/api/image", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-From-Request": "yes" },
    body: "{}",
  });

  await authFetch(request, {
    headers: { "X-From-Init": "yes" },
  }, {
    origin: "https://app.example",
    session: { session: { token: "fresh-neon-token" } },
    fetchImpl: async (_input, init) => {
      capturedHeaders = init.headers;
      return new Response(null, { status: 204 });
    },
  });

  assert.equal(capturedHeaders.get("Content-Type"), "application/json");
  assert.equal(capturedHeaders.get("X-From-Request"), "yes");
  assert.equal(capturedHeaders.get("X-From-Init"), "yes");
  assert.equal(capturedHeaders.get("Authorization"), "Bearer fresh-neon-token");
});

test("auth fetch refuses to call protected APIs without a current session token", async () => {
  await assert.rejects(
    authFetch("/api/video", {}, {
      getSession: async () => ({ data: null }),
      fetchImpl: async () => assert.fail("fetch should not be called"),
    }),
    (error) => error instanceof AuthRequiredError && error.code === "AUTH_REQUIRED",
  );
});
