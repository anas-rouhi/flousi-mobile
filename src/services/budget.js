import api from "./api";

/**
 * Monthly budget. Verified against the live API.
 *
 *   GET /api/v1/budgets/current
 *     200 { "data": {
 *             "is_configured": false,          // true once a limit is saved
 *             "id": "<uuid>|null",
 *             "currency": "MAD",
 *             "period": { "month": 9, "year": 2026, "label": "…",
 *                         "timezone": "Africa/Casablanca", … },
 *             "total_limit": { "amount": 500000, "amount_decimal": "5000.00",
 *                              "amount_formatted": "5 000,00 DH" },
 *             "total_spent": { …same shape… },
 *             "remaining":   { …same shape… },  // negative once over the limit
 *             "spent_percentage": 42.5,         // null when no limit
 *             "status": "safe" | "warning" | "exceeded" | null,
 *             "categories": [ … per-category caps … ]
 *         } }
 *
 *   POST /api/v1/budgets
 *     { "total_limit": 500000, "month": 9, "year": 2026 }
 *
 * Two things to keep straight:
 *
 *  - The field is `total_limit`, an INTEGER IN CENTIMES (500000 = 5 000,00 DH),
 *    like `POST /accounts` and unlike `POST /transactions` (major units).
 *  - `month` is a NUMBER 1-12 with a separate `year`, not a "YYYY-MM" string.
 *    The two are `required_with` each other, so they are sent as a pair or not
 *    at all; omitting both means the user's current month.
 *
 * A budget that already exists for the month is replaced, so the "edit limit"
 * action needs no separate PUT. `status` uses the same 80% / 100% thresholds
 * the card colours by, so the server's verdict is preferred over a local one.
 *
 * The endpoint reports `total_spent` even when `is_configured` is false, which
 * is why the empty state can still sit next to a real spending figure.
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
 * Creates or replaces the budget for a month.
 *
 * @param {{ limitCentimes: number, month?: number, year?: number }} budget
 *   `month` is 1-12 and must be paired with `year`; omit both for the user's
 *   current month.
 */
export async function saveBudget({ limitCentimes, month, year }) {
  const total = Math.trunc(limitCentimes) || 0;

  // month and year are `required_with` each other server-side, so a lone one
  // would be rejected — they travel as a pair or not at all.
  const period = Number.isInteger(month) && Number.isInteger(year)
    ? { month, year }
    : {};

  const response = await api.post("/budgets", {
    total_limit: total,
    // Kept alongside as a harmless fallback: `total_limit` is the validated
    // field, and unlisted keys are ignored by the form request.
    limit: total,
    ...period,
  });
  return response.data?.data ?? response.data;
}

/** True when the failure is the endpoint being absent rather than a bad request. */
export function isBudgetEndpointMissing(error) {
  return isMissingBudget(error);
}
