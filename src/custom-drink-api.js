import { authFetch } from "./auth-fetch.js";

const requestJson = async (url, { method = "GET", body, signal } = {}, getSession) => {
  const response = await authFetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal,
  }, { getSession });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || `请求失败（${response.status}）`);
    error.code = payload.code;
    error.statusCode = response.status;
    throw error;
  }
  return payload;
};

export const createCustomDrink = (body, getSession, signal) => requestJson("/api/create-custom-drink", {
  method: "POST", body, signal,
}, getSession);

export const suggestCustomIngredients = (moodNote, getSession, signal) => requestJson("/api/suggest-custom-ingredients", {
  method: "POST", body: { moodNote }, signal,
}, getSession);

export const createDrinkImageTask = ({ drink, moodNote, creationId }, getSession, signal) => requestJson("/api/generate-drink-image", {
  method: "POST",
  body: {
    name: drink.name,
    ingredients: drink.receipt || drink.ingredients || [],
    moodNote: moodNote || "",
    colorFlavor: [drink.summary, ...(drink.tags || [])].filter(Boolean).join("；"),
    creationId,
  },
  signal,
}, getSession);

export const getMediaTask = ({ taskId, pollToken }, getSession, signal) => {
  const query = new URLSearchParams({ taskId, pollToken });
  return requestJson(`/api/media-task?${query}`, { signal }, getSession);
};

export const createVideoFrameTask = (body, getSession, signal) => requestJson("/api/generate-video-frame", {
  method: "POST", body, signal,
}, getSession);

export const createDrinkVideoTask = (body, getSession, signal) => requestJson("/api/generate-drink-video", {
  method: "POST", body, signal,
}, getSession);

export const getVideoTask = ({ taskId, taskType, pollToken }, getSession, signal) => {
  const query = new URLSearchParams({ taskId, taskType, pollToken });
  return requestJson(`/api/video-task?${query}`, { signal }, getSession);
};

export const createCustomSpeech = (body, getSession, signal) => requestJson("/api/speech", {
  method: "POST", body, signal,
}, getSession);

export const fetchCreations = (getSession, signal) => requestJson("/api/creations", { signal }, getSession);

const abortableDelay = (milliseconds, signal) => new Promise((resolve, reject) => {
  const finish = () => {
    signal?.removeEventListener("abort", abort);
    resolve();
  };
  const timer = globalThis.setTimeout(finish, milliseconds);
  const abort = () => {
    globalThis.clearTimeout(timer);
    reject(new DOMException("Aborted", "AbortError"));
  };
  if (signal?.aborted) abort();
  else signal?.addEventListener("abort", abort, { once: true });
});

const waitForTask = async (startedTask, getTask, getSession, signal, onProgress) => {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    const payload = await getTask(startedTask, getSession, signal);
    const status = payload.status || payload.state;
    onProgress?.(Math.max(4, Math.min(98, Number(payload.progress) || 8 + attempt * 3)));
    if (["completed", "succeeded", "ready"].includes(status)) return payload;
    if (["failed", "error", "cancelled"].includes(status)) {
      throw new Error(payload.error?.message || payload.error || "作品生成失败，请重试");
    }
    await abortableDelay(Number(payload.pollAfterMs) || Number(startedTask.pollAfterMs) || 850, signal);
  }
  throw new Error("生成等待超时，请稍后重试");
};

export const waitForMediaTask = (startedTask, getSession, signal, onProgress) => waitForTask(
  startedTask,
  getMediaTask,
  getSession,
  signal,
  onProgress,
);

export const waitForVideoTask = (startedTask, getSession, signal, onProgress) => waitForTask(
  startedTask,
  getVideoTask,
  getSession,
  signal,
  onProgress,
);
