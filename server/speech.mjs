import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const MINIMAX_ENDPOINT = "https://api.minimaxi.com/v1/t2a_v2";
const MAX_SPEECH_LENGTH = 120;
const TOKEN_TTL_MS = 15 * 60_000;

const normalizeSpeechText = (value) => String(value || "").replace(/\s+/g, " ").trim();
const textDigest = (text) => createHash("sha256").update(text).digest("base64url");

export const createSpeechToken = (text, secret, now = Date.now()) => {
  const normalized = normalizeSpeechText(text);
  if (!normalized || !secret) return "";
  const payload = `${now + TOKEN_TTL_MS}.${textDigest(normalized)}`;
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");
  return `${payload}.${signature}`;
};

const verifySpeechToken = (text, token, secret, now = Date.now()) => {
  const parts = String(token || "").split(".");
  if (parts.length !== 3) return false;
  const [expiresRaw, digest, signature] = parts;
  const expires = Number(expiresRaw);
  if (!Number.isFinite(expires) || expires < now || expires > now + TOKEN_TTL_MS + 5_000) return false;
  if (digest !== textDigest(text)) return false;

  const expected = createHmac("sha256", secret)
    .update(`${expiresRaw}.${digest}`)
    .digest();
  let provided;
  try {
    provided = Buffer.from(signature, "base64url");
  } catch {
    return false;
  }
  return provided.length === expected.length && timingSafeEqual(provided, expected);
};

export const generateSpeech = async (body, apiKey, { fetchImpl = fetch, now = Date.now() } = {}) => {
  if (!apiKey) {
    const error = new Error("服务端尚未配置 MINIMAX_API_KEY");
    error.statusCode = 503;
    throw error;
  }

  const text = normalizeSpeechText(body?.text);
  if (!text) {
    const error = new Error("缺少要播放的签语");
    error.statusCode = 400;
    throw error;
  }
  if (Array.from(text).length > MAX_SPEECH_LENGTH) {
    const error = new Error(`签语不能超过 ${MAX_SPEECH_LENGTH} 个字符`);
    error.statusCode = 400;
    throw error;
  }
  if (!verifySpeechToken(text, body?.token, apiKey, now)) {
    const error = new Error("签语已变化或播放凭证已过期，请重新摇一杯");
    error.statusCode = 403;
    throw error;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetchImpl(MINIMAX_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "speech-2.8-hd",
        text,
        stream: false,
        voice_setting: {
          voice_id: "Chinese_wenrounvxing",
          speed: 1,
          vol: 1,
          pitch: 0,
          emotion: "calm",
        },
        audio_setting: {
          sample_rate: 32000,
          bitrate: 128000,
          format: "mp3",
          channel: 1,
        },
        output_format: "url",
        subtitle_enable: false,
      }),
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    const statusCode = payload?.base_resp?.status_code;
    if (!response.ok || (statusCode != null && statusCode !== 0)) {
      const detail = payload?.base_resp?.status_msg || payload?.message || `MiniMax returned ${response.status}`;
      throw new Error(detail);
    }

    const audio = payload?.data?.audio;
    let audioUrl;
    try {
      audioUrl = new URL(audio);
    } catch {
      throw new Error("MiniMax 没有返回有效的音频地址");
    }
    if (audioUrl.protocol !== "https:") throw new Error("MiniMax 返回了不安全的音频地址");
    return { audio: audioUrl.toString() };
  } finally {
    clearTimeout(timeout);
  }
};
