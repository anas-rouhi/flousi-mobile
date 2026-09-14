import api, { describeValidationError } from "./api";

/**
 * POST /password/forgot
 *
 * The API answers identically whether or not the address is registered, so this
 * resolves the same way for both and the screen has nothing to branch on. That
 * is deliberate: a different answer for unknown addresses would let anyone test
 * which emails hold a FLOUSI account.
 *
 * The reset mail is queued server-side, so this returns without waiting on the
 * mail host.
 */
export async function requestPasswordReset(email) {
  await api.post("/password/forgot", { email });
}

/**
 * POST /password/reset
 *
 * On success the API revokes every token that user holds, so any other signed-in
 * device is signed out too.
 */
export async function resetPassword({
  email,
  token,
  password,
  passwordConfirmation,
}) {
  await api.post("/password/reset", {
    email,
    token,
    password,
    password_confirmation: passwordConfirmation,
  });
}

/**
 * A reset link is single-use and expires after an hour, and the API reports all
 * of that as a 422 on `email` — indistinguishable from a typo in the address.
 * Since the address comes from the link rather than the keyboard, any 422 there
 * means the link itself is spent.
 */
export function isDeadLinkError(error) {
  const bag = error?.response?.data?.errors;
  return error?.response?.status === 422 && Boolean(bag?.email);
}

/** The API's message for a specific field, so a weak password lands on its input. */
export function fieldError(error, field) {
  const messages = error?.response?.data?.errors?.[field];
  return Array.isArray(messages) ? messages[0] : null;
}

export { describeValidationError };
