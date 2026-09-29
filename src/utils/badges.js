import { BUDGET_STATE } from "../hooks/useBudget";
import { centimesOf } from "./money";

/**
 * Achievement badges, derived on the client from figures the dashboard already
 * holds — there is no badge endpoint. Each one reports its progress so a locked
 * badge can show how close it is ("4 / 7").
 *
 * Names and descriptions are i18n keys: `badges.<id>.name` / `.desc`.
 */
const DEFINITIONS = [
  { id: "first_step", glyph: "👣", target: 1, measure: (m) => m.bestStreak },
  { id: "streak_3", glyph: "🔥", target: 3, measure: (m) => m.bestStreak },
  { id: "streak_7", glyph: "⚡", target: 7, measure: (m) => m.bestStreak },
  { id: "streak_30", glyph: "👑", target: 30, measure: (m) => m.bestStreak },
  { id: "regular", glyph: "📅", target: 15, measure: (m) => m.activeDaysThisMonth },
  { id: "saver", glyph: "🐷", target: 1, measure: (m) => (m.netCentimes > 0 ? 1 : 0) },
  // Measured in whole percent so the progress bar reads naturally.
  { id: "super_saver", glyph: "💎", target: 20, measure: (m) => Math.max(0, Math.floor(m.savingsRate)) },
  { id: "budget_keeper", glyph: "🛡️", target: 1, measure: (m) => (m.budgetKept ? 1 : 0) },
];

/**
 * @param {{ streak?: object, stats?: object, budget?: object }} sources
 * @returns {{ id, glyph, target, value, unlocked, progress }[]}
 */
export function computeBadges({ streak, stats, budget }) {
  const income = centimesOf(stats?.month?.income);
  const expenses = centimesOf(stats?.month?.expenses);
  const net = income - expenses;

  const metrics = {
    bestStreak: Math.max(streak?.best ?? 0, streak?.current ?? 0),
    activeDaysThisMonth: streak?.activeDaysThisMonth ?? 0,
    netCentimes: net,
    savingsRate: income > 0 ? (net / income) * 100 : 0,
    budgetKept: Boolean(budget?.hasBudget) && budget?.state === BUDGET_STATE.healthy,
  };

  return DEFINITIONS.map(({ id, glyph, target, measure }) => {
    const value = measure(metrics);
    return {
      id,
      glyph,
      target,
      value: Math.min(value, target),
      unlocked: value >= target,
      progress: Math.min(value / target, 1),
    };
  });
}
