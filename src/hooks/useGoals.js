import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { describeApiError } from "../services/api";
import { deleteGoal, fetchGoals, isGoalMissing } from "../services/goals";

/**
 * The user's active savings goals.
 *
 * Loads when the screen gains focus, not just on mount: a contribution booked
 * from an account also shows up on other tabs, and returning to Goals after
 * one should never show yesterday's progress. Only the very first load shows
 * the full-screen spinner; later ones refresh in place.
 */
export function useGoals() {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const loadedOnce = useRef(false);
  const requestSeq = useRef(0);

  const load = useCallback(async () => {
    const seq = ++requestSeq.current;
    setError(null);
    try {
      const rows = await fetchGoals();
      if (seq === requestSeq.current) {
        setGoals(rows);
        loadedOnce.current = true;
      }
    } catch (err) {
      console.log("Goals load failed:", err.response?.data || err.message);
      // A 401 is handled globally (sign-out); the message still explains it.
      if (seq === requestSeq.current) {
        setError(describeApiError(err));
      }
    } finally {
      if (seq === requestSeq.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const refresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  /** Puts a created or updated goal in place without waiting for a refetch. */
  const upsert = useCallback((goal) => {
    if (!goal?.id) {
      return;
    }
    setGoals((current) =>
      current.some((row) => row.id === goal.id)
        ? current.map((row) => (row.id === goal.id ? goal : row))
        : [goal, ...current],
    );
  }, []);

  /**
   * Archives a goal. A 404 means it is already gone (archived from another
   * device), which is the outcome the user wanted — so the list is refetched
   * and the call reports success rather than an error.
   *
   * @returns {Promise<{ ok: boolean, error?: string }>}
   */
  const remove = useCallback(
    async (id) => {
      try {
        await deleteGoal(id);
        setGoals((current) => current.filter((row) => row.id !== id));
        return { ok: true };
      } catch (err) {
        if (isGoalMissing(err)) {
          await load();
          return { ok: true };
        }
        console.log("Goal delete failed:", err.response?.data || err.message);
        return { ok: false, error: describeApiError(err) };
      }
    },
    [load],
  );

  return {
    goals,
    loading: loading && !loadedOnce.current,
    refreshing,
    error,
    reload: load,
    refresh,
    upsert,
    remove,
  };
}
