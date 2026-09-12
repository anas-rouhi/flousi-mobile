import { useCallback, useEffect, useState } from "react";
import { describeApiError } from "../services/api";
import {
  fetchCurrentBudget,
  isBudgetEndpointMissing,
  saveBudget,
} from "../services/budget";
import { centimesOf } from "../utils/money";

/** Budget health, from the share of the limit already spent. */
export const BUDGET_STATE = {
  healthy: "healthy", // under 80%
  warning: "warning", // 80–99%
  over: "over", // 100% or more
};

export function budgetStateFor(percentage) {
  if (percentage >= 100) {
    return BUDGET_STATE.over;
  }
  if (percentage >= 80) {
    return BUDGET_STATE.warning;
  }
  return BUDGET_STATE.healthy;
}

/**
 * Loads the current month's budget and derives its progress.
 *
 * `spentCentimes` comes from the caller — the dashboard's
 * `month.expenses.amount` — rather than from the budget endpoint. Two reasons:
 * the figure is already on screen, so no extra request is needed; and because
 * the dashboard reloads after every saved transaction, the progress bar moves
 * the moment an expense is recorded, with no budget refetch at all.
 *
 * If the API does supply `spent`, that wins — the server is the authority.
 *
 * @param {{ spentCentimes?: number, enabled?: boolean }} options
 */
export function useBudget({ spentCentimes = 0, enabled = true } = {}) {
  const [budget, setBudget] = useState(null);
  const [loading, setLoading] = useState(enabled);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [unavailable, setUnavailable] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setBudget(await fetchCurrentBudget());
      setUnavailable(false);
    } catch (err) {
      console.log("Budget load failed:", err.response?.data || err.message);
      setError(describeApiError(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) {
      load();
    }
  }, [enabled, load]);

  const save = useCallback(
    async ({ limitCentimes, month }) => {
      setSaving(true);
      setError(null);
      try {
        const saved = await saveBudget({ limitCentimes, month });
        setBudget(saved);
        setUnavailable(false);
        return saved;
      } catch (err) {
        console.log("Budget save failed:", err.response?.data || err.message);
        if (isBudgetEndpointMissing(err)) {
          // Distinguished from a genuine failure so the UI can say the feature
          // is not on the server yet instead of blaming the input.
          setUnavailable(true);
          setError("خدمة الميزانية مامفعّلة فـ السيرفر حتى دابا");
        } else {
          setError(describeApiError(err));
        }
        return null;
      } finally {
        setSaving(false);
      }
    },
    [],
  );

  const limitCentimes = centimesOf(budget?.limit);
  // Server figure wins; otherwise the month's expenses stand in.
  const spent = budget?.spent ? centimesOf(budget.spent) : spentCentimes;

  const percentage =
    limitCentimes > 0
      ? Number.isFinite(budget?.percentage)
        ? budget.percentage
        : (spent / limitCentimes) * 100
      : 0;

  return {
    budget,
    hasBudget: limitCentimes > 0,
    limitCentimes,
    spentCentimes: spent,
    // Integer centimes throughout: positive means money left, negative means
    // the limit was exceeded by that much.
    remainingCentimes: limitCentimes - spent,
    percentage,
    state: budgetStateFor(percentage),
    currency: budget?.currency,
    period: budget?.period,
    loading,
    saving,
    error,
    unavailable,
    reload: load,
    save,
  };
}
