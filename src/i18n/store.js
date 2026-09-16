import ar from "./ar";
import en from "./en";
import fr from "./fr";
import {
  DEFAULT_LANGUAGE,
  isSupportedLanguage,
  languageConfig,
} from "./languages";

/**
 * The active language, held at module level.
 *
 * Services format error messages outside any component (`describeApiError`),
 * so `t()` cannot depend on React context. LocaleProvider is the only writer:
 * it pushes the language in here before committing its own state, so by the
 * time anything re-renders, `t()` already resolves against the new dictionary.
 */
const DICTIONARIES = { ar, fr, en };

let current = DEFAULT_LANGUAGE;

export function setI18nLanguage(language) {
  if (isSupportedLanguage(language)) {
    current = language;
  }
}

export function getLanguage() {
  return current;
}

/** The Intl locale of the active language ("ar-MA", "fr-FR", "en-US"). */
export function getLocale() {
  return languageConfig(current).locale;
}

function lookup(dictionary, key) {
  return key
    .split(".")
    .reduce(
      (node, part) => (node && typeof node === "object" ? node[part] : undefined),
      dictionary,
    );
}

/**
 * Picks `key_one` / `key_other` when a numeric `count` is passed and the
 * dictionary defines them; otherwise the plain key.
 */
function resolve(dictionary, key, params) {
  if (typeof params?.count === "number") {
    const plural = lookup(dictionary, `${key}_${params.count === 1 ? "one" : "other"}`);
    if (typeof plural === "string") {
      return plural;
    }
  }
  const value = lookup(dictionary, key);
  return typeof value === "string" ? value : undefined;
}

/**
 * Translates `key` into the active language, interpolating `{placeholder}`s.
 *
 * A key missing from the active dictionary falls back to the default language,
 * then to the key itself — a visible key is a bug report, a blank label is not.
 */
export function t(key, params) {
  const template =
    resolve(DICTIONARIES[current], key, params) ??
    resolve(DICTIONARIES[DEFAULT_LANGUAGE], key, params);

  if (template === undefined) {
    if (__DEV__) {
      console.warn(`[i18n] missing key "${key}" for "${current}"`);
    }
    return key;
  }
  if (!params) {
    return template;
  }
  return template.replace(/\{(\w+)\}/g, (match, name) =>
    params[name] === undefined || params[name] === null
      ? match
      : String(params[name]),
  );
}
