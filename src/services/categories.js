import api from "./api";

/**
 * GET /api/v1/categories
 *
 * The system catalogue plus the user's own. `name` is already resolved into the
 * user's preferred language by CategoryResource, so nothing is translated here.
 *
 * @param {{ type?: "expense"|"income" }} options omit `type` to fetch both, which
 *   lets the form switch between expense and income without another round trip.
 */
export async function fetchCategories({ type } = {}) {
  const response = await api.get("/categories", {
    params: type ? { type } : undefined,
  });
  return response.data?.data ?? [];
}
