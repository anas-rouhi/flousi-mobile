/**
 * The languages the app (and the API) speak, with what each one needs to
 * render: its layout direction and the Intl locale dates are formatted with.
 *
 * Kept free of any React Native import so the translation store and the date
 * utilities can depend on it without pulling the platform in.
 *
 * `label` is the language's own name (an endonym) and is never translated — a
 * picker must stay readable to someone who does not read the active language.
 */
export const LANGUAGES = [
  { value: "ar", label: "العربية", dir: "rtl", rtl: true, locale: "ar-MA" },
  { value: "fr", label: "Français", dir: "ltr", rtl: false, locale: "fr-FR" },
  { value: "en", label: "English", dir: "ltr", rtl: false, locale: "en-US" },
];

export const DEFAULT_LANGUAGE = "ar";

/**
 * Currencies the API can store and format (`Money::supportedCurrencies()`).
 * Codes are ISO and never translated; symbols come from utils/money.
 */
export const CURRENCIES = ["MAD", "EUR", "USD", "GBP"];

export function isSupportedLanguage(language) {
  return LANGUAGES.some((l) => l.value === language);
}

/** The config for a language, falling back to the default one. */
export function languageConfig(language) {
  return (
    LANGUAGES.find((l) => l.value === language) ??
    LANGUAGES.find((l) => l.value === DEFAULT_LANGUAGE)
  );
}
