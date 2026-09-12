/**
 * Dates arrive as ISO8601 strings in UTC. They are rendered in the user's own
 * timezone — the one the API reports in `period.timezone` — so a transaction
 * booked late at night in Casablanca never shows up on the wrong day because
 * the device happens to be set to another zone.
 *
 * Intl with a `timeZone` option is not guaranteed on every Hermes build, so
 * every call is guarded and falls back to reading the UTC parts of the string.
 */

export const MONTH_NAMES = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "ماي",
  "يونيو",
  "يوليوز",
  "غشت",
  "شتنبر",
  "أكتوبر",
  "نونبر",
  "دجنبر",
];

/** "2026-09" => "شتنبر 2026" */
export function monthLabel(period) {
  const raw = period?.month;
  if (typeof raw !== "string") {
    return "";
  }
  const [year, month] = raw.split("-");
  const name = MONTH_NAMES[Number(month) - 1];
  return name ? `${name} ${year}` : raw;
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

  const parts = {
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  };
  const partsOf = (value) => ({
    year: value.getFullYear(),
    month: value.getMonth() + 1,
    day: value.getDate(),
  });

  if (sameDay(parts, partsOf(now))) {
    return "اليوم";
  }
  if (sameDay(parts, partsOf(new Date(now.getTime() - 24 * 60 * 60 * 1000)))) {
    return "أمس";
  }

  const name = MONTH_NAMES[parts.month - 1];
  return name
    ? `${parts.day} ${name} ${parts.year}`
    : `${parts.day}/${parts.month}/${parts.year}`;
}

/** Calendar parts of `date` as seen in `timeZone`, or null if unsupported. */
function partsInZone(date, timeZone) {
  if (!timeZone) {
    return null;
  }
  try {
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
 * "اليوم" / "أمس" for the two most recent days, otherwise "9 شتنبر 2026".
 * Returns "" for a missing or unparseable value so a row never renders "NaN".
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
    return "اليوم";
  }
  if (sameDay(parts, yesterday)) {
    return "أمس";
  }

  const name = MONTH_NAMES[parts.month - 1];
  return name
    ? `${parts.day} ${name} ${parts.year}`
    : `${parts.day}/${parts.month}/${parts.year}`;
}
