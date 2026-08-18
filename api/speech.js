import { generateSpeech } from "../server/speech.mjs";
import { requireAuthenticatedUser } from "../server/auth.mjs";
import { persistCreationMedia } from "../server/creation-store.mjs";

export const config = { maxDuration: 120 };

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store, max-age=0");
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "只支持 POST 请求" });
  }

  const auth = await requireAuthenticatedUser(request, response);
  if (!auth) return;

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
    return response.status(200).json(result);
  } catch (error) {
    console.error("Speech API failed", error);
    return response.status(error.statusCode || 502).json({
      error: error.statusCode ? error.message : "签语语音暂时生成不了，请稍后再试。",
      code: error.statusCode === 400 ? "INVALID_REQUEST" : error.statusCode === 403 ? "INVALID_SPEECH_TICKET" : "SPEECH_FAILED",
    });
  }
}
