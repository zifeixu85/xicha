import assert from "node:assert/strict";
import test from "node:test";
import { createGenerateDrinkImageHandler } from "../server/media-api.mjs";
import { createVideoHandlers } from "../server/video-api.mjs";
import { isPublicDemoMode } from "../server/public-demo.mjs";

const responseStub = () => ({
  statusCode: 200,
  body: undefined,
  headers: {},
  setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

test("public demo mode defaults on for production and Vercel but stays off in local development", () => {
  assert.equal(isPublicDemoMode({ NODE_ENV: "production" }), true);
  assert.equal(isPublicDemoMode({ VERCEL: "1" }), true);
  assert.equal(isPublicDemoMode({ NODE_ENV: "development" }), false);
  assert.equal(isPublicDemoMode({ NODE_ENV: "production", PUBLIC_DEMO_MODE: "false" }), false);
  assert.equal(isPublicDemoMode({ NODE_ENV: "development", VITE_PUBLIC_DEMO_MODE: "true" }), true);
});

test("public demo blocks image generation before authentication or provider calls", async () => {
  const handler = createGenerateDrinkImageHandler({
    demoMode: () => true,
    authenticateRequest: async () => assert.fail("authentication should not run for a disabled feature"),
    fetchImpl: async () => assert.fail("provider should not be called"),
  });
  const response = responseStub();
  await handler({ method: "POST", body: {} }, response);
  assert.equal(response.statusCode, 403);
  assert.equal(response.body.code, "PUBLIC_DEMO_MEDIA_DISABLED");
});

test("public demo blocks video generation before authentication or provider calls", async () => {
  const handlers = createVideoHandlers({
    demoMode: () => true,
    authGuard: async () => assert.fail("authentication should not run for a disabled feature"),
    clientOptions: { fetchImpl: async () => assert.fail("provider should not be called") },
  });
  const response = responseStub();
  await handlers.createVideo({ body: {} }, response);
  assert.equal(response.statusCode, 403);
  assert.equal(response.body.code, "PUBLIC_DEMO_MEDIA_DISABLED");
});
