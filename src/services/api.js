import axios from "axios";
import { NativeModules } from "react-native";
import * as SecureStore from "expo-secure-store";
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
 */
const API_PREFIX = "/api/v1";
const API_PORT = 8000;

/**
 * Last resort only. A hardcoded LAN address goes stale the moment the machine
 * joins another network — that is exactly what broke this app twice — so it
 * points at the loopback, which is right for simulators and web and obviously
 * wrong (rather than silently wrong) on a phone.
 */
const FALLBACK_HOST = `http://localhost:${API_PORT}`;

/**
 * The machine serving the JS bundle, taken from Metro's own script URL
 * ("http://192.168.110.135:8081/index.bundle?..."). In development the device
 * is by definition able to reach that address, so the API host tracks the LAN
 * IP automatically instead of needing an edit whenever the network changes.
 *
 * Empty in a production build, where EXPO_PUBLIC_API_URL is the real source.
 */
function metroHost() {
  const scriptURL = NativeModules?.SourceCode?.scriptURL;
  if (typeof scriptURL !== "string") {
    return null;
  }
  const match = /^https?:\/\/([^/:]+)/.exec(scriptURL);
  return match ? match[1] : null;
}

function resolveBaseUrl() {
  // Explicit configuration always wins.
  const configured = process.env.EXPO_PUBLIC_API_URL?.trim();

  const derived = configured
    ? configured
    : metroHost()
      ? `http://${metroHost()}:${API_PORT}`
      : FALLBACK_HOST;

  const host = derived.replace(/\/+$/, "");
  return host.endsWith(API_PREFIX) ? host : `${host}${API_PREFIX}`;
}

export const API_BASE_URL = resolveBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
  // Generous for local development: a cold Laravel boot over the LAN, behind a
  // tunnel, or on a first Metro-warmed request can easily outrun a tighter budget.
  timeout: 30000,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// Auto-attach Sanctum Bearer Token to every request
api.interceptors.request.use(
  async (config) => {
    const token = await SecureStore.getItemAsync("user_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
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
  (response) => response,
  (error) => {
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

/** Arabic message for whatever went wrong, for use in screen error states. */
export function describeApiError(error) {
  if (error?.response?.status === 401) {
    return "انتهت الجلسة، عاود دخول من فضلك";
  }
  if (error?.response?.data?.message) {
    return error.response.data.message;
  }
  if (error?.code === "ECONNABORTED") {
    return "الطلب خذا وقت طويل، عاود المحاولة";
  }
  return "ما قدرناش نوصلو للسيرفر، تحقق من الاتصال";
}

export default api;
