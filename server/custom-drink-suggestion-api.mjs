import { requireAuthenticatedUser } from "./auth.mjs";
import { suggestCustomIngredients } from "./custom-drink-suggestion.mjs";

const requestWindows = new Map();

export const createCustomIngredientSuggestionHandler = ({
  authenticate = requireAuthenticatedUser,
  suggest = suggestCustomIngredients,
  apiKey = process.env.DEEPSEEK_API_KEY,
} = {}) => async (request, response) => {
  response.setHeader("Cache-Control", "no-store, max-age=0");
  if (request.method && request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "只支持 POST 请求", code: "method_not_allowed" });
  }
  const auth = await authenticate(request, response);
  if (!auth) return undefined;
  try {
    const principalId = auth?.user?.id || auth?.userId;
    const now = Date.now();
    const recent = (requestWindows.get(principalId) || []).filter((time) => now - time < 10 * 60_000);
    if (recent.length >= 20) {
      const error = new Error("心情搭配有点频繁，歇一会儿再试吧。");
      error.statusCode = 429;
      error.code = "RATE_LIMITED";
      throw error;
    }
    requestWindows.set(principalId, [...recent, now]);
    return response.status(200).json(await suggest(request.body, apiKey));
  } catch (error) {
    const known = Number.isInteger(error?.statusCode);
    if (!known || error.statusCode >= 500) console.error("Ingredient suggestion failed", { code: error?.code || "unknown" });
    return response.status(known ? error.statusCode : 502).json({
      error: known ? error.message : "AI 暂时没有配好这一杯，请稍后再试。",
      code: known ? (error.code || "SUGGESTION_FAILED") : "SUGGESTION_FAILED",
    });
  }
};
