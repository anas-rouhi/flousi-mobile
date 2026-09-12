import * as SecureStore from "expo-secure-store";
import api, { describeValidationError } from "./api";

/**
 * All token handling lives here so no screen touches SecureStore directly and
 * there is exactly one place that decides what "signed in" means.
 *
 * The key is unchanged from the original implementation so existing installs
 * stay logged in across this refactor.
 */
const TOKEN_KEY = "user_token";
const USER_KEY = "user_profile";

export async function getToken() {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch (error) {
    console.log("Token read failed:", error.message);
    return null;
  }
}

/** Last known profile, so the dashboard can greet the user before /me lands. */
export async function getCachedUser() {
  try {
    const raw = await SecureStore.getItemAsync(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.log("Cached user read failed:", error.message);
    return null;
  }
}

/** Raised when the keychain accepted a write but did not keep it. */
export class SessionPersistError extends Error {
  constructor() {
    super("Session token could not be stored");
    this.name = "SessionPersistError";
    this.code = "ERR_SESSION_PERSIST";
  }
}

/**
 * Writes the session and reads it back before returning.
 *
 * The verification matters because the axios request interceptor reads the
 * token out of SecureStore on *every* call. If a write silently failed, later
 * requests would go out unauthenticated and stall until the 30s timeout instead
 * of failing fast — so nothing downstream is told the session exists until the
 * token is provably readable.
 *
 * The cached profile is best-effort: it is a greeting convenience, never a
 * reason to fail a sign-in that otherwise succeeded.
 */
async function persistSession(token, user) {
  await SecureStore.setItemAsync(TOKEN_KEY, token);

  const stored = await SecureStore.getItemAsync(TOKEN_KEY);
  if (stored !== token) {
    throw new SessionPersistError();
  }

  if (user) {
    try {
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
    } catch (error) {
      console.log("Cached profile write failed (non-fatal):", error.message);
    }
  }

  return token;
}

export async function clearSession() {
  // Deleting the token is what actually signs the user out, so it goes first
  // and the profile is best-effort cleanup after it.
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch (error) {
    console.log("Token delete failed:", error.message);
  }
  try {
    await SecureStore.deleteItemAsync(USER_KEY);
  } catch (error) {
    console.log("Cached user delete failed:", error.message);
  }
}

/**
 * POST /auth/login — resolves only once the token is stored and verified, so
 * the caller can flip to "authenticated" knowing the next request will carry it.
 *
 * @returns {Promise<{user: object, token: string}>}
 */
export async function login({ email, password }) {
  const response = await api.post("/auth/login", { email, password });
  const { token, user } = response.data;

  if (!token) {
    throw new Error("Login response carried no token");
  }

  await persistSession(token, user);
  return { user, token };
}

/**
 * POST /auth/register — the API creates the account and issues a token in one
 * call, so a successful response already is a session.
 *
 * The sequence is strict and fully serial: await the response, reject a
 * tokenless body, then write and verify the token. Only after this resolves may
 * a caller update state or start any authenticated request.
 *
 * Deliberately never retried: the request is not idempotent, and a second POST
 * after a timeout would either duplicate the account or fail on the unique
 * email rule. A timed-out registration is reported to the user instead.
 *
 * @returns {Promise<{user: object, token: string}>}
 */
export async function register({ name, email, password }) {
  const response = await api.post("/auth/register", { name, email, password });
  const { token, user } = response.data;

  if (!token) {
    throw new Error("Register response carried no token");
  }

  await persistSession(token, user);
  return { user, token };
}

/**
 * Revokes the current token server-side, then clears it locally. The local
 * clear happens even if the network call fails — the user asked to sign out,
 * so the session must not survive on the device either way.
 */
export async function logout() {
  try {
    await api.post("/auth/logout");
  } catch (error) {
    console.log("Remote logout failed, clearing locally:", error.message);
  }
  await clearSession();
}

/** GET /me — confirms the stored token is still valid and refreshes the profile. */
export async function fetchMe() {
  const response = await api.get("/me");
  const user = response.data?.user ?? null;

  if (user) {
    try {
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
    } catch (error) {
      console.log("Cached user write failed:", error.message);
    }
  }
  return user;
}

/**
 * The login "wrong credentials" rejection arrives as a 422 validation error on
 * the email field, so the shared validation reader already says the right thing.
 */
export function describeAuthError(error) {
  if (error?.code === "ERR_SESSION_PERSIST") {
    return "ما قدرناش نحفظو الجلسة على الجهاز، عاود المحاولة";
  }
  return describeValidationError(error);
}
