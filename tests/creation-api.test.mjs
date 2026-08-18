import assert from "node:assert/strict";
import test from "node:test";
import { createCustomDrinkHandler } from "../server/creation-api.mjs";
import { mediaObjectKey } from "../server/r2-storage.mjs";

const responseOf = () => ({
  statusCode: 200,
  body: null,
  headers: {},
  setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
  status(value) { this.statusCode = value; return this; },
  json(value) { this.body = value; return this; },
});

test("custom creation is saved under the verified account and returns its creation id", async () => {
  let saved;
  const handler = createCustomDrinkHandler({
    authenticate: async () => ({ user: { id: "verified-owner" } }),
    generate: async () => ({
      drink: { name: "晚霞杯", summary: "清爽", tags: [], receipt: ["茶"], sweetness: "微甜", temperature: "少冰" },
      blessing: "愿今天温柔收尾。",
      model: "test-model",
    }),
    saveCreation: async (value) => {
      saved = value;
      return { id: "2c480cc5-4c18-4ffb-84fb-d18d12193485", created_at: "2026-08-17T12:00:00Z" };
    },
    minimaxKey: "test-secret",
  });
  const response = responseOf();
  await handler({ method: "POST", body: { note: "开心", userId: "forged-owner" } }, response);

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.creationId, "2c480cc5-4c18-4ffb-84fb-d18d12193485");
  assert.equal(saved.ownerId, "verified-owner");
  assert.equal(saved.moodNote, "开心");
  assert.match(response.headers["cache-control"], /no-store/);
});

test("R2 media keys isolate accounts without exposing raw account ids", () => {
  const creationId = "2c480cc5-4c18-4ffb-84fb-d18d12193485";
  const first = mediaObjectKey({ ownerId: "user@example.com", creationId, kind: "video" });
  const second = mediaObjectKey({ ownerId: "other@example.com", creationId, kind: "video" });
  assert.match(first, /^users\/[A-Za-z0-9_-]{32}\/creations\/[0-9a-f-]+\/video\.mp4$/);
  assert.notEqual(first, second);
  assert.doesNotMatch(first, /user@example\.com/);
});
