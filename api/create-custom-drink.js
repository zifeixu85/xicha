import { generateCustomDrink } from "../server/custom-drink.mjs";
import { createSpeechToken } from "../server/speech.mjs";

export const config = { maxDuration: 30 };

export default async function handler(request, response) {
  response.setHeader("Cache-Control", "no-store");
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "只支持 POST 请求" });
  }
  try {
    const result = await generateCustomDrink(request.body, process.env.DEEPSEEK_API_KEY);
    return response.status(200).json({
      ...result,
      speechTicket: createSpeechToken(result.blessing, process.env.MINIMAX_API_KEY),
    });
  } catch (error) {
    console.error("Custom drink API failed", error);
    return response.status(error.statusCode || 502).json({
      error: error.statusCode ? error.message : "自创饮品签笺暂时没有写完，请稍后再试。",
    });
  }
}
