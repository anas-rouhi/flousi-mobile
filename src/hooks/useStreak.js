import { useCallback, useEffect, useRef, useState } from "react";
import { fetchStreak } from "../services/streak";

/**
 * The logging streak for the dashboard badge.
 *
 * Failure is silent: the badge is a garnish, and the dashboard already reports
 * connectivity problems through its own figures. A failed load keeps whatever
 * was shown before.
 */
export function useStreak() {
  const [streak, setStreak] = useState(null);
  const request = useRef(null);

  const reload = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    try {
      const next = await fetchStreak({ signal: controller.signal });
      if (!controller.signal.aborted) {
        setStreak(next);
      }
    } catch (err) {
      if (!controller.signal.aborted) {
        console.log("Streak load failed:", err.response?.data || err.message);
      }
    }
  }, []);

  useEffect(() => {
    reload();
    return () => request.current?.abort();
  }, [reload]);

  return { streak, reload };
}
