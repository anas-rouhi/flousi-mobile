import * as SecureStore from "../platform/storage";
import { zonedDayKey } from "../utils/date";
import { fetchMonthlyAnalytics } from "./analytics";

/**
 * Logging streak: consecutive days, ending today, with at least one
 * transaction on them.
 *
 * There is no streak endpoint, so this is derived from `daily_trend` of
 * GET /analytics/monthly — every day of a month with its income and expense,
 * already bucketed in the user's own timezone by the server. The current month
 * is always fetched; earlier months only while the streak keeps reaching back
 * into them, so a typical load is a single request.
 *
 * Today not being logged *yet* does not break the streak — it runs until the
 * day is over — so counting starts from yesterday in that case.
 */

/** A streak older than this many months is reported as a floor, not exact. */
const MAX_MONTHS_BACK = 12;
const BEST_KEY = "streak_best";

function pad(value) {
  return String(value).padStart(2, "0");
}

/** "2026-09-01" → "2026-08-31", in pure calendar arithmetic. */
function previousDay(key) {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day - 1));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function monthOf(key) {
  const [year, month] = key.split("-").map(Number);
  return { year, month };
}

function monthId({ year, month }) {
  return `${year}-${pad(month)}`;
}

/** Adds the logged days of one month's trend to `active`. */
function collectActiveDays(analytics, active) {
  for (const day of analytics?.daily_trend ?? []) {
    if (day?.date && ((day.expense || 0) > 0 || (day.income || 0) > 0)) {
      active.add(day.date);
    }
  }
}

async function readBest() {
  try {
    return Number(await SecureStore.getItemAsync(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

async function writeBest(value) {
  try {
    await SecureStore.setItemAsync(BEST_KEY, String(value));
  } catch {
    // Only a record; losing it costs nothing but a badge's memory.
  }
}

/**
 * @returns {Promise<{
 *   current: number,        // days in the running streak
 *   loggedToday: boolean,   // false while today is still open to extend it
 *   best: number,           // best streak ever seen on this device
 *   activeDaysThisMonth: number,
 * }>}
 */
export async function fetchStreak({ signal } = {}) {
  const active = new Set();
  const loaded = new Set();

  const current = await fetchMonthlyAnalytics({ signal });
  collectActiveDays(current, active);

  const timezone = current?.period?.timezone;
  const today = zonedDayKey(new Date().toISOString(), timezone);
  const thisMonth = current?.period?.month
    ? { year: current.period.year, month: current.period.month }
    : monthOf(today);
  loaded.add(monthId(thisMonth));

  const loggedToday = active.has(today);
  let cursor = loggedToday ? today : previousDay(today);
  let streak = 0;

  for (;;) {
    const month = monthOf(cursor);
    if (!loaded.has(monthId(month))) {
      if (loaded.size > MAX_MONTHS_BACK) {
        break;
      }
      loaded.add(monthId(month));
      collectActiveDays(await fetchMonthlyAnalytics({ ...month, signal }), active);
    }
    if (!active.has(cursor)) {
      break;
    }
    streak += 1;
    cursor = previousDay(cursor);
  }

  const prefix = `${monthId(thisMonth)}-`;
  const activeDaysThisMonth = [...active].filter((key) => key.startsWith(prefix)).length;

  const storedBest = await readBest();
  const best = Math.max(storedBest, streak);
  if (best > storedBest) {
    writeBest(best);
  }

  return { current: streak, loggedToday, best, activeDaysThisMonth };
}
