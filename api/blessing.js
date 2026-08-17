import { generateBlessing } from "../server/blessing.mjs";
import { createSpeechToken } from "../server/speech.mjs";

export const config = { maxDuration: 30 };

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "只支持 POST 请求" });
  }

  try {
    const result = await generateBlessing(request.body, process.env.DEEPSEEK_API_KEY);
    response.setHeader("Cache-Control", "no-store");
    return response.status(200).json({
      ...result,
      speechToken: createSpeechToken(result.blessing, process.env.MINIMAX_API_KEY),
    });
  } catch (error) {
    console.error("Blessing API failed", error);
    return response.status(error.statusCode || 502).json({
      error: error.statusCode ? error.message : "AI 签语暂时没有摇出来，请稍后再试。",
    });
  }
}
