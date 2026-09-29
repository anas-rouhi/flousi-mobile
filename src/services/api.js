import axios from "axios";
import * as SecureStore from "expo-secure-store";
import { getLanguage, t } from "../i18n/store";
import { emitServerUnreachable } from "./serverEvents";
import { emitUnauthorized } from "./sessionEvents";

/**
 * Base URL resolution.
 *
 * Set EXPO_PUBLIC_API_URL in .env (see .env.example) to point the app at a
 * machine other than the default LAN host — Expo inlines it at bundle time.
 * It must be read with static dot notation; `process.env["..."]` and
 * destructuring are NOT inlined by the Expo CLI.
 *
 * The value may be either a bare host ("http://10.0.0.5:8000") or a full API
 * root ("http://10.0.0.5:8000/api/v1"); both resolve to the same baseURL.
 *
 * On top of that, a host typed in the app (ServerConnectModal) is stored under
 * CUSTOM_URL_KEY and wins over the bundled one, so switching Wi-Fi networks
 * needs neither an .env edit nor a Metro restart.
 */
const API_PREFIX = "/api/v1";
const API_PORT = 8000;
const CUSTOM_URL_KEY = "custom_api_base_url";

/**
 * Used whenever EXPO_PUBLIC_API_URL is missing. This is the dev machine's
 * current LAN address; update it if that machine joins another network.
 */
const FALLBACK_HOST = `http://192.168.110.104:${API_PORT}`;

/**
 * Turns whatever was typed into a clean host: adds the scheme when missing,
 * assumes the backend's port when neither scheme nor port was given, and
 * strips trailing slashes and the API prefix. Returns null for garbage.
 */
export function normalizeHost(input) {
  let value = String(input ?? "").trim().replace(/\/+$/, "");
  if (value.endsWith(API_PREFIX)) {
    value = value.slice(0, -API_PREFIX.length).replace(/\/+$/, "");
  }
  if (!value) {
    return null;
  }
  if (!/^https?:\/\//i.test(value)) {
    // "192.168.1.55" -> "http://192.168.1.55:8000"
    value = `http://${value}${/:\d+$/.test(value) ? "" : `:${API_PORT}`}`;
  }
  return /^https?:\/\/[^\s/:]+(:\d+)?$/i.test(value) ? value : null;
}

/** The host baked into the bundle: .env first, then the hard-coded LAN IP. */
export const DEFAULT_API_HOST =
  normalizeHost(process.env.EXPO_PUBLIC_API_URL) || FALLBACK_HOST;

const toBaseUrl = (host) => `${host}${API_PREFIX}`;

let currentHost = DEFAULT_API_HOST;

