import "dotenv/config";
import express from "express";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { generateBlessing, generateMoodRecommendation } from "./server/blessing.mjs";
import { createSpeechToken, generateSpeech } from "./server/speech.mjs";
import { requireAuthenticatedUser } from "./server/auth.mjs";
import {
  createGenerateDrinkImageHandler,
  createMediaTaskHandler,
  createMemoryRateLimiter,
} from "./server/media-api.mjs";
import { createVideoRouter } from "./server/video-api.mjs";
import { createCustomDrinkHandler, createImportCreationHandler, createListCreationsHandler } from "./server/creation-api.mjs";
import { persistCreationMedia } from "./server/creation-store.mjs";
import { createCustomIngredientSuggestionHandler } from "./server/custom-drink-suggestion-api.mjs";
import { isPublicDemoMode, sendPublicDemoMediaDisabled } from "./server/public-demo.mjs";

const app = express();
const port = Number(process.env.PORT) || 5173;
const root = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === "production";
const requestWindows = new Map();
const speechWindows = new Map();
const mediaRateLimiter = createMemoryRateLimiter();

app.disable("x-powered-by");
app.use(express.json({ limit: "16kb" }));
app.use("/api", createVideoRouter());

app.post("/api/blessing", async (request, response) => {
  response.setHeader("Cache-Control", "no-store, max-age=0");
  const now = Date.now();
  const client = request.ip || "local";
  const recentRequests = (requestWindows.get(client) || []).filter((time) => now - time < 10 * 60_000);
  if (recentRequests.length >= 30) {
    return response.status(429).json({ error: "摇签有点频繁，歇一会儿再来吧。", code: "RATE_LIMITED" });
  }
  requestWindows.set(client, [...recentRequests, now]);

  try {
    const result = await generateBlessing(request.body, process.env.DEEPSEEK_API_KEY);
    return response.json({
      ...result,
      speechToken: createSpeechToken(result.blessing, process.env.MINIMAX_API_KEY),
    });
  } catch (error) {
    console.error("Blessing API failed", error);
    return response.status(error.statusCode || 502).json({
      error: error.statusCode ? error.message : "AI 签语暂时没有摇出来，请稍后再试。",
      code: error.statusCode === 400 ? "INVALID_REQUEST" : "BLESSING_FAILED",
    });
  }
});

app.post("/api/recommendation", async (request, response) => {
  response.setHeader("Cache-Control", "no-store");
  const now = Date.now();
  const client = request.ip || "local";
  const recentRequests = (requestWindows.get(client) || []).filter((time) => now - time < 10 * 60_000);
  if (recentRequests.length >= 30) {
    return response.status(429).json({ error: "推荐有点频繁，歇一会儿再来吧。" });
  }
  requestWindows.set(client, [...recentRequests, now]);

  try {
    const result = await generateMoodRecommendation(request.body, process.env.DEEPSEEK_API_KEY);
    return response.json({
      ...result,
      speechToken: createSpeechToken(result.blessing, process.env.MINIMAX_API_KEY),
    });
  } catch (error) {
    console.error("Recommendation API failed", error);
    return response.status(error.statusCode || 502).json({
      error: error.statusCode ? error.message : "AI 暂时没挑出合适的一杯，请稍后再试。",
    });
  }
});

app.post("/api/speech", async (request, response) => {
  response.setHeader("Cache-Control", "no-store, max-age=0");
  if (isPublicDemoMode()) return sendPublicDemoMediaDisabled(response);
  const auth = await requireAuthenticatedUser(request, response);
  if (!auth) return;

  const now = Date.now();
  const client = request.ip || "local";
  const recentRequests = (speechWindows.get(client) || []).filter((time) => now - time < 10 * 60_000);
  if (recentRequests.length >= 20) {
    return response.status(429).json({ error: "语音播放有点频繁，歇一会儿再试吧。", code: "RATE_LIMITED" });
  }
  speechWindows.set(client, [...recentRequests, now]);

  try {
    const result = await generateSpeech(request.body, process.env.MINIMAX_API_KEY);
    if (request.body?.creationId) {
      const stored = await persistCreationMedia({
        ownerId: auth.user.id,
        creationId: request.body.creationId,
        kind: "audio",
        sourceUrl: result.audio,
        sourceProvider: "minimax",
      });
      result.audio = stored.url;
      result.expiresAt = stored.expiresAt;
    }
    return response.json(result);
  } catch (error) {
    console.error("Speech API failed", error);
    return response.status(error.statusCode || 502).json({
      error: error.statusCode ? error.message : "签语语音暂时生成不了，请稍后再试。",
      code: error.statusCode === 400 ? "INVALID_REQUEST" : error.statusCode === 403 ? "INVALID_SPEECH_TICKET" : "SPEECH_FAILED",
    });
  }
});

app.post("/api/generate-drink-image", createGenerateDrinkImageHandler({ rateLimiter: mediaRateLimiter }));
app.get("/api/media-task", createMediaTaskHandler({ rateLimiter: mediaRateLimiter }));

app.post("/api/create-custom-drink", createCustomDrinkHandler());
app.post("/api/suggest-custom-ingredients", createCustomIngredientSuggestionHandler());
app.get("/api/creations", createListCreationsHandler());
app.post("/api/import-creation", createImportCreationHandler());

if (isProduction) {
  app.use(express.static(path.join(root, "dist")));
  app.use((_request, response) => response.sendFile(path.join(root, "dist", "index.html")));
} else {
  const { createServer } = await import("vite");
  const vite = await createServer({ server: { middlewareMode: true }, appType: "spa" });
  app.use(vite.middlewares);
}

app.listen(port, () => {
  console.log(`喜点什么已启动：http://localhost:${port}`);
});
