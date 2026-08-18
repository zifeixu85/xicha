import assert from "node:assert/strict";
import test from "node:test";
import {
  createCustomDrink,
  createDrinkImageTask,
  getMediaTask,
  getVideoTask,
  suggestCustomIngredients,
} from "../src/custom-drink-api.js";

test("custom media adapter refreshes JWT per request and matches backend fields", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  let sessionReads = 0;
  globalThis.fetch = async (url, init) => {
    requests.push({ url: String(url), init, body: init.body ? JSON.parse(init.body) : undefined });
    return new Response(JSON.stringify({ status: "pending" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  const getSession = async () => ({
    data: { session: { token: `fresh-token-${++sessionReads}` } },
  });

  try {
    await createCustomDrink({ ingredients: { groups: {} }, note: "期待" }, getSession);
    await suggestCustomIngredients("今天很开心", getSession);
    await createDrinkImageTask({
      drink: {
        name: "晚风青提",
        summary: "青提和桂花的清爽层次",
        tags: ["青提", "花香"],
        receipt: ["绿妍茶底", "青提鲜果"],
      },
      moodNote: "庆祝小胜利",
    }, getSession);
    await getMediaTask({ taskId: "image-task-1", pollToken: "image-token" }, getSession);
    await getVideoTask({ taskId: "video-task-1", taskType: "video", pollToken: "video-token" }, getSession);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(sessionReads, 5);
  assert.deepEqual(requests.map((request) => request.init.headers.get("Authorization")), [
    "Bearer fresh-token-1",
    "Bearer fresh-token-2",
    "Bearer fresh-token-3",
    "Bearer fresh-token-4",
    "Bearer fresh-token-5",
  ]);
  assert.deepEqual(requests[1].body, { moodNote: "今天很开心" });
  assert.deepEqual(requests[2].body, {
    name: "晚风青提",
    ingredients: ["绿妍茶底", "青提鲜果"],
    moodNote: "庆祝小胜利",
    colorFlavor: "青提和桂花的清爽层次；青提；花香",
  });
  assert.match(requests[3].url, /\/api\/media-task\?taskId=image-task-1&pollToken=image-token$/);
  assert.match(requests[4].url, /\/api\/video-task\?taskId=video-task-1&taskType=video&pollToken=video-token$/);
});
