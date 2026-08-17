const jsonHeaders = (token) => ({
  "Content-Type": "application/json",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

const requestJson = async (url, { method = "GET", body, token, signal } = {}) => {
  const response = await fetch(url, {
    method,
    headers: jsonHeaders(token),
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `请求失败（${response.status}）`);
  return payload;
};

export const createCustomDrink = (body, token, signal) => requestJson("/api/create-custom-drink", {
  method: "POST", body, token, signal,
});

export const createDrinkImageTask = (body, token, signal) => requestJson("/api/generate-drink-image", {
  method: "POST", body, token, signal,
});

export const getMediaTask = (taskId, token, signal) => requestJson(`/api/media-task?taskId=${encodeURIComponent(taskId)}`, {
  token, signal,
});

export const createVideoFrameTask = (body, token, signal) => requestJson("/api/generate-video-frame", {
  method: "POST", body, token, signal,
});

export const createDrinkVideoTask = (body, token, signal) => requestJson("/api/generate-drink-video", {
  method: "POST", body, token, signal,
});

export const createCustomSpeech = (body, token, signal) => requestJson("/api/speech", {
  method: "POST", body, token, signal,
});

export const waitForMediaTask = async (taskId, token, signal, onProgress) => {
  for (let attempt = 0; attempt < 90; attempt += 1) {
    const payload = await getMediaTask(taskId, token, signal);
    const status = payload.status || payload.state;
    onProgress?.(Math.max(4, Math.min(98, Number(payload.progress) || 8 + attempt * 3)));
    if (["completed", "succeeded", "ready"].includes(status)) return payload;
    if (["failed", "error", "cancelled"].includes(status)) throw new Error(payload.error || "作品生成失败，请重试");
    await new Promise((resolve, reject) => {
      const finish = () => {
        signal?.removeEventListener("abort", abort);
        resolve();
      };
      const timer = window.setTimeout(finish, 850);
      const abort = () => {
        window.clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      };
      if (signal?.aborted) abort();
      else signal?.addEventListener("abort", abort, { once: true });
    });
  }
  throw new Error("生成等待超时，请稍后重试");
};
