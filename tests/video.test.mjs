import assert from "node:assert/strict";
import test from "node:test";
import express from "express";
import {
  createVideoFrameTask,
  createVideoTask,
  queryTask,
} from "../server/video.mjs";
import { createVideoHandlers, createVideoRouter } from "../server/video-api.mjs";
import { createHandler as createVercelFrameHandler } from "../api/generate-video-frame.js";

const apiKey = "evolink-unit-test-key";
const publicDns = async () => [{ address: "8.8.8.8", family: 4 }];
const drink = {
  name: "多肉葡萄",
  category: "果茶",
  summary: "葡萄果肉与清爽茶底",
  layers: ["葡萄果肉", "绿妍茶汤", "芝士云顶"],
};

const taskPayload = (overrides = {}) => ({
  id: "task-unified-test-123",
  object: "image.generation.task",
  type: "image",
  status: "pending",
  progress: 0,
  ...overrides,
});

const jsonResponse = (payload, status = 200) => new Response(JSON.stringify(payload), {
  status,
  headers: { "Content-Type": "application/json" },
});

test("two-stage flow fixes outpaint and HappyHorse parameters", async () => {
  const calls = [];
  const responses = [
    taskPayload(),
    taskPayload({ status: "completed", progress: 100, results: ["https://cdn.example.com/frame.png"] }),
    taskPayload({
      id: "task-unified-video-456",
      object: "video.generation.task",
      type: "video",
    }),
  ];
  const fetchImpl = async (url, options) => {
    calls.push({ url, ...options, body: options.body ? JSON.parse(options.body) : undefined });
    return jsonResponse(responses.shift());
  };

  const frameTask = await createVideoFrameTask({
    imageUrl: "https://images.example.com/drink.png",
    drink,
    moodNote: "今天终于完成了一个重要项目，很轻松。",
  }, apiKey, { fetchImpl, lookupImpl: publicDns });
  assert.deepEqual(frameTask, {
    taskId: "task-unified-test-123",
    taskType: "image",
    stage: "frame",
    status: "pending",
    progress: 0,
    resultUrl: null,
  });

  const completedFrame = await queryTask(frameTask.taskId, "image", apiKey, { fetchImpl });
  assert.equal(completedFrame.resultUrl, "https://cdn.example.com/frame.png");

  const videoTask = await createVideoTask({
    frameUrl: completedFrame.resultUrl,
    drink,
    moodNote: "今天终于完成了一个重要项目，很轻松。",
  }, apiKey, { fetchImpl, lookupImpl: publicDns });
  assert.equal(videoTask.stage, "video");

  assert.equal(calls[0].url, "https://api.evolink.ai/v1/images/generations");
  assert.equal(calls[0].headers.Authorization, `Bearer ${apiKey}`);
  assert.deepEqual(Object.keys(calls[0].body).sort(), ["image_urls", "model", "prompt", "resolution", "size"]);
  assert.equal(calls[0].body.model, "gpt-image-2-beta");
  assert.deepEqual(calls[0].body.image_urls, ["https://images.example.com/drink.png"]);
  assert.equal(calls[0].body.size, "16:9");
  assert.equal(calls[0].body.resolution, "1K");
  assert.match(calls[0].body.prompt, /outpaint/i);
  assert.match(calls[0].body.prompt, /untrusted reference data/i);

  assert.equal(calls[1].url, "https://api.evolink.ai/v1/tasks/task-unified-test-123");
  assert.equal(calls[1].method, "GET");

  assert.equal(calls[2].url, "https://api.evolink.ai/v1/videos/generations");
  assert.deepEqual(Object.keys(calls[2].body).sort(), ["duration", "image_urls", "model", "prompt", "quality"]);
  assert.deepEqual(calls[2].body, {
    model: "happyhorse-1.1-image-to-video",
    prompt: calls[2].body.prompt,
    image_urls: ["https://cdn.example.com/frame.png"],
    quality: "720p",
    duration: 5,
  });
  assert.equal("aspect_ratio" in calls[2].body, false);
  assert.match(calls[2].body.prompt, /five-second miniature beverage advertisement/i);
  assert.match(calls[2].body.prompt, /very slow camera push-in/i);
  assert.match(calls[2].body.prompt, /no people or faces/i);
  assert.match(calls[2].body.prompt, /no watermark/i);
  assert.match(calls[2].body.prompt, /今天终于完成了一个重要项目/);
});

test("query normalizes processing, failed, and cancelled states without provider detail", async () => {
  const payloads = [
    taskPayload({ status: "processing", progress: 37.6 }),
    taskPayload({ status: "failed", progress: 61, error: { message: `secret ${apiKey}` } }),
    taskPayload({ status: "cancelled", progress: 20 }),
  ];
  const fetchImpl = async () => jsonResponse(payloads.shift());

  const processing = await queryTask("task-processing-1", "image", apiKey, { fetchImpl });
  assert.equal(processing.status, "processing");
  assert.equal(processing.progress, 38);
  const failed = await queryTask("task-failed-123", "image", apiKey, { fetchImpl });
  assert.deepEqual(failed.error, { code: "generation_failed", message: "生成失败，请调整内容后重试" });
  assert.doesNotMatch(JSON.stringify(failed), new RegExp(apiKey));
  const cancelled = await queryTask("task-cancelled-1", "image", apiKey, { fetchImpl });
  assert.equal(cancelled.error.code, "generation_cancelled");
});

test("provider timeout aborts promptly and is reported as a gateway timeout", async () => {
  let signal;
  const fetchImpl = async (_url, options) => {
    signal = options.signal;
    return new Promise(() => {});
  };
  await assert.rejects(
    queryTask("task-timeout-123", "video", apiKey, { fetchImpl, timeoutMs: 5 }),
    (error) => error.statusCode === 504 && error.code === "provider_timeout",
  );
  assert.equal(signal.aborted, true);
});

