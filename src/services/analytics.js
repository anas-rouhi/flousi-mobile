import api from "./api";

/**
 * GET /api/v1/analytics/monthly
 *
 * Verified contract:
 *   ?month=9&year=2026 — both optional and, unlike the transactions index,
 *   independent of each other: `?month=8` means August of the current year.
 *
 *   { "data": {
 *       "currency": "MAD",
 *       "period": { "month": 9, "year": 2026, "label": "شتنبر 2026",
 *                   "timezone": "Africa/Casablanca" },
 *       "summary": {
 *         "total_income": 0,  "total_income_formatted": "0,00 DH",
 *         "total_expense": 550000, "total_expense_formatted": "5 500,00 DH",
 *         "net_savings": -550000,  "net_savings_formatted": "-5 500,00 DH",
 *         "savings_rate_percentage": null
 *       },
 *       "categories": [ { "id", "name", "icon", "color",
 *                         "spent": 550000, "spent_formatted": "5 500,00 DH",
 *                         "transactions_count": 3, "percentage": 100 } ],
 *       "daily_trend": [ { "day": 1, "date": "2026-09-01",
 *                          "expense": 0, "expense_formatted": "0,00 DH",
 *                          "income": 0,  "income_formatted": "0,00 DH" } ]
 *   } }
 *
 * Note the shape differs from the budget endpoint: money here is a flat integer
 * with a sibling `*_formatted` string, not a nested `{ amount, … }` object. And
 * category rows key on `id` / `spent`, not `category_id` / `amount`.
 *
 * `period.label` arrives localised ("شتنبر 2026") — but in the *account's*
 * language, which need not match the UI's, so the month switcher builds its
 * label on the client with Intl instead.
 *
 * `daily_trend` covers every day of the month, including empty ones, so a chart
 * can plot a full axis without filling gaps itself.
 */
export async function fetchMonthlyAnalytics({ month, year, signal } = {}) {
  const params = {};
  if (Number.isInteger(month)) {
    params.month = month;
  }
  if (Number.isInteger(year)) {
    params.year = year;
  }

  const response = await api.get("/analytics/monthly", {
    params: Object.keys(params).length ? params : undefined,
    signal,
  });
  return response.data?.data ?? null;
}