const api = axios.create({
  baseURL: toBaseUrl(currentHost),
  // Short on purpose: an unreachable host should fail fast with a visible error
  // rather than leave the user on a spinner.
  timeout: 8000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

/**
 * Reads the stored override once, at import time. Every request awaits it (see
 * the request interceptor), so nothing boots against the bundled host when an
 * override exists.
 */
const storedHostLoaded = SecureStore.getItemAsync(CUSTOM_URL_KEY)
  .then((stored) => {
    const host = normalizeHost(stored);
    if (host) {
      currentHost = host;
      api.defaults.baseURL = toBaseUrl(host);
    }
  })
  .catch((error) => {
    console.log("Stored API URL read failed:", error.message);
  });

/** Resolves once the stored override (if any) has been applied. */
export function apiHostReady() {
  return storedHostLoaded;
}

/** The host requests currently go to, without the /api/v1 prefix. */
export function getApiHost() {
  return currentHost;
}

/** True when the host was typed in the app rather than bundled. */
export function isCustomApiHost() {
  return currentHost !== DEFAULT_API_HOST;
}

/**
 * Points the app at another backend, immediately and persistently: the very
 * next request uses it. Passing nothing (or the bundled host) forgets the
 * override. Returns the host now in use; throws "invalid_url" for garbage.
 */
export async function setApiBaseUrl(newUrl) {
  const host = newUrl ? normalizeHost(newUrl) : DEFAULT_API_HOST;
  if (!host) {
    throw new Error("invalid_url");
  }
  // A late stored read must not overwrite what was just chosen.
  await storedHostLoaded;
  currentHost = host;
  api.defaults.baseURL = toBaseUrl(host);
  networkFailures = 0;
  try {
    if (host === DEFAULT_API_HOST) {
      await SecureStore.deleteItemAsync(CUSTOM_URL_KEY);
    } else {
      await SecureStore.setItemAsync(CUSTOM_URL_KEY, host);
    }
  } catch (error) {
    // Still applied for this session; only the next cold start loses it.
    console.log("Stored API URL write failed:", error.message);
  }
  return host;
}

/**
 * Asks the current host for any HTTP answer. A 401 counts as reachable: it
 * proves the backend is listening there, which is all a URL check needs.
 */
export async function pingApi() {
  try {
    await api.get("/me", { timeout: 5000 });
    return true;
  } catch (error) {
    return Boolean(error?.response);
  }
}

// Auto-attach Sanctum Bearer Token to every request
api.interceptors.request.use(
  async (config) => {
    await storedHostLoaded;
    // Axios merged the defaults in before this ran, possibly while the stored
    // host was still loading; a retried config also carries its old host.
    config.baseURL = api.defaults.baseURL;
    console.log(
      "🚀 [API OUTGOING]:",
      config.method?.toUpperCase(),
      `${config.baseURL}${config.url}`,
    );
    const token = await SecureStore.getItemAsync("user_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Lets a locale-aware backend answer (validation messages, category names)
    // in the language the UI is showing; ignored by one that is not.
    config.headers["Accept-Language"] = getLanguage();
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

/**
 * True when a request died from a timeout or a bare connection failure rather
 * than a real HTTP response — the transient class of failure that is worth
 * retrying once before bothering the user.
 */
export function isRetryableError(error) {
  if (error?.response) {
    return false; // The server answered; retrying will not change the verdict.
  }
  return error?.code === "ECONNABORTED" || error?.code === "ERR_NETWORK";
}

/**
 * Consecutive requests that never reached the server. One blip is not worth a
 * prompt; two in a row (a call plus its retry, or two screens loading) means
 * the host is wrong or down. `/me` is the boot check, so it prompts alone.
 */
const UNREACHABLE_THRESHOLD = 2;
let networkFailures = 0;

function trackNetworkFailure(error) {
  if (error?.response) {
    networkFailures = 0; // The server answered, even if unhappily.
    return;
  }
  if (axios.isCancel(error)) {
    return;
  }
  // No response at all: ERR_NETWORK on device, ECONNREFUSED and friends
  // elsewhere, ECONNABORTED on timeout.
  networkFailures += 1;
  const url = error?.config?.url || "";
  if (networkFailures >= UNREACHABLE_THRESHOLD || url === "/me") {
    emitServerUnreachable({ host: currentHost, url });
  }
}

/**
 * The only endpoints that are reachable without a token. A 401 from one of
 * these is a verdict on the submitted credentials, not on a stored session, so
 * it must never trigger a sign-out.
 */
const UNAUTHENTICATED_ROUTES = ["/auth/login", "/auth/register"];

/**
 * Turns a rejected token into a clean sign-out.
 *
 * Without this, a token revoked server-side left the user sitting on the
 * dashboard staring at an error until the next cold start — `/me` only runs at
 * boot. Now any authenticated 401 clears the session and the navigation gate
 * returns them to Login, because the gate is driven by the auth state itself.
 */
api.interceptors.response.use(
  (response) => {
    networkFailures = 0;
    return response;
  },
  (error) => {
    trackNetworkFailure(error);
    const status = error?.response?.status;
    const url = error?.config?.url || "";
    const isEntryPoint = UNAUTHENTICATED_ROUTES.some((route) =>
      url.includes(route),
    );

    if (status === 401 && !isEntryPoint) {
      emitUnauthorized({ url });
    }

    return Promise.reject(error);
  },
);

/**
 * Laravel answers a failed validation with 422 and an `errors` bag. The first
 * field message is far more useful than the generic top-level one, so prefer it
 * and fall back to the general description.
 */
export function describeValidationError(error) {
  const bag = error?.response?.data?.errors;
  if (bag) {
    const first = Object.values(bag).flat().filter(Boolean)[0];
    if (first) {
      return first;
    }
  }
  if (error?.response?.data?.message) {
    return error.response.data.message;
  }
  return describeApiError(error);
}

/**
 * Message in the active language for whatever went wrong, for use in screen
 * error states.
 *
 * Only failures the client can name are translated. A message the server wrote
 * is shown in its original text: it is specific ("The email has already been
 * taken"), and replacing it with a generic line would hide what to fix.
 */
export function describeApiError(error) {
  if (error?.response?.status === 401) {
    return t("session.token_expired");
  }
  if (error?.response?.data?.message) {
    return error.response.data.message;
  }
  if (error?.code === "ECONNABORTED") {
    return t("session.timeout");
  }
  if (error?.response) {
    // The server answered, but without a message to pass through.
    return t("common.error_generic");
  }
  return t("session.network");
}

export default api;
