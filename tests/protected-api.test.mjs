import assert from "node:assert/strict";
import test from "node:test";
import customDrinkHandler from "../api/create-custom-drink.js";
import imageHandler from "../api/generate-drink-image.js";
import frameHandler from "../api/generate-video-frame.js";
import videoHandler from "../api/generate-drink-video.js";
import mediaTaskHandler from "../api/media-task.js";
import speechHandler from "../api/speech.js";
import videoTaskHandler from "../api/video-task.js";
import creationsHandler from "../api/creations.js";
import importCreationHandler from "../api/import-creation.js";
import suggestIngredientsHandler from "../api/suggest-custom-ingredients.js";

const createResponse = () => ({
  statusCode: 200,
  headers: {},
  payload: undefined,
  headersSent: false,
  setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
  status(value) { this.statusCode = value; return this; },
  json(value) { this.payload = value; this.headersSent = true; return this; },
});

const protectedEntries = [
  ["custom drink", customDrinkHandler, { method: "POST", body: {} }],
  ["image generation", imageHandler, { method: "POST", body: {} }],
  ["image polling", mediaTaskHandler, { method: "GET", query: {} }],
  ["speech", speechHandler, { method: "POST", body: {} }],
  ["video frame", frameHandler, { method: "POST", body: {} }],
  ["video generation", videoHandler, { method: "POST", body: {} }],
  ["video polling", videoTaskHandler, { method: "GET", query: {} }],
  ["creation library", creationsHandler, { method: "GET", query: {} }],
  ["creation import", importCreationHandler, { method: "POST", body: {} }],
  ["mood ingredient suggestion", suggestIngredientsHandler, { method: "POST", body: {} }],
];

for (const [name, handler, request] of protectedEntries) {
  test(`Vercel ${name} entry rejects unauthenticated requests`, async () => {
    const response = createResponse();
    await handler({ ...request, headers: {} }, response);
    assert.equal(response.statusCode, 401);
    assert.equal(response.payload.code, "AUTH_REQUIRED");
    assert.match(response.payload.error, /登录/);
    assert.match(response.headers["cache-control"], /no-store/);
  });
}
