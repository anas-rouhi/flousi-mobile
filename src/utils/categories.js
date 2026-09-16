import { getLanguage } from "../i18n/store";

/**
 * Category names in the UI language.
 *
 * The API names categories in the account's stored `preferred_language`, not
 * in the language on screen, so `category.name` alone would stay Arabic after
 * switching to French. What it does send is `translations` — `{ ar, fr, en }`
 * for every system category — on /categories and on each transaction's
 * embedded category. That map is preferred here.
 *
 * Aggregate rows (the dashboard breakdown, analytics) carry only an id and the
 * server-resolved `name`, so translations seen anywhere are remembered by id
 * and reused for those rows. User-created categories have no translations and
 * keep the name the user typed.
 */
const catalog = new Map();

/** Records the translations of every category in `list`. */
export function rememberCategories(list) {
  for (const category of list ?? []) {
    if (category?.id && category.translations) {
      catalog.set(category.id, category.translations);
    }
  }
}

/**
 * @param {object} category any row with a `name`, and ideally `translations`
 * @param {string} [id] the category id when the row's own `id` is not it
 *   (dashboard rows key on `category_id`)
 */
export function categoryName(category, id) {
  if (!category) {
    return null;
  }
  const language = getLanguage();
  return (
    category.translations?.[language] ||
    catalog.get(id ?? category.id)?.[language] ||
    category.name
  );
}