test("task type mismatch and completed task without result are rejected", async () => {
  await assert.rejects(
    queryTask("task-wrong-type", "video", apiKey, {
      fetchImpl: async () => jsonResponse(taskPayload()),
    }),
    (error) => error.statusCode === 502 && error.code === "task_type_mismatch",
  );
  await assert.rejects(
    queryTask("task-no-result", "image", apiKey, {
      fetchImpl: async () => jsonResponse(taskPayload({ status: "completed", progress: 100 })),
    }),
    (error) => error.statusCode === 502 && error.code === "missing_task_result",
  );
});

test("strict validation blocks SSRF, arbitrary model fields, and overlong mood text", async () => {
  const neverFetch = async () => assert.fail("provider must not be called");
  await assert.rejects(
    createVideoFrameTask({ imageUrl: "http://127.0.0.1/drink.png", drink, moodNote: "ok" }, apiKey, { fetchImpl: neverFetch }),
    (error) => error.statusCode === 400,
  );
  await assert.rejects(
    createVideoFrameTask({ imageUrl: "https://[::1]/drink.png", drink, moodNote: "ok" }, apiKey, { fetchImpl: neverFetch }),
    (error) => error.statusCode === 400,
  );
  await assert.rejects(
    createVideoTask({
      frameUrl: "https://images.example.com/frame.png",
      drink,
      moodNote: "ok",
      model: "expensive-model",
    }, apiKey, { fetchImpl: neverFetch, lookupImpl: publicDns }),
    (error) => error.statusCode === 400,
  );
  await assert.rejects(
    createVideoTask({
      frameUrl: "https://images.example.com/frame.png",
      drink,
      moodNote: "心".repeat(121),
    }, apiKey, { fetchImpl: neverFetch, lookupImpl: publicDns }),
    (error) => error.statusCode === 400,
  );
});

const mockResponse = () => ({
  statusCode: 200,
  headers: {},
  payload: undefined,
  setHeader(name, value) { this.headers[name] = value; },
  status(code) { this.statusCode = code; return this; },
  json(payload) { this.payload = payload; return this; },
});

test("API auth injection binds polling token to server principal and ignores client identity", async () => {
  const authGuard = async (request) => request.serverPrincipal;
  const fetchImpl = async (_url, options) => options.method === "POST"
    ? jsonResponse(taskPayload())
    : jsonResponse(taskPayload({ status: "processing", progress: 45 }));
  const handlers = createVideoHandlers({
    authGuard,
    apiKey,
    signingSecret: "task-signing-test-secret",
    clientOptions: { fetchImpl, lookupImpl: publicDns },
    now: () => 1_800_000_000_000,
  });

  const createResponse = mockResponse();
  await handlers.createFrame({
    serverPrincipal: { id: "verified-user-a" },
    body: { imageUrl: "https://images.example.com/drink.png", drink, moodNote: "期待", userId: "attacker" },
  }, createResponse);
  assert.equal(createResponse.statusCode, 400);
  assert.equal(createResponse.payload.code, "invalid_request");

  const validCreateResponse = mockResponse();
  await handlers.createFrame({
    serverPrincipal: { id: "verified-user-a" },
    body: { imageUrl: "https://images.example.com/drink.png", drink, moodNote: "期待" },
  }, validCreateResponse);
  assert.equal(validCreateResponse.statusCode, 202);
  assert.ok(validCreateResponse.payload.pollToken);

  const forbiddenResponse = mockResponse();
  await handlers.getTask({
    serverPrincipal: { id: "verified-user-b" },
    query: {
      taskId: validCreateResponse.payload.taskId,
      taskType: "image",
      pollToken: validCreateResponse.payload.pollToken,
    },
  }, forbiddenResponse);
  assert.equal(forbiddenResponse.statusCode, 403);
  assert.equal(forbiddenResponse.payload.code, "invalid_task_token");

  const pollResponse = mockResponse();
  await handlers.getTask({
    serverPrincipal: { id: "verified-user-a" },
    query: {
      taskId: validCreateResponse.payload.taskId,
      taskType: "image",
      pollToken: validCreateResponse.payload.pollToken,
    },
  }, pollResponse);
  assert.equal(pollResponse.statusCode, 200);
  assert.equal(pollResponse.payload.status, "processing");
  assert.equal(pollResponse.payload.progress, 45);
});

test("Express and Vercel adapters expose the guarded frame endpoint", async (context) => {
  const dependencies = {
    authGuard: async () => ({ id: "verified-adapter-user" }),
    apiKey,
    signingSecret: "adapter-signing-test-secret",
    clientOptions: {
      lookupImpl: publicDns,
      fetchImpl: async () => jsonResponse(taskPayload()),
    },
  };
  const app = express();
  app.use(express.json());
  app.use("/api", createVideoRouter(dependencies));
  const listener = await new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });
  context.after(() => new Promise((resolve, reject) => listener.close((error) => error ? reject(error) : resolve())));

  const address = listener.address();
  const expressResponse = await fetch(`http://127.0.0.1:${address.port}/api/generate-video-frame`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      imageUrl: "https://images.example.com/drink.png",
      drink,
      moodNote: "平静",
    }),
  });
  assert.equal(expressResponse.status, 202);
  assert.equal((await expressResponse.json()).taskType, "image");

  const vercelResponse = mockResponse();
  await createVercelFrameHandler(dependencies)({ method: "GET" }, vercelResponse);
  assert.equal(vercelResponse.statusCode, 405);
  assert.equal(vercelResponse.headers.Allow, "POST");
});
