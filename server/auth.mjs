import { createRemoteJWKSet, jwtVerify } from "jose";

const AUTH_REQUIRED = {
  statusCode: 401,
  code: "AUTH_REQUIRED",
  message: "请先登录后再使用多模态能力。",
};

const AUTH_UNAVAILABLE = {
  statusCode: 503,
  code: "AUTH_UNAVAILABLE",
  message: "登录验证服务暂时不可用，请稍后再试。",
};

const invalidTokenCodes = new Set([
  "ERR_JWT_EXPIRED",
  "ERR_JWT_CLAIM_VALIDATION_FAILED",
  "ERR_JWT_INVALID",
  "ERR_JWS_INVALID",
  "ERR_JWS_SIGNATURE_VERIFICATION_FAILED",
  "ERR_JWKS_NO_MATCHING_KEY",
  "ERR_JOSE_NOT_SUPPORTED",
]);

const remoteKeySets = new Map();

export class AuthenticationError extends Error {
  constructor({ statusCode, code, message }, options) {
    super(message, options);
    this.name = "AuthenticationError";
    this.statusCode = statusCode;
    this.code = code;
  }
}

const authError = (definition, cause) => new AuthenticationError(
  definition,
  cause ? { cause } : undefined,
);

const readHeader = (request, name) => {
  if (request?.headers?.get) return request.headers.get(name);
  const value = request?.headers?.[name.toLowerCase()] ?? request?.headers?.[name];
  return Array.isArray(value) ? value[0] : value;
};

const readBearerToken = (request) => {
  const authorization = readHeader(request, "authorization");
  if (typeof authorization !== "string") throw authError(AUTH_REQUIRED);
  const match = authorization.match(/^Bearer[\t ]+([^\s,]+)$/i);
  if (!match || match[1].split(".").length !== 3) throw authError(AUTH_REQUIRED);
  return match[1];
};

const getAuthBaseUrl = (authUrl) => {
  const configuredUrl = String(
    authUrl || process.env.NEON_AUTH_URL || process.env.VITE_NEON_AUTH_URL || "",
  ).trim();
  if (!configuredUrl) throw authError(AUTH_UNAVAILABLE);

  try {
    const url = new URL(configuredUrl.replace(/\/+$/, ""));
    if (url.username || url.password || url.search || url.hash) {
      throw new Error("Neon Auth URL must not contain credentials, query, or hash");
    }
    if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1", "::1"].includes(url.hostname))) {
      throw new Error("Neon Auth URL must use HTTPS");
    }
    return url;
  } catch (error) {
    throw authError(AUTH_UNAVAILABLE, error);
  }
};

const getRemoteKeySet = (baseUrl) => {
  const jwksUrl = new URL(`${baseUrl.toString().replace(/\/+$/, "")}/.well-known/jwks.json`);
  const cacheKey = jwksUrl.toString();
  if (!remoteKeySets.has(cacheKey)) {
    remoteKeySets.set(cacheKey, createRemoteJWKSet(jwksUrl, { timeoutDuration: 5_000 }));
  }
  return remoteKeySets.get(cacheKey);
};

/**
 * Verify an incoming Neon Auth service JWT.
 *
 * BetterAuthReactAdapter puts the JWT from Neon's `set-auth-jwt` response
 * header at `session.session.token`. Neon/Better Auth signs it with the Auth
 * service JWKS and sets both issuer and audience to the configured Auth URL.
 */
export async function authenticateRequest(request, {
  authUrl,
  keySet,
  now = new Date(),
} = {}) {
  const token = readBearerToken(request);
  const baseUrl = getAuthBaseUrl(authUrl);
  const issuers = [...new Set([baseUrl.origin, baseUrl.toString()])];
  const audience = baseUrl.origin;

  try {
    const { payload, protectedHeader } = await jwtVerify(
      token,
      keySet || getRemoteKeySet(baseUrl),
      {
        issuer: issuers,
        audience,
        currentDate: now instanceof Date ? now : new Date(now),
      },
    );
    const anonymous = payload.role === "anonymous"
      || payload.isAnonymous === true
      || payload.sub === "anonymous";
    if (
      anonymous
      || payload.role !== "authenticated"
      || typeof payload.sub !== "string"
      || !payload.sub
      || !payload.aud
      || !protectedHeader.kid
    ) {
      throw authError(AUTH_REQUIRED);
    }
    return { user: { id: payload.sub } };
  } catch (error) {
    if (error instanceof AuthenticationError) throw error;
    if (invalidTokenCodes.has(error?.code)) throw authError(AUTH_REQUIRED, error);
    throw authError(AUTH_UNAVAILABLE, error);
  }
}

const sendAuthError = (response, error) => {
  const known = error instanceof AuthenticationError ? error : authError(AUTH_UNAVAILABLE, error);
  response.setHeader?.("Cache-Control", "no-store");
  if (known.statusCode === 401) response.setHeader?.("WWW-Authenticate", "Bearer");
  response.status(known.statusCode).json({ error: known.message, code: known.code });
};

/**
 * Express/Vercel-compatible one-line guard. Returns verified auth data, or
 * writes the normalized 401/503 response and returns null.
 */
export async function requireAuthenticatedUser(request, response, options) {
  try {
    return await authenticateRequest(request, options);
  } catch (error) {
    sendAuthError(response, error);
    return null;
  }
}
