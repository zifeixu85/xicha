import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import express from "express";
import { requireAuthenticatedUser } from "./auth.mjs";
import { ensureCreationOwner, persistCreationMedia } from "./creation-store.mjs";
import { isPublicDemoMode, sendPublicDemoMediaDisabled } from "./public-demo.mjs";
import {
  VideoServiceError,
  createVideoFrameTask,
  createVideoTask,
  queryTask,
} from "./video.mjs";

const POLL_TOKEN_TTL_MS = 24 * 60 * 60_000;

export const defaultVideoAuthGuard = async (request, response) => {
  const auth = await requireAuthenticatedUser(request, response);
  return auth?.user || null;
};

const principalIdOf = (principal) => {
  const value = typeof principal === "string"
    ? principal
    : principal?.userId || principal?.id || principal?.sub;
  if (typeof value !== "string" || !value.trim() || value.length > 200) {
    throw new VideoServiceError("请先登录后再生成宣传片", 401, "authentication_required");
  }
  return value.trim();
};

const subjectDigest = (principalId) => createHash("sha256").update(principalId).digest("base64url");

const taskToken = ({ taskId, taskType, principalId, creationId, expiresAt }, secret) => {
  if (!secret) throw new VideoServiceError("服务端尚未配置视频任务签名密钥", 503, "service_not_configured");
  const payload = Buffer.from(JSON.stringify({
    taskId,
    taskType,
    subject: subjectDigest(principalId),
    creationId: creationId || null,
    expiresAt,
  })).toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
};

const verifyTaskToken = ({ token, taskId, taskType, principalId, now }, secret) => {
  if (!secret) throw new VideoServiceError("服务端尚未配置视频任务签名密钥", 503, "service_not_configured");
  if (typeof token !== "string" || token.length > 1_024) return null;
  const [payloadPart, signaturePart, extra] = String(token || "").split(".");
  if (!payloadPart || !signaturePart || extra) return null;

  const expected = createHmac("sha256", secret).update(payloadPart).digest();
  let provided;
  let payload;
  try {
    provided = Buffer.from(signaturePart, "base64url");
    payload = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return null;
  const valid = payload.taskId === taskId
    && payload.taskType === taskType
    && payload.subject === subjectDigest(principalId)
    && Number.isFinite(payload.expiresAt)
    && payload.expiresAt >= now
    && payload.expiresAt <= now + POLL_TOKEN_TTL_MS + 5_000;
  return valid ? payload : null;
};

const sendError = (response, error) => {
  if (response.headersSent) return undefined;
  const known = error instanceof VideoServiceError;
  return response.status(known ? error.statusCode : 502).json({
    error: known ? error.message : "视频服务暂时不可用，请稍后重试",
    code: known ? error.code : "video_service_error",
  });
};

export const createVideoHandlers = ({
  authGuard = defaultVideoAuthGuard,
  apiKey = process.env.EVOLINK_API_KEY,
  signingSecret = process.env.VIDEO_TASK_SIGNING_SECRET || apiKey,
  clientOptions = {},
  now = Date.now,
  demoMode = isPublicDemoMode,
} = {}) => {
  const authenticate = async (request, response) => {
    const principal = await authGuard(request, response);
    return principal ? principalIdOf(principal) : null;
  };

  const create = (operation) => async (request, response) => {
    response.setHeader("Cache-Control", "no-store, max-age=0");
    response.setHeader("Pragma", "no-cache");
    if (demoMode()) return sendPublicDemoMediaDisabled(response);
    try {
      const principalId = await authenticate(request, response);
      if (!principalId) return undefined;
      const { creationId, ...operationInput } = request.body || {};
      if (creationId) await ensureCreationOwner(creationId, principalId);
      const result = operation === "frame"
        ? await createVideoFrameTask(operationInput, apiKey, clientOptions)
        : await createVideoTask(operationInput, apiKey, clientOptions);
      const pollToken = taskToken({
        taskId: result.taskId,
        taskType: result.taskType,
        principalId,
        creationId,
        expiresAt: now() + POLL_TOKEN_TTL_MS,
      }, signingSecret);
      return response.status(202).json({ ...result, pollToken, pollAfterMs: 2_500 });
    } catch (error) {
      return sendError(response, error);
    }
  };

  const getTask = async (request, response) => {
    response.setHeader("Cache-Control", "no-store, max-age=0");
    response.setHeader("Pragma", "no-cache");
    if (demoMode()) return sendPublicDemoMediaDisabled(response);
    try {
      const principalId = await authenticate(request, response);
      if (!principalId) return undefined;
      const taskId = request.query?.taskId;
      const taskType = request.query?.taskType;
      const pollToken = request.query?.pollToken;
      const taskAccess = verifyTaskToken({ token: pollToken, taskId, taskType, principalId, now: now() }, signingSecret);
      if (!taskAccess) {
        throw new VideoServiceError("任务查询凭证无效或已过期", 403, "invalid_task_token");
      }
      const result = await queryTask(taskId, taskType, apiKey, clientOptions);
      if (result.status === "completed" && result.taskType === "video" && result.resultUrl && taskAccess.creationId) {
        const stored = await persistCreationMedia({
          ownerId: principalId,
          creationId: taskAccess.creationId,
          kind: "video",
          sourceUrl: result.resultUrl,
          sourceProvider: "evolink",
        });
        result.resultUrl = stored.url;
        result.expiresAt = stored.expiresAt;
      }
      const pollAfterMs = result.status === "processing"
        ? 2_500
        : result.status === "pending"
          ? 4_000
          : null;
      return response.status(200).json({ ...result, pollAfterMs });
    } catch (error) {
      return sendError(response, error);
    }
  };

  return {
    createFrame: create("frame"),
    createVideo: create("video"),
    getTask,
  };
};

export const createVideoRouter = (dependencies = {}) => {
  const router = express.Router();
  const handlers = createVideoHandlers(dependencies);
  router.post("/generate-video-frame", handlers.createFrame);
  router.post("/generate-drink-video", handlers.createVideo);
  router.get("/video-task", handlers.getTask);
  return router;
};

export const createVercelVideoHandler = (operation, dependencies = {}) => {
  const handlers = createVideoHandlers(dependencies);
  const method = operation === "getTask" ? "GET" : "POST";
  const handler = operation === "createFrame"
    ? handlers.createFrame
    : operation === "createVideo"
      ? handlers.createVideo
      : handlers.getTask;

  return async (request, response) => {
    response.setHeader("Cache-Control", "no-store, max-age=0");
    response.setHeader("Pragma", "no-cache");
    if (request.method !== method) {
      response.setHeader("Allow", method);
      return response.status(405).json({ error: `只支持 ${method} 请求`, code: "method_not_allowed" });
    }
    return handler(request, response);
  };
};
