import { getLocale, t } from "../i18n/store";

/**
 * Dates arrive as ISO8601 strings in UTC. They are rendered in the user's own
 * timezone — the one the API reports in `period.timezone` — so a transaction
 * booked late at night in Casablanca never shows up on the wrong day because
 * the device happens to be set to another zone.
 *
 * Names (months, "today") follow the *app's* language through Intl with the
 * active locale (ar-MA / fr-FR / en-US), not the device's. Intl support varies
 * across Hermes builds, so every call is guarded: calendar maths falls back to
 * the UTC parts of the value, and names fall back to a numeric d/m/yyyy.
 */

/** Tries the active locale, then its bare language ("ar-MA" → "ar"). */
function localesFor(locale = getLocale()) {
  const base = locale.split("-")[0];
  return base === locale ? [locale] : [locale, base];
}

/** Formats `date` with Intl, or returns null when the engine cannot. */
function intlFormat(date, options) {
  try {
    return new Intl.DateTimeFormat(localesFor(), options).format(date);
  } catch {
    return null;
  }
}

/**
 * A calendar day built at UTC noon, formatted with `timeZone: "UTC"`, so the
 * day printed is exactly the parts given — no device offset can shift it.
 */
function calendarDate({ year, month, day = 1 }) {
  return new Date(Date.UTC(year, month - 1, day, 12));
}

/** "September" / "septembre" / "شتنبر" for a 1-12 month. */
export function monthName(month, year = 2000) {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return "";
  }
  return (
    intlFormat(calendarDate({ year, month }), {
      month: "long",
      timeZone: "UTC",
    }) ?? String(month)
  );
}

/** "September 2026" / "septembre 2026" / "شتنبر 2026". */
export function formatMonthYear(month, year) {
  if (!Number.isInteger(month) || !Number.isInteger(year)) {
    return "";
  }
  return (
    intlFormat(calendarDate({ year, month }), {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }) ?? `${month}/${year}`
  );
}

/** Dashboard period ({ month: "2026-09" }) => "September 2026", localised. */
export function monthLabel(period) {
  const raw = period?.month;
  if (typeof raw !== "string") {
    return "";
  }
  const [year, month] = raw.split("-").map(Number);
  return formatMonthYear(month, year) || raw;
}

/** "9 September 2026", localised; numeric when Intl is unavailable. */
function formatDay(parts) {
  return (
    intlFormat(calendarDate(parts), {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }) ?? `${parts.day}/${parts.month}/${parts.year}`
  );
}

function localParts(value) {
  return {
    year: value.getFullYear(),
    month: value.getMonth() + 1,
    day: value.getDate(),
  };
}

/**
 * Labels a Date already expressed in device-local time — a day the user picked
 * in a form, not an instant that came back from the API. Reading the local
 * parts directly avoids the trap of round-tripping local midnight through UTC,
 * which lands on the previous day everywhere east of Greenwich.
 */
export function formatLocalDay(date, now = new Date()) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return "";
  }

  const parts = localParts(date);

  if (sameDay(parts, localParts(now))) {
    return t("common.today");
  }
  if (sameDay(parts, localParts(new Date(now.getTime() - 24 * 60 * 60 * 1000)))) {
    return t("common.yesterday");
  }
  return formatDay(parts);
}

/** Calendar parts of `date` as seen in `timeZone`, or null if unsupported. */
function partsInZone(date, timeZone) {
  if (!timeZone) {
    return null;
  }
  try {
    // A fixed Latin-digit locale: these parts are parsed as numbers, never shown.
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);

    const find = (type) => parts.find((part) => part.type === type)?.value;
    const year = find("year");
    const month = find("month");
    const day = find("day");

    if (!year || !month || !day) {
      return null;
    }
    return { year: Number(year), month: Number(month), day: Number(day) };
  } catch {
    // Engine without full ICU — fall back to UTC below.
    return null;
  }
}

/** Calendar parts in `timeZone`, degrading to the UTC parts of the value. */
function calendarParts(date, timeZone) {
  return (
    partsInZone(date, timeZone) ?? {
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
    }
  );
}

function sameDay(a, b) {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

/**
 * Stable "YYYY-MM-DD" for an API timestamp as seen in the user's timezone —
 * the key transactions are grouped by on the dashboard. Deriving it in the
 * user's zone (not the device's, and not UTC) is what keeps a late-evening
 * transaction in the day the user actually made it.
 */
export function zonedDayKey(iso, timeZone) {
  if (!iso) {
    return null;
  }

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const { year, month, day } = calendarParts(date, timeZone);
  const pad = (value) => String(value).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}`;
}

/**
 * "Today" / "Yesterday" for the two most recent days, otherwise the full
 * localised date. Returns "" for a missing or unparseable value so a row never
 * renders "NaN".
 */
export function formatTransactionDate(iso, timeZone, now = new Date()) {
  if (!iso) {
    return "";
  }

  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const parts = calendarParts(date, timeZone);
  const today = calendarParts(now, timeZone);
  const yesterday = calendarParts(
    new Date(now.getTime() - 24 * 60 * 60 * 1000),
    timeZone,
  );

  if (sameDay(parts, today)) {
    return t("common.today");
  }
  if (sameDay(parts, yesterday)) {
    return t("common.yesterday");
  }
  return formatDay(parts);
}
