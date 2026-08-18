import { neon } from "@neondatabase/serverless";
import { signMediaUrl, storeRemoteMedia } from "./r2-storage.mjs";

let database;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const db = () => {
  if (!process.env.DATABASE_URL) {
    const error = new Error("服务端尚未配置 DATABASE_URL");
    error.statusCode = 503;
    error.code = "database_not_configured";
    throw error;
  }
  database ||= neon(process.env.DATABASE_URL);
  return database;
};

const rowsOf = (result) => Array.isArray(result) ? result : result?.rows || [];
const validateOwner = (ownerId) => {
  if (typeof ownerId !== "string" || !ownerId.trim() || ownerId.length > 200) {
    const error = new Error("登录状态无效，请重新登录");
    error.statusCode = 401;
    error.code = "invalid_authentication";
    throw error;
  }
  return ownerId.trim();
};

export const createDrinkCreation = async ({ ownerId, drink, blessing, moodNote = "" }) => {
  const owner = validateOwner(ownerId);
  const recipe = {
    tags: Array.isArray(drink.tags) ? drink.tags : [],
    receipt: Array.isArray(drink.receipt) ? drink.receipt : [],
    sweetness: drink.sweetness || "",
    temperature: drink.temperature || "",
  };
  const result = await db().query(
    `INSERT INTO public.drink_creations (owner_id, name, summary, blessing, mood_note, recipe)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)
     RETURNING id, created_at`,
    [owner, drink.name, drink.summary || "", blessing || "", moodNote || "", JSON.stringify(recipe)],
  );
  return rowsOf(result)[0];
};

export const ensureCreationOwner = async (creationId, ownerId) => {
  if (!UUID.test(String(creationId || ""))) {
    const error = new Error("作品编号无效");
    error.statusCode = 400;
    error.code = "invalid_creation_id";
    throw error;
  }
  const result = await db().query(
    "SELECT id FROM public.drink_creations WHERE id = $1 AND owner_id = $2 LIMIT 1",
    [creationId, validateOwner(ownerId)],
  );
  if (!rowsOf(result)[0]) {
    const error = new Error("作品不存在或不属于当前账号");
    error.statusCode = 404;
    error.code = "creation_not_found";
    throw error;
  }
};

export const upsertCreationMedia = async ({ ownerId, creationId, kind, objectKey, mimeType, byteSize, sourceProvider }) => {
  await ensureCreationOwner(creationId, ownerId);
  await db().query(
    `INSERT INTO public.creation_media
       (creation_id, owner_id, kind, object_key, mime_type, byte_size, source_provider)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (creation_id, kind) DO UPDATE SET
       object_key = EXCLUDED.object_key,
       mime_type = EXCLUDED.mime_type,
       byte_size = EXCLUDED.byte_size,
       source_provider = EXCLUDED.source_provider,
       updated_at = now()`,
    [creationId, validateOwner(ownerId), kind, objectKey, mimeType, byteSize, sourceProvider || ""],
  );
};

export const persistCreationMedia = async ({ ownerId, creationId, kind, sourceUrl, sourceProvider }, options) => {
  await ensureCreationOwner(creationId, ownerId);
  const stored = await storeRemoteMedia({ ownerId, creationId, kind, sourceUrl, sourceProvider }, options);
  await upsertCreationMedia({ ownerId, creationId, kind, ...stored, sourceProvider });
  return { ...stored, url: await signMediaUrl(stored), expiresAt: new Date(Date.now() + 15 * 60_000).toISOString() };
};

export const listDrinkCreations = async (ownerId, { limit = 30 } = {}) => {
  const owner = validateOwner(ownerId);
  const result = await db().query(
    `SELECT c.id, c.name, c.summary, c.blessing, c.mood_note, c.recipe, c.created_at,
       COALESCE(jsonb_agg(jsonb_build_object(
         'kind', m.kind, 'objectKey', m.object_key, 'mimeType', m.mime_type,
         'byteSize', m.byte_size, 'updatedAt', m.updated_at
       )) FILTER (WHERE m.id IS NOT NULL), '[]'::jsonb) AS media
     FROM public.drink_creations c
     LEFT JOIN public.creation_media m ON m.creation_id = c.id AND m.owner_id = c.owner_id
     WHERE c.owner_id = $1
     GROUP BY c.id
     ORDER BY c.created_at DESC
     LIMIT $2`,
    [owner, Math.max(1, Math.min(50, Number(limit) || 30))],
  );
  return Promise.all(rowsOf(result).map(async (creation) => ({
    id: creation.id,
    name: creation.name,
    summary: creation.summary,
    blessing: creation.blessing,
    moodNote: creation.mood_note,
    recipe: creation.recipe,
    createdAt: creation.created_at,
    media: Object.fromEntries(await Promise.all((creation.media || []).map(async (item) => [
      item.kind,
      {
        url: await signMediaUrl({ objectKey: item.objectKey, mimeType: item.mimeType }),
        mimeType: item.mimeType,
        byteSize: Number(item.byteSize) || 0,
        expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
      },
    ]))),
  })));
};

export const importDrinkCreation = async ({ ownerId, drink, blessing, moodNote = "", media = {} }) => {
  const creation = await createDrinkCreation({ ownerId, drink, blessing, moodNote });
  const stored = {};
  for (const kind of ["image", "audio", "video"]) {
    if (!media[kind]) continue;
    stored[kind] = await persistCreationMedia({
      ownerId,
      creationId: creation.id,
      kind,
      sourceUrl: media[kind],
      sourceProvider: kind === "audio" ? "minimax" : "evolink",
    });
  }
  return { id: creation.id, createdAt: creation.created_at, media: stored };
};
