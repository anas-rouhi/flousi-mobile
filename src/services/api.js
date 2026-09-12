import axios from "axios";
import * as SecureStore from "expo-secure-store";

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
const DEFAULT_HOST = "http://192.168.110.11:8000";
const API_PREFIX = "/api/v1";

function resolveBaseUrl() {
  const configured = process.env.EXPO_PUBLIC_API_URL;
  const host = (configured || DEFAULT_HOST).trim().replace(/\/+$/, "");

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
