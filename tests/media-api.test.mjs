import assert from "node:assert/strict";
import test from "node:test";
import {
  createGenerateDrinkImageHandler,
  createMediaTaskHandler,
  createMemoryRateLimiter,
} from "../server/media-api.mjs";

const jsonResponse = (payload, status = 200) => new Response(JSON.stringify(payload), {
  status,
  headers: { "Content-Type": "application/json" },
});

const taskPayload = (overrides = {}) => ({
  id: "task-unified-1800000000-handler",
  model: "gpt-image-2-beta",
  object: "image.generation.task",
  progress: 0,
  status: "pending",
  type: "image",
  ...overrides,
});

const createResponse = () => {
  const headers = new Map();
  return {
    statusCode: 200,
    body: undefined,
    headers,
    setHeader(name, value) {
      headers.set(name.toLowerCase(), value);
    },
    status(value) {
      this.statusCode = value;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
  };
};

test("generate handler uses injected auth and rejects a forged client userId", async () => {
  let authenticatedRequest;
  let rateIdentity;
  const handler = createGenerateDrinkImageHandler({
    apiKey: "key",
    authenticateRequest: async (request) => {
      authenticatedRequest = request;
      return { userId: "verified-user" };
    },
    rateLimiter: { consume(value) { rateIdentity = value; } },
    fetchImpl: async () => jsonResponse(taskPayload()),
  });
  const request = {
    method: "POST",
    ip: "203.0.113.8",
    body: {
      name: "莓莓云朵",
      ingredients: ["草莓", "椰奶"],
      userId: "forged-client-user",
    },
  };
  const response = createResponse();
  await handler(request, response);

  assert.equal(authenticatedRequest, request);
  assert.equal(response.statusCode, 400);
  assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
  assert.deepEqual(rateIdentity, {
    action: "generate",
    userId: "verified-user",
    ip: "203.0.113.8",
  });
  assert.equal(response.body.code, "invalid_drink_input");
});

test("generate handler succeeds with structured input and never needs a client userId", async () => {
  const handler = createGenerateDrinkImageHandler({
    apiKey: "key",
    authenticateRequest: async () => ({ user: { id: "verified-user" } }),
    fetchImpl: async () => jsonResponse(taskPayload()),
  });
  const response = createResponse();
  await handler({
    method: "POST",
    headers: { "x-forwarded-for": "198.51.100.10, 10.0.0.1" },
    body: { name: "莓莓云朵", ingredients: ["草莓", "椰奶"] },
  }, response);

  assert.equal(response.statusCode, 202);
  assert.equal(response.body.taskId, "task-unified-1800000000-handler");
});

test("media task handler supports injected auth and returns completed URLs", async () => {
  const signingSecret = "media-task-test-secret";
  const createHandler = createGenerateDrinkImageHandler({
    apiKey: "key",
    signingSecret,
    authenticateRequest: async () => ({ userId: "verified-user" }),
    fetchImpl: async () => jsonResponse(taskPayload()),
  });
  const createResult = createResponse();
  await createHandler({
    method: "POST",
    ip: "203.0.113.9",
    body: { name: "莓莓云朵", ingredients: ["草莓", "椰奶"] },
  }, createResult);

  const handler = createMediaTaskHandler({
    apiKey: "key",
    signingSecret,
    authenticateRequest: async () => ({ userId: "verified-user" }),
    fetchImpl: async () => jsonResponse(taskPayload({
      status: "completed",
      progress: 100,
      results: ["https://cdn.example.test/drink.png"],
    })),
  });
  const response = createResponse();
  await handler({
    method: "GET",
    ip: "203.0.113.9",
    query: {
      taskId: "task-unified-1800000000-handler",
      pollToken: createResult.body.pollToken,
    },
  }, response);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body.results, ["https://cdn.example.test/drink.png"]);
  assert.equal(response.headers.get("cache-control"), "no-store, max-age=0");
});

test("secure default auth rejects requests without a Neon bearer token", async () => {
  const handler = createGenerateDrinkImageHandler({
    apiKey: "key",
    fetchImpl: async () => assert.fail("provider must not be called"),
  });
  const response = createResponse();
  await handler({
    method: "POST",
    body: { name: "茶", ingredients: ["茶"] },
  }, response);
  assert.equal(response.statusCode, 401);
  assert.equal(response.body.code, "AUTH_REQUIRED");
});

test("media polling credential is bound to the verified user", async () => {
  const signingSecret = "media-user-binding-secret";
  const createHandler = createGenerateDrinkImageHandler({
    apiKey: "key",
    signingSecret,
    authenticateRequest: async () => ({ userId: "verified-user-a" }),
    fetchImpl: async () => jsonResponse(taskPayload()),
  });
  const created = createResponse();
  await createHandler({
    method: "POST",
    body: { name: "莓莓云朵", ingredients: ["草莓", "椰奶"] },
  }, created);

  const queryHandler = createMediaTaskHandler({
    apiKey: "key",
    signingSecret,
    authenticateRequest: async () => ({ userId: "verified-user-b" }),
    fetchImpl: async () => assert.fail("provider must not be queried across users"),
  });
  const forbidden = createResponse();
  await queryHandler({
    method: "GET",
    query: { taskId: created.body.taskId, pollToken: created.body.pollToken },
  }, forbidden);

  assert.equal(forbidden.statusCode, 403);
  assert.equal(forbidden.body.code, "invalid_task_token");
});

test("memory limiter enforces both authenticated-user and IP generation budgets", () => {
  const limiter = createMemoryRateLimiter({ now: () => 1_800_000_000_000 });
  for (let index = 0; index < 8; index += 1) {
    limiter.consume({ action: "generate", userId: "same-user", ip: `203.0.113.${index}` });
  }
  assert.throws(
    () => limiter.consume({ action: "generate", userId: "same-user", ip: "203.0.113.99" }),
    (error) => error.statusCode === 429 && error.retryAfter === "600",
  );

  const ipLimiter = createMemoryRateLimiter({ now: () => 1_800_000_000_000 });
  for (let index = 0; index < 16; index += 1) {
    ipLimiter.consume({ action: "generate", userId: `user-${index}`, ip: "198.51.100.1" });
  }
  assert.throws(
    () => ipLimiter.consume({ action: "generate", userId: "another-user", ip: "198.51.100.1" }),
    (error) => error.statusCode === 429,
  );
});
