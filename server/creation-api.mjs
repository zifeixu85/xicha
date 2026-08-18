import { createSpeechToken } from "./speech.mjs";
import { generateCustomDrink } from "./custom-drink.mjs";
import { requireAuthenticatedUser } from "./auth.mjs";
import { createDrinkCreation, importDrinkCreation, listDrinkCreations } from "./creation-store.mjs";

const clean = (value, max = 160) => Array.from(String(value || "").replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim()).slice(0, max).join("");

const ownerOf = (auth) => auth?.user?.id || auth?.userId;
const setNoStore = (response) => response.setHeader("Cache-Control", "no-store, max-age=0");
const sendError = (response, error, fallback, fallbackCode) => {
  const known = Number.isInteger(error?.statusCode);
  if (!known || error.statusCode >= 500) console.error("Creation API failed", { code: error?.code || "unknown" });
  return response.status(known ? error.statusCode : 502).json({
    error: known ? error.message : fallback,
    code: known ? (error.code || "creation_error") : fallbackCode,
  });
};

export const createCustomDrinkHandler = ({
  authenticate = requireAuthenticatedUser,
  generate = generateCustomDrink,
  saveCreation = createDrinkCreation,
  deepseekKey = process.env.DEEPSEEK_API_KEY,
  minimaxKey = process.env.MINIMAX_API_KEY,
} = {}) => async (request, response) => {
  setNoStore(response);
  if (request.method && request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "只支持 POST 请求", code: "method_not_allowed" });
  }
  const auth = await authenticate(request, response);
  if (!auth) return undefined;
  try {
    const result = await generate(request.body, deepseekKey);
    const saved = await saveCreation({
      ownerId: ownerOf(auth),
      drink: result.drink,
      blessing: result.blessing,
      moodNote: request.body?.note || "",
    });
    return response.status(200).json({
      ...result,
      creationId: saved.id,
      createdAt: saved.created_at,
      speechTicket: createSpeechToken(result.blessing, minimaxKey),
    });
  } catch (error) {
    return sendError(response, error, "自创饮品签笺暂时没有写完，请稍后再试。", "CUSTOM_DRINK_FAILED");
  }
};

export const createListCreationsHandler = ({ authenticate = requireAuthenticatedUser } = {}) => async (request, response) => {
  setNoStore(response);
  if (request.method && request.method !== "GET") {
    response.setHeader("Allow", "GET");
    return response.status(405).json({ error: "只支持 GET 请求", code: "method_not_allowed" });
  }
  const auth = await authenticate(request, response);
  if (!auth) return undefined;
  try {
    return response.status(200).json({ creations: await listDrinkCreations(ownerOf(auth)) });
  } catch (error) {
    return sendError(response, error, "作品集暂时读取不了，请稍后再试。", "CREATIONS_FAILED");
  }
};

const normalizeImport = (body) => {
  const drink = body?.drink;
  if (!drink || typeof drink !== "object" || Array.isArray(drink)) {
    const error = new Error("手动作品信息不完整");
    error.statusCode = 400;
    error.code = "invalid_import";
    throw error;
  }
  const receipt = Array.isArray(drink.receipt) ? drink.receipt.slice(0, 12).map((item) => clean(item, 40)).filter(Boolean) : [];
  const name = clean(drink.name, 40);
  if (!name || !receipt.length) {
    const error = new Error("手动作品缺少名称或配料");
    error.statusCode = 400;
    error.code = "invalid_import";
    throw error;
  }
  const media = Object.fromEntries(["image", "audio", "video"].flatMap((kind) => {
    const value = body?.media?.[kind];
    return typeof value === "string" && value ? [[kind, value]] : [];
  }));
  if (!Object.keys(media).length) {
    const error = new Error("手动作品没有可保存的媒体");
    error.statusCode = 400;
    error.code = "invalid_import";
    throw error;
  }
  return {
    drink: {
      name,
      summary: clean(drink.summary, 180),
      tags: Array.isArray(drink.tags) ? drink.tags.slice(0, 4).map((item) => clean(item, 20)).filter(Boolean) : [],
      receipt,
      sweetness: clean(drink.sweetness, 30),
      temperature: clean(drink.temperature, 30),
    },
    blessing: clean(body?.blessing, 160),
    moodNote: clean(body?.moodNote, 120),
    media,
  };
};

export const createImportCreationHandler = ({ authenticate = requireAuthenticatedUser } = {}) => async (request, response) => {
  setNoStore(response);
  if (request.method && request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "只支持 POST 请求", code: "method_not_allowed" });
  }
  const auth = await authenticate(request, response);
  if (!auth) return undefined;
  try {
    const payload = normalizeImport(request.body);
    return response.status(201).json(await importDrinkCreation({ ownerId: ownerOf(auth), ...payload }));
  } catch (error) {
    return sendError(response, error, "手动作品暂时保存不了，请稍后再试。", "IMPORT_FAILED");
  }
};
