import { rememberCategories } from "../utils/categories";
import api from "./api";

/**
 * GET /api/v1/categories
 *
 * The system catalogue plus the user's own. `name` is resolved into the
 * account's preferred language by CategoryResource, which is not necessarily
 * the UI's — display goes through `categoryName()`, which prefers the
 * `translations` map every row also carries.
 *
 * @param {{ type?: "expense"|"income" }} options omit `type` to fetch both, which
 *   lets the form switch between expense and income without another round trip.
 */
export async function fetchCategories({ type } = {}) {
  const response = await api.get("/categories", {
    params: type ? { type } : undefined,
  });
  const rows = response.data?.data ?? [];
  rememberCategories(rows);
  return rows;
}

let catalogRequest = null;

/**
 * Loads the catalogue once per session so aggregate rows (which carry no
 * translations of their own) can be named in the UI language.
 *
 * Never rejects: a missing catalogue only means those rows keep the server's
 * name, which is no reason to fail the screen that asked. A failed attempt is
 * forgotten so the next screen load tries again.
 */
export function primeCategoryCatalog() {
  if (!catalogRequest) {
    catalogRequest = fetchCategories().catch((error) => {
      console.log("Category catalogue load failed:", error.message);
      catalogRequest = null;
    });
  }
  return catalogRequest;
}
