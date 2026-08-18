import { createHash } from "node:crypto";
import { GetObjectCommand, HeadBucketCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const MEDIA = Object.freeze({
  image: { extension: "png", prefix: "image/", maxBytes: 24 * 1024 * 1024 },
  audio: { extension: "mp3", prefix: "audio/", maxBytes: 24 * 1024 * 1024 },
  video: { extension: "mp4", prefix: "video/", maxBytes: 160 * 1024 * 1024 },
});
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TRUSTED_MEDIA_HOSTS = new Set([
  "files.evolink.ai",
  "api.minimaxi.com",
  "filecdn.minimax.chat",
  "cdn.minimax.chat",
  "minimax-algeng-chat-tts.oss-cn-wulanchabu.aliyuncs.com",
  "dashscope-463f.oss-accelerate.aliyuncs.com",
]);
let client;

export class StorageError extends Error {
  constructor(message, statusCode = 502, code = "storage_error") {
    super(message);
    this.name = "StorageError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

const config = () => ({
  endpoint: process.env.STORAGE_ENDPOINT?.trim(),
  region: process.env.STORAGE_REGION?.trim() || "auto",
  accessKeyId: process.env.STORAGE_ACCESS_KEY?.trim(),
  secretAccessKey: process.env.STORAGE_SECRET_KEY?.trim(),
  bucket: process.env.STORAGE_BUCKET?.trim(),
});

export const storageConfigured = () => Object.values(config()).every(Boolean);

const storageClient = () => {
  const current = config();
  if (!Object.values(current).every(Boolean)) {
    throw new StorageError("服务端尚未配置 Cloudflare R2 存储", 503, "storage_not_configured");
  }
  if (!client) {
    client = new S3Client({
      region: current.region,
      endpoint: current.endpoint,
      credentials: { accessKeyId: current.accessKeyId, secretAccessKey: current.secretAccessKey },
    });
  }
  return { client, bucket: current.bucket };
};

const ownerSegment = (ownerId) => createHash("sha256").update(ownerId).digest("base64url").slice(0, 32);

export const mediaObjectKey = ({ ownerId, creationId, kind }) => {
  if (typeof ownerId !== "string" || !ownerId.trim()) throw new StorageError("账号标识无效", 401, "invalid_owner");
  if (!UUID.test(creationId)) throw new StorageError("作品编号无效", 400, "invalid_creation_id");
  const media = MEDIA[kind];
  if (!media) throw new StorageError("媒体类型无效", 400, "invalid_media_kind");
  return `users/${ownerSegment(ownerId.trim())}/creations/${creationId}/${kind}.${media.extension}`;
};

const validateRemoteUrl = (value) => {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new StorageError("媒体来源地址无效", 400, "invalid_media_url");
  }
  const host = parsed.hostname.toLowerCase().replace(/\.$/, "");
  const trustedSuffix = host.endsWith(".minimax.chat")
    || host.endsWith(".minimaxi.com")
    || host.endsWith(".oss-accelerate.aliyuncs.com")
    || host.endsWith(".oss-cn-wulanchabu.aliyuncs.com");
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || (!TRUSTED_MEDIA_HOSTS.has(host) && !trustedSuffix)) {
    throw new StorageError("媒体来源不受信任", 400, "untrusted_media_url");
  }
  return parsed.toString();
};

const readCappedBody = async (response, maxBytes) => {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) throw new StorageError("媒体文件超过保存上限", 413, "media_too_large");
  if (!response.body) throw new StorageError("媒体来源没有返回文件", 502, "empty_media_body");
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new StorageError("媒体文件超过保存上限", 413, "media_too_large");
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, total);
};

export const storeRemoteMedia = async ({ ownerId, creationId, kind, sourceUrl, sourceProvider = "" }, {
  fetchImpl = fetch,
} = {}) => {
  const media = MEDIA[kind];
  if (!media) throw new StorageError("媒体类型无效", 400, "invalid_media_kind");
  const safeUrl = validateRemoteUrl(sourceUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);
  try {
    const response = await fetchImpl(safeUrl, { signal: controller.signal, redirect: "error" });
    if (!response.ok) throw new StorageError("媒体文件暂时无法下载", 502, "media_download_failed");
    const mimeType = String(response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!mimeType.startsWith(media.prefix)) throw new StorageError("媒体文件格式与作品类型不匹配", 502, "media_type_mismatch");
    const body = await readCappedBody(response, media.maxBytes);
    const objectKey = mediaObjectKey({ ownerId, creationId, kind });
    const { client: s3, bucket } = storageClient();
    await s3.send(new PutObjectCommand({
      Bucket: bucket,
      Key: objectKey,
      Body: body,
      ContentLength: body.byteLength,
      ContentType: mimeType,
      CacheControl: "private, max-age=31536000, immutable",
      Metadata: { provider: sourceProvider.slice(0, 40), creation: creationId },
    }));
    return { objectKey, mimeType, byteSize: body.byteLength };
  } catch (error) {
    if (error instanceof StorageError) throw error;
    if (error?.name === "AbortError") throw new StorageError("保存媒体超时，请稍后重试", 504, "storage_timeout");
    throw new StorageError("媒体暂时无法保存到 R2", 502, "storage_upload_failed");
  } finally {
    clearTimeout(timeout);
  }
};

export const signMediaUrl = async ({ objectKey, mimeType, expiresIn = 900 }) => {
  if (typeof objectKey !== "string" || !objectKey.startsWith("users/") || objectKey.includes("..")) {
    throw new StorageError("媒体对象键无效", 400, "invalid_object_key");
  }
  const { client: s3, bucket } = storageClient();
  return getSignedUrl(s3, new GetObjectCommand({
    Bucket: bucket,
    Key: objectKey,
    ResponseContentType: mimeType || undefined,
    ResponseCacheControl: "private, max-age=900",
  }), { expiresIn });
};

export const verifyStorageConnection = async () => {
  const { client: s3, bucket } = storageClient();
  await s3.send(new HeadBucketCommand({ Bucket: bucket }));
  return { bucket };
};
