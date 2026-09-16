import { t } from "../i18n/store";
import api, { describeApiError, describeValidationError } from "./api";

/**
 * Savings goals. Verified against the backend's GoalController and API.md.
 *
 *   GET    /goals                 { data: [goal, …] } — active goals, newest first
 *   POST   /goals                 201 { data: goal }
 *   PATCH  /goals/{id}            200 { data: goal } — any subset of the fields
 *   DELETE /goals/{id}            204 — archives; the goal then 404s everywhere
 *   POST   /goals/{id}/contribute 200 { data: goal }
 *
 * A goal is flat, like the analytics rows: centimes as plain integers with a
 * `*_formatted` sibling in the goal's own currency —
 *
 *   { id, name, currency, icon, color,
 *     saved_amount, saved_amount_formatted,
 *     target_amount, target_amount_formatted,
 *     remaining, remaining_formatted,          // never below 0
 *     progress_percentage,                     // whole, floored, capped at 100
 *     is_completed, target_date ("YYYY-MM-DD" | null),
 *     months_remaining (int | null — null without a date, 0 once passed) }
 *
 * Every amount sent is INTEGER CENTIMES (`target_amount`, `amount`), like
 * accounts and budgets and unlike transactions.
 */

export async function fetchGoals() {
  const response = await api.get("/goals");
  return response.data?.data ?? [];
}

/**
 * @param {{ name: string, targetCentimes: number, currency: string,
 *   targetDate?: string|null, icon?: string|null, color?: string|null }} goal
 */
export async function createGoal(goal) {
  const response = await api.post("/goals", toPayload(goal));
  return response.data?.data ?? response.data;
}

/** Sends every field, so clearing the deadline sends `target_date: null`. */
export async function updateGoal(id, goal) {
  const response = await api.patch(`/goals/${id}`, toPayload(goal));
  return response.data?.data ?? response.data;
}

export async function deleteGoal(id) {
  await api.delete(`/goals/${id}`);
}

/**
 * Without `accountId` only the goal moves. With it, the server also books a
 * transfer out of that account — which must share the goal's currency.
 */
export async function contributeToGoal(id, { amountCentimes, accountId = null }) {
  const response = await api.post(`/goals/${id}/contribute`, {
    amount: Math.trunc(amountCentimes) || 0,
    account_id: accountId,
  });
  return response.data?.data ?? response.data;
}

function toPayload({ name, targetCentimes, currency, targetDate, icon, color }) {
  return {
    name,
    target_amount: Math.trunc(targetCentimes) || 0,
    currency,
    target_date: targetDate ?? null,
    icon: icon || null,
    color: color || null,
  };
}

/** The goal was archived elsewhere, or never belonged to this user. */
export function isGoalMissing(error) {
  return error?.response?.status === 404;
}

/**
 * A translated message for a failed goal request.
 *
 * The API's 422 messages are English sentences, so each field the forms can
 * get wrong is mapped to the active language. Anything unmapped still shows
 * the server's own text rather than a vague "error".
 */
export function describeGoalError(error) {
  const bag = error?.response?.data?.errors;
  if (error?.response?.status !== 422 || !bag) {
    return describeApiError(error);
  }

  if (bag.account_id) {
    // "The account and the goal must use the same currency (EUR vs MAD)."
    const match = /\(([A-Z]{3}) vs ([A-Z]{3})\)/.exec(String(bag.account_id[0]));
    return match
      ? t("goals.errors.currency_mismatch", { account: match[1], goal: match[2] })
      : t("goals.errors.account_invalid");
  }

  const FIELD_KEYS = {
    name: "goals.errors.name",
    target_amount: "goals.errors.target_amount",
    amount: "goals.errors.amount",
    currency: "goals.errors.currency",
    target_date: "goals.errors.target_date",
    icon: "goals.errors.icon",
    color: "goals.errors.color",
  };
  const field = Object.keys(FIELD_KEYS).find((key) => bag[key]);
  return field ? t(FIELD_KEYS[field]) : describeValidationError(error);
}
