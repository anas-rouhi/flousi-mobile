import api from "./api";

/**
 * GET /api/v1/stats/dashboard
 *
 * Single source of truth for the dashboard: balance total, monthly income vs
 * expenses and the expense breakdown per category — all already aggregated and
 * formatted server-side, in the user's currency and timezone.
 *
 * @param {{ month?: string, signal?: AbortSignal }} options month as "YYYY-MM";
 *   omitted means the current month in the user's own timezone.
 */
export async function fetchDashboardStats({ month, signal } = {}) {
  const response = await api.get("/stats/dashboard", {
    params: month ? { month } : undefined,
    signal,
  });

  // JsonResource wraps the payload in `data`.
  return response.data?.data ?? response.data;
}
