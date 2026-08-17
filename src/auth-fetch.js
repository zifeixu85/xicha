export class AuthRequiredError extends Error {
  constructor(message = "请先登录后再使用此功能。") {
    super(message);
    this.name = "AuthRequiredError";
    this.code = "AUTH_REQUIRED";
  }
}

export class CrossOriginAuthError extends Error {
  constructor() {
    super("认证 token 只能发送给同源 API。");
    this.name = "CrossOriginAuthError";
    this.code = "AUTH_CROSS_ORIGIN";
  }
}

export const getSessionToken = (authSession) => {
  const token = authSession?.session?.token;
  return typeof token === "string" && token.trim() ? token.trim() : null;
};

/**
 * Same-origin fetch for protected APIs. The session token stays in the Neon
 * Auth in-memory session object and is never persisted by this helper.
 */
export async function authFetch(input, init = {}, {
  session,
  getSession,
  fetchImpl = fetch,
  origin = globalThis.location?.origin,
} = {}) {
  const isRequest = typeof Request !== "undefined" && input instanceof Request;
  if (origin) {
    const sourceOrigin = new URL(origin).origin;
    const target = new URL(isRequest ? input.url : String(input), sourceOrigin);
    if (target.origin !== sourceOrigin) throw new CrossOriginAuthError();
  }

  let currentSession = session;
  if (getSession) {
    const latest = await getSession();
    currentSession = latest && Object.hasOwn(latest, "data") ? latest.data : latest;
  }
  const token = getSessionToken(currentSession);
  if (!token) throw new AuthRequiredError();

  const headers = new Headers(isRequest ? input.headers : undefined);
  new Headers(init.headers).forEach((value, name) => headers.set(name, value));
  headers.set("Authorization", `Bearer ${token}`);
  return fetchImpl(input, { ...init, headers });
}
