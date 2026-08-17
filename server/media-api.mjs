import { generateDrinkImage, queryDrinkImage } from "./drink-image.mjs";

const RATE_POLICIES = Object.freeze({
  generate: { windowMs: 10 * 60_000, perUser: 8, perIp: 16 },
  query: { windowMs: 10 * 60_000, perUser: 120, perIp: 240 },
});

export class MediaApiError extends Error {
  constructor(message, { statusCode = 500, code = "media_api_error", retryAfter } = {}) {
    super(message);
    this.name = "MediaApiError";
    this.statusCode = statusCode;
    this.code = code;
    if (retryAfter) this.retryAfter = retryAfter;
  }
}

const readHeader = (request, name) => {
  if (typeof request.get === "function") return request.get(name);
  const target = name.toLowerCase();
  const entry = Object.entries(request.headers || {}).find(([key]) => key.toLowerCase() === target);
  return Array.isArray(entry?.[1]) ? entry[1][0] : entry?.[1];
};

const requestIp = (request) => {
  const direct = typeof request.ip === "string" ? request.ip.trim() : "";
  if (direct) return direct.slice(0, 100);
  const forwarded = String(readHeader(request, "x-forwarded-for") || "").split(",")[0].trim();
  return (forwarded || request.socket?.remoteAddress || "unknown").slice(0, 100);
};

const normalizedUserId = (identity) => {
  const value = identity?.userId || identity?.user?.id;
  if (typeof value !== "string" || !value.trim() || value.length > 200) {
    throw new MediaApiError("登录状态无效，请重新登录。", {
      statusCode: 401,
      code: "invalid_authentication",
    });
  }
  return value.trim();
};

// Integration seam for a verified server-side session. Deliberately never reads
// body.userId, query.userId, or any other client-asserted identity.
export const authenticateFromServerContext = async (request) => {
  const identity = request.auth;
  if (!identity) {
    throw new MediaApiError("图片生成接口尚未接入服务端登录校验。", {
      statusCode: 503,
      code: "authentication_not_configured",
    });
  }
  return identity;
};

export const createMemoryRateLimiter = ({ now = () => Date.now() } = {}) => {
  const buckets = new Map();

  const consumeBucket = (key, limit, windowMs, timestamp) => {
    const recent = (buckets.get(key) || []).filter((time) => timestamp - time < windowMs);
    if (recent.length >= limit) {
      const retryAfter = Math.max(1, Math.ceil((recent[0] + windowMs - timestamp) / 1_000));
      throw new MediaApiError("图片服务请求有点频繁，请稍后再试。", {
        statusCode: 429,
        code: "rate_limit_exceeded",
        retryAfter: String(retryAfter),
      });
    }
    return recent;
  };

  return {
    consume({ action, userId, ip }) {
      const policy = RATE_POLICIES[action];
      if (!policy) throw new Error(`Unknown media rate-limit action: ${action}`);
      const timestamp = now();
      const userKey = `${action}:user:${userId}`;
      const ipKey = `${action}:ip:${ip}`;
      const userRecent = consumeBucket(userKey, policy.perUser, policy.windowMs, timestamp);
      const ipRecent = consumeBucket(ipKey, policy.perIp, policy.windowMs, timestamp);
      buckets.set(userKey, [...userRecent, timestamp]);
      buckets.set(ipKey, [...ipRecent, timestamp]);
    },
  };
};

const setNoStore = (response) => {
  response.setHeader("Cache-Control", "no-store, max-age=0");
  response.setHeader("Pragma", "no-cache");
};

const sendError = (response, error, fallbackMessage) => {
  const known = Number.isInteger(error?.statusCode);
  const statusCode = known ? error.statusCode : 502;
  if (error?.retryAfter) response.setHeader("Retry-After", error.retryAfter);
  if (!known) {
    console.error("Media API failed", { name: error?.name || "Error" });
  } else if (statusCode >= 500) {
    console.error("Media API dependency failed", {
      code: error.code || "unknown",
      statusCode,
    });
  }
  return response.status(statusCode).json({
    error: known ? error.message : fallbackMessage,
    code: known ? (error.code || "media_api_error") : "media_api_error",
  });
};

const authenticate = async (request, authenticateRequest) => {
  const identity = await authenticateRequest(request);
  return normalizedUserId(identity);
};

export const createGenerateDrinkImageHandler = ({
  authenticateRequest = authenticateFromServerContext,
  rateLimiter = createMemoryRateLimiter(),
  apiKey = process.env.EVOLINK_API_KEY,
  fetchImpl = globalThis.fetch,
} = {}) => async (request, response) => {
  setNoStore(response);
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "只支持 POST 请求", code: "method_not_allowed" });
  }

  try {
    const userId = await authenticate(request, authenticateRequest);
    await rateLimiter.consume({ action: "generate", userId, ip: requestIp(request) });
    const task = await generateDrinkImage(request.body, apiKey, { fetchImpl });
    return response.status(202).json(task);
  } catch (error) {
    return sendError(response, error, "图片任务暂时创建不了，请稍后再试。");
  }
};

export const createMediaTaskHandler = ({
  authenticateRequest = authenticateFromServerContext,
  rateLimiter = createMemoryRateLimiter(),
  apiKey = process.env.EVOLINK_API_KEY,
  fetchImpl = globalThis.fetch,
} = {}) => async (request, response) => {
  setNoStore(response);
  if (request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "只支持 GET 请求", code: "method_not_allowed" });
  }

  try {
    const userId = await authenticate(request, authenticateRequest);
    await rateLimiter.consume({ action: "query", userId, ip: requestIp(request) });
    const taskId = Array.isArray(request.query?.taskId) ? "" : request.query?.taskId;
    const task = await queryDrinkImage(taskId, apiKey, { fetchImpl });
    return response.status(200).json(task);
  } catch (error) {
    return sendError(response, error, "图片任务状态暂时查不到，请稍后再试。");
  }
};
