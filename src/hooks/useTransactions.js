import { useCallback, useEffect, useRef, useState } from "react";
import { describeApiError } from "../services/api";
import {
  deleteTransaction,
  fetchTransactions,
} from "../services/transactions";

const PER_PAGE = 20;

/** Long enough to skip intermediate keystrokes, short enough to feel live. */
const SEARCH_DEBOUNCE_MS = 350;

/**
 * Paginated transaction history, filtered entirely server-side.
 *
 * Request coordination is by sequence number, not by a busy flag. An earlier
 * version refused to start a request while one was in flight, which silently
 * dropped every keystroke after the first: the screen kept showing the first
 * term's results (or nothing) no matter what was typed. Here every call is
 * issued, superseded ones are aborted, and only the newest response is allowed
 * to write state — so the latest term always wins even if responses land out of
 * order.
 *
 * The API matches `search` against `description` only.
 */
export function useTransactions({ type = null } = {}) {
  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  /**
   * What the rows on screen actually correspond to. Until this matches the
   * current filter, the screen is showing the previous term's results and must
   * not claim "no results".
   */
  const [applied, setApplied] = useState(null);

  const requestSeq = useRef(0);
  const controller = useRef(null);
  // Separate from the sequence guard: pagination may not double-fire on scroll,
  // but a new search must never be blocked by one.
  const appending = useRef(false);
  const mounted = useRef(true);

  useEffect(
    () => () => {
      mounted.current = false;
      controller.current?.abort();
    },
    [],
  );

  // Debounce: `query` drives the input, `term` drives the request.
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed === term) {
      return;
    }
    const timer = setTimeout(() => setTerm(trimmed), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, term]);

  const load = useCallback(
    async (targetPage, { append = false } = {}) => {
      if (append) {
        if (appending.current) {
          return;
        }
        appending.current = true;
      } else {
        // A fresh query supersedes anything still in flight.
        controller.current?.abort();
        controller.current = new AbortController();
      }

      const seq = ++requestSeq.current;
      const signal = append ? undefined : controller.current.signal;
      const requestedTerm = term;
      const requestedType = type;

      setError(null);

      try {
        const result = await fetchTransactions({
          page: targetPage,
          perPage: PER_PAGE,
          search: requestedTerm || undefined,
          type: requestedType ?? undefined,
          signal,
        });

        // A newer request has since been issued — this answer is stale.
        if (seq !== requestSeq.current || !mounted.current) {
          return;
        }

        setRows((current) => (append ? [...current, ...result.rows] : result.rows));
        setPage(result.page);
        setLastPage(result.lastPage);
        setTotal(result.total);
        setApplied({ term: requestedTerm, type: requestedType ?? null });
      } catch (err) {
        // An aborted request was replaced on purpose; it is not a failure.
        if (err?.code === "ERR_CANCELED" || err?.name === "CanceledError") {
          return;
        }
        if (seq !== requestSeq.current || !mounted.current) {
          return;
        }
        console.log("Transactions load failed:", err.response?.data || err.message);
        setError(describeApiError(err));
        setApplied({ term: requestedTerm, type: requestedType ?? null });
      } finally {
        if (append) {
          appending.current = false;
        }
        if (seq === requestSeq.current && mounted.current) {
          setLoading(false);
          setRefreshing(false);
          setLoadingMore(false);
        }
      }
    },
    [type, term],
  );

  /**
   * A changed term or filter restarts at page 1.
   *
   * Rows are deliberately *not* cleared here: emptying the list while the
   * request is still in flight renders as "no results" for a moment. They are
   * replaced when the matching response arrives, and `applied` tells the screen
   * whether what it is showing is current.
   */
  useEffect(() => {
    setLoading(true);
    setPage(1);
    load(1);
  }, [load]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    load(1);
  }, [load]);

  const loadMore = useCallback(() => {
    if (loading || loadingMore || appending.current || page >= lastPage) {
      return;
    }
    setLoadingMore(true);
    load(page + 1, { append: true });
  }, [loading, loadingMore, page, lastPage, load]);

  const clearSearch = useCallback(() => {
    setQuery("");
    setTerm("");
  }, []);

  const remove = useCallback(async (id) => {
    setDeletingId(id);
    try {
      await deleteTransaction(id);
      // Dropped locally rather than refetching: the list keeps its scroll
      // position, and the balances it affects live on other screens anyway.
      setRows((current) => current.filter((row) => row.id !== id));
      setTotal((current) => Math.max(current - 1, 0));
      return true;
    } catch (err) {
      console.log("Delete failed:", err.response?.data || err.message);
      setError(describeApiError(err));
      return false;
    } finally {
      setDeletingId(null);
    }
  }, []);

  // True while the rows on screen belong to a previous term or filter.
  const stale =
    applied === null ||
    applied.term !== term ||
    applied.type !== (type ?? null);

  return {
    // Straight from the API — there is no local filtering.
    transactions: rows,
    query,
    setQuery,
    clearSearch,
    /** The term the visible rows were fetched with. */
    activeTerm: applied?.term ?? "",
    isSearching: term.length > 0,
    /** A request for the current term is still outstanding. */
    pending: loading || stale,
    total,
    loading,
    refreshing,
    loadingMore,
    hasMore: page < lastPage,
    error,
    deletingId,
    refresh,
    loadMore,
    remove,
  };
}
