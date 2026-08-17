const DEFAULT_BASE_URL = "https://api.evolink.ai/v1";
const DEFAULT_TIMEOUT_MS = 25_000;
const IMAGE_MODEL = "gpt-image-2-beta";
const MAX_PROMPT_LENGTH = 2_000;
const IMAGE_TASK_OBJECT = "image.generation.task";
const TASK_ID_PATTERN = /^task-unified-[A-Za-z0-9_-]{8,180}$/;
const TASK_STATUSES = new Set(["pending", "processing", "completed", "failed", "cancelled"]);

const publicErrors = {
  400: [400, "图片生成请求不符合服务要求，请检查饮品信息。", "invalid_request"],
  401: [503, "图片生成服务认证暂不可用，请联系管理员。", "provider_authentication"],
  402: [503, "图片生成服务额度暂不可用，请联系管理员。", "provider_quota"],
  403: [503, "图片生成模型暂不可用，请联系管理员。", "provider_permission"],
  404: [404, "没有找到这个图片任务，请重新生成。", "task_not_found"],
  429: [429, "图片生成服务正忙，请稍后再试。", "provider_rate_limit"],
};

export class EvolinkError extends Error {
  constructor(message, { statusCode = 502, code = "provider_error", retryAfter } = {}) {
    super(message);
    this.name = "EvolinkError";
    this.statusCode = statusCode;
    this.code = code;
    if (retryAfter) this.retryAfter = retryAfter;
  }
}

const configurationError = (message) => new EvolinkError(message, {
  statusCode: 503,
  code: "provider_not_configured",
});

export const assertEvolinkTaskId = (value) => {
  const taskId = typeof value === "string" ? value.trim() : "";
  if (!TASK_ID_PATTERN.test(taskId)) {
    throw new EvolinkError("图片任务编号无效。", {
      statusCode: 400,
      code: "invalid_task_id",
    });
  }
  return taskId;
};

const normalizeProgress = (value) => {
  const progress = Number(value);
  if (!Number.isFinite(progress) || progress < 0 || progress > 100) {
    throw new EvolinkError("图片生成服务返回了无效的任务进度。", { code: "invalid_provider_response" });
  }
  return Math.round(progress);
};

const normalizeResults = (results, status) => {
  if (results == null && status !== "completed") return [];
  if (!Array.isArray(results) || results.length > 1 || (status === "completed" && results.length !== 1)) {
    throw new EvolinkError("图片生成服务返回了无效的结果。", { code: "invalid_provider_response" });
  }

  return results.map((value) => {
    let url;
    try {
      url = new URL(value);
    } catch {
      throw new EvolinkError("图片生成服务返回了无效的结果地址。", { code: "invalid_provider_response" });
    }
    if (url.protocol !== "https:") {
      throw new EvolinkError("图片生成服务返回了不安全的结果地址。", { code: "invalid_provider_response" });
    }
    return url.toString();
  });
};

const normalizeTask = (payload, expectedTaskId) => {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new EvolinkError("图片生成服务返回了无效响应。", { code: "invalid_provider_response" });
  }
  if (payload.object !== IMAGE_TASK_OBJECT || payload.type !== "image") {
    throw new EvolinkError("图片生成服务返回了非图片任务。", { code: "unexpected_task_type" });
  }
  if (payload.model && payload.model !== IMAGE_MODEL) {
    throw new EvolinkError("图片生成服务返回了非预期模型任务。", { code: "unexpected_task_model" });
  }

  let taskId;
  try {
    taskId = assertEvolinkTaskId(payload.id);
  } catch {
    throw new EvolinkError("图片生成服务返回了无效的任务编号。", { code: "invalid_provider_response" });
  }
  if (expectedTaskId && taskId !== expectedTaskId) {
    throw new EvolinkError("图片生成服务返回了不匹配的任务。", { code: "unexpected_task_id" });
  }
  if (!TASK_STATUSES.has(payload.status)) {
    throw new EvolinkError("图片生成服务返回了未知任务状态。", { code: "invalid_provider_response" });
  }

  const status = payload.status === "cancelled" ? "failed" : payload.status;
  const task = {
    taskId,
    status,
    progress: normalizeProgress(payload.progress),
    results: normalizeResults(payload.results, status),
  };
  if (status === "failed") {
    task.error = payload?.error?.code === "content_policy_violation"
      ? "图片内容未通过安全审核，请调整饮品描述后重试。"
      : "图片生成失败，请调整饮品描述后重试。";
  }
  return task;
};

const normalizeHttpError = (response) => {
  const [statusCode, message, code] = publicErrors[response.status]
    || [502, "图片生成服务暂时不可用，请稍后再试。", "provider_error"];
  const retryAfter = response.headers.get("retry-after") || undefined;
  return new EvolinkError(message, { statusCode, code, retryAfter });
};

const requestEvolink = async ({
  path,
  method,
  body,
  apiKey,
  fetchImpl,
  baseUrl,
  timeoutMs,
}) => {
  if (typeof apiKey !== "string" || !apiKey.trim()) {
    throw configurationError("服务端尚未配置 EVOLINK_API_KEY。");
  }
  if (typeof fetchImpl !== "function") {
    throw configurationError("图片生成服务请求器不可用。");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let response;
    try {
      response = await fetchImpl(`${baseUrl}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
        signal: controller.signal,
      });
    } catch (error) {
      if (controller.signal.aborted || error?.name === "AbortError") {
        throw new EvolinkError("图片生成服务响应超时，请稍后再试。", {
          statusCode: 504,
          code: "provider_timeout",
        });
      }
      throw new EvolinkError("暂时无法连接图片生成服务，请稍后再试。", {
        statusCode: 502,
        code: "provider_unreachable",
      });
    }

    if (!response.ok) {
      // Discard the body without ever exposing provider details to callers or logs.
      await response.body?.cancel().catch(() => undefined);
      throw normalizeHttpError(response);
    }

    const payload = await response.json().catch(() => {
      throw new EvolinkError("图片生成服务返回了无法解析的响应。", { code: "invalid_provider_response" });
    });
    return payload;
  } finally {
    clearTimeout(timeout);
  }
};

export const createImageTask = async ({ prompt }, apiKey, {
  fetchImpl = globalThis.fetch,
  baseUrl = DEFAULT_BASE_URL,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) => {
  if (typeof prompt !== "string" || !prompt.trim() || Array.from(prompt).length > MAX_PROMPT_LENGTH) {
    throw new EvolinkError("服务端生成的图片描述无效。", {
      statusCode: 500,
      code: "invalid_server_prompt",
    });
  }

  const payload = await requestEvolink({
    path: "/images/generations",
    method: "POST",
    body: {
      model: IMAGE_MODEL,
      prompt,
      size: "1:1",
      resolution: "1K",
      n: 1,
    },
    apiKey,
    fetchImpl,
    baseUrl,
    timeoutMs,
  });
  return normalizeTask(payload);
};

export const getImageTask = async (taskIdValue, apiKey, {
  fetchImpl = globalThis.fetch,
  baseUrl = DEFAULT_BASE_URL,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) => {
  const taskId = assertEvolinkTaskId(taskIdValue);
  const payload = await requestEvolink({
    path: `/tasks/${encodeURIComponent(taskId)}`,
    method: "GET",
    apiKey,
    fetchImpl,
    baseUrl,
    timeoutMs,
  });
  return normalizeTask(payload, taskId);
};

export const EVOLINK_IMAGE_MODEL = IMAGE_MODEL;
