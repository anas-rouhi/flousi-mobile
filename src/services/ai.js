import api from "./api";
import { sanitizeAmountInput } from "../utils/money";

/**
 * Natural-language transaction entry ("35 درهم طاكسي", "Déjeuner 50 DH").
 *
 * NOTE ON AVAILABILITY — the API does not expose this route yet. The contract
 * below is the one the quick-add bar is wired against; until it ships every
 * call comes back 404 and `isAiEndpointMissing()` lets the bar say "not
 * available yet" instead of showing a raw failure.
 *
 *   POST /ai/parse-transaction  { text }
 *     → { data: { type, amount, category_id, description } }
 *
 * Every field of the answer is optional: the server fills what it understood
 * and the form keeps whatever the user already entered for the rest.
 */

/** True while the route is absent (404) or the verb is not routed (405). */
export function isAiEndpointMissing(error) {
  const status = error?.response?.status;
  return status === 404 || status === 405;
}

/**
 * @param {string} text what the user typed
 * @param {{ signal?: AbortSignal }} options aborts a parse overtaken by typing
 * @returns {Promise<{
 *   type: "expense"|"income"|null,
 *   amount: string|null,
 *   categoryId: string|null,
 *   description: string|null,
 * }>}
 */
export async function parseTransaction(text, { signal } = {}) {
  const response = await api.post(
    "/ai/parse-transaction",
    { text },
    { signal },
  );
  const parsed = response.data?.data ?? response.data ?? {};

  const type =
    parsed.type === "expense" || parsed.type === "income" ? parsed.type : null;

  // The server may answer with a number or a string; the form only ever holds
  // the sanitized decimal string it sends back on submit.
  const amount =
    parsed.amount === null || parsed.amount === undefined
      ? ""
      : sanitizeAmountInput(String(parsed.amount));

  return {
    type,
    amount: amount || null,
    categoryId: parsed.category_id ?? null,
    description: parsed.description?.trim() || null,
  };
}
