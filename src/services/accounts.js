import api from "./api";

/**
 * GET /api/v1/accounts
 *
 * Returns the caller's live accounts (soft-deleted ones are excluded by the
 * model's default scope), newest first — so the first entry is a sensible
 * default selection in the quick-entry form.
 */
export async function fetchAccounts() {
  const response = await api.get("/accounts");
  return response.data?.data ?? [];
}
