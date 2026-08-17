import { generateSpeech } from "../server/speech.mjs";

export const config = { maxDuration: 30 };

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "只支持 POST 请求" });
  }

  try {
    const result = await generateSpeech(request.body, process.env.MINIMAX_API_KEY);
    return response.status(200).json(result);
  } catch (error) {
    console.error("Speech API failed", error);
    return response.status(error.statusCode || 502).json({
      error: error.statusCode ? error.message : "签语语音暂时生成不了，请稍后再试。",
    });
  }
}
