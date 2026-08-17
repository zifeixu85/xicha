import { generateMoodRecommendation } from "../server/blessing.mjs";
import { createSpeechToken } from "../server/speech.mjs";

export const config = { maxDuration: 30 };

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "只支持 POST 请求" });
  }

  try {
    const result = await generateMoodRecommendation(request.body, process.env.DEEPSEEK_API_KEY);
    return response.status(200).json({
      ...result,
      speechToken: createSpeechToken(result.blessing, process.env.MINIMAX_API_KEY),
    });
  } catch (error) {
    console.error("Recommendation API failed", error);
    return response.status(error.statusCode || 502).json({
      error: error.statusCode ? error.message : "AI 暂时没挑出合适的一杯，请稍后再试。",
    });
  }
}
