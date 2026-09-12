import api from "./api";

/**
 * Monthly budget.
 *
 * ⚠️ These endpoints DO NOT EXIST on the API yet — both `/budgets/current` and
 * `/budgets` return 404 as of this writing. The client is written against the
 * contract below so the UI is finished and ready; until the backend lands, the
 * card renders its "no budget set" state and saving reports a clear error.
 *
 * Expected contract, following the conventions the rest of the API already uses
 * (integer centimes are authoritative, `*_formatted` strings are display-only):
 *
 *   GET /api/v1/budgets/current
 *     200 { "data": {
 *             "id": "<uuid>",
 *             "currency": "MAD",
 *             "period": { "month": "2026-09", "timezone": "Africa/Casablanca" },
 *             "limit":     { "amount": 500000, "amount_decimal": "5000.00",
 *                            "amount_formatted": "5 000,00 DH" },
 *             "spent":     { …same shape… },   // optional, see below
 *             "remaining": { …same shape… },   // optional
 *             "percentage": 42.5               // optional
 *         } }
 *     404, or 200 with "data": null, when no budget is set for the month.
 *
 *   POST /api/v1/budgets
 *     { "limit": 500000, "month": "2026-09" }
 *     `limit` is an INTEGER IN CENTIMES, matching `POST /accounts`
 *     (`opening_balance`) rather than `POST /transactions` (major units).
 *     Returns 200/201 with the same resource. Posting again for a month that
 *     already has a budget should update it, so the client needs no separate
 *     PUT for the "edit limit" action.
 *
 * `spent`, `remaining` and `percentage` are optional on purpose: the dashboard
 * already knows the month's expenses, so the hook derives them when absent.
 * That keeps a minimal backend — one that only stores a limit — fully usable,
 * and it is why the progress bar updates the instant an expense is saved.
 */

/** Treated as "no budget yet" rather than an error. */
function isMissingBudget(error) {
  return error?.response?.status === 404;
}

/**
 * @returns {Promise<object|null>} the budget, or null when none is set for the
 *   current month (including while the endpoint itself is absent).
 */
export async function fetchCurrentBudget() {
  try {
    const response = await api.get("/budgets/current");
    return response.data?.data ?? null;
  } catch (error) {
    if (isMissingBudget(error)) {
      return null;
    }
    throw error;
  }
}

/**
 * Creates or updates the budget for a month.
 *
 * @param {{ limitCentimes: number, month?: string }} budget `month` as
 *   "YYYY-MM"; omitted means the current month in the user's timezone.
 */
export async function saveBudget({ limitCentimes, month }) {
  const response = await api.post("/budgets", {
    limit: Math.trunc(limitCentimes) || 0,
    ...(month ? { month } : {}),
  });
  return response.data?.data ?? response.data;
}

/** True when the failure is the endpoint being absent rather than a bad request. */
export function isBudgetEndpointMissing(error) {
  return isMissingBudget(error);
}
