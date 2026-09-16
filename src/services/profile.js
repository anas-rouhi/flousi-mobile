import { t } from "../i18n/store";
import api, { describeValidationError } from "./api";
import { cacheUser } from "./auth";

/**
 * Profile management.
 *
 * NOTE ON AVAILABILITY — the API does not expose these routes yet. As of this
 * commit `routes/api.php` has `GET /me` and `GET /user` and nothing else for
 * the account: no `PUT /profile`, no `PUT /profile/password`, no
 * `DELETE /profile`. The paths below are the agreed contract, so the screens
 * are wired and will work the moment the backend ships them; until then every
 * call comes back 404 and `isProfileEndpointMissing()` lets the caller say
 * "not available yet" instead of showing a raw failure.
 *
 *   PUT    /profile           { preferred_language, preferred_currency, timezone }
 *   PUT    /profile/password  { current_password, password, password_confirmation }
 *   DELETE /profile           204 — deletes the account and its data
 */

/** True while the route is absent (404) or the verb is not routed (405). */
export function isProfileEndpointMissing(error) {
  const status = error?.response?.status;
  return status === 404 || status === 405;
}

/**
 * Updates any subset of the editable profile fields.
 *
 * The fresh profile is written to the device cache so the next cold start
 * greets the user with it, exactly as `fetchMe` does.
 *
 * @param {{ preferredLanguage?: string, preferredCurrency?: string, timezone?: string }} changes
 * @returns {Promise<object|null>} the updated user
 */
export async function updateProfile(changes) {
  const payload = {};
  if (changes.preferredLanguage) {
    payload.preferred_language = changes.preferredLanguage;
  }
  if (changes.preferredCurrency) {
    payload.preferred_currency = changes.preferredCurrency;
  }
  if (changes.timezone) {
    payload.timezone = changes.timezone;
  }

  const response = await api.put("/profile", payload);
  const user = response.data?.user ?? response.data?.data ?? response.data ?? null;

  if (user) {
    await cacheUser(user);
  }
  return user;
}

/**
 * Changes the password. The API is expected to keep the current token valid
 * (the user is still who they were), so this does not sign anyone out.
 */
export async function changePassword({
  currentPassword,
  password,
  passwordConfirmation,
}) {
  await api.put("/profile/password", {
    current_password: currentPassword,
    password,
    password_confirmation: passwordConfirmation,
  });
}

/**
 * Deletes the account and everything in it.
 *
 * Irreversible, and required by Apple Guideline 5.1.1(v) for any app that
 * lets people create an account. The caller clears the local session after
 * this resolves.
 */
export async function deleteAccount() {
  await api.delete("/profile");
}

/**
 * A translated message for a failed profile request, with the "the server
 * cannot do this yet" case named separately so a screen can be honest about
 * it rather than blaming the input.
 */
export function describeProfileError(error) {
  if (isProfileEndpointMissing(error)) {
    return t("settings.profile_unavailable");
  }
  return describeValidationError(error);
}

/** The device's IANA zone ("Africa/Casablanca"), or null if unavailable. */
export function deviceTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  } catch {
    return null;
  }
}
