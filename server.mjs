import "dotenv/config";
import express from "express";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { generateBlessing } from "./server/blessing.mjs";

const app = express();
const port = Number(process.env.PORT) || 5173;
const root = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === "production";
const requestWindows = new Map();

app.disable("x-powered-by");
app.use(express.json({ limit: "16kb" }));

app.post("/api/blessing", async (request, response) => {
  const now = Date.now();
  const client = request.ip || "local";
  const recentRequests = (requestWindows.get(client) || []).filter((time) => now - time < 10 * 60_000);
  if (recentRequests.length >= 30) {
    return response.status(429).json({ error: "摇签有点频繁，歇一会儿再来吧。" });
  }
  requestWindows.set(client, [...recentRequests, now]);

  try {
    const result = await generateBlessing(request.body, process.env.DEEPSEEK_API_KEY);
    response.setHeader("Cache-Control", "no-store");
    return response.json(result);
  } catch (error) {
    console.error("Blessing API failed", error);
    return response.status(error.statusCode || 502).json({
      error: error.statusCode ? error.message : "AI 签语暂时没有摇出来，请稍后再试。",
    });
  }
});

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
