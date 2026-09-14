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
 * Both the type filter and the search term go to the API, so results cover
 * every record rather than the pages already loaded, and pagination applies to
 * the filtered set. The search term is debounced so a typed word costs one
 * request instead of one per character.
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

  // Guards against a scroll event firing another page request mid-flight.
  const inFlight = useRef(false);

  // Debounce: `query` drives the input, `term` drives the request.
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed === term) {
      return;
    }

    const timer = setTimeout(() => setTerm(trimmed), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, term]);

  const loadPage = useCallback(
    async (targetPage, { append = false } = {}) => {
      if (inFlight.current) {
        return;
      }
      inFlight.current = true;
      setError(null);

      try {
        const result = await fetchTransactions({
          page: targetPage,
          perPage: PER_PAGE,
          search: term || undefined,
          type: type ?? undefined,
        });

        setRows((current) =>
          append ? [...current, ...result.rows] : result.rows,
        );
        setPage(result.page);
        setLastPage(result.lastPage);
        setTotal(result.total);
      } catch (err) {
        console.log("Transactions load failed:", err.response?.data || err.message);
        setError(describeApiError(err));
      } finally {
        inFlight.current = false;
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [type, term],
  );

  /**
   * A changed filter or search term restarts at page 1. Rows are cleared at the
   * same time so the spinner never sits over results from the previous term.
   */
  useEffect(() => {
    setLoading(true);
    setRows([]);
    setPage(1);
    loadPage(1);
  }, [loadPage]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    loadPage(1);
  }, [loadPage]);

  const loadMore = useCallback(() => {
    if (loading || loadingMore || inFlight.current || page >= lastPage) {
      return;
    }
    setLoadingMore(true);
    loadPage(page + 1, { append: true });
  }, [loading, loadingMore, page, lastPage, loadPage]);

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

  return {
    // Straight from the API — there is no local filtering left.
    transactions: rows,
    query,
    setQuery,
    clearSearch,
    /** The term actually applied server-side, for the empty-state message. */
    activeTerm: term,
    isSearching: term.length > 0,
    /** True while a new term or filter is being fetched, with rows cleared. */
    searchPending: loading && term.length > 0,
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
