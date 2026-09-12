import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { describeApiError } from "../services/api";
import {
  deleteTransaction,
  fetchTransactions,
} from "../services/transactions";

const PER_PAGE = 20;

/**
 * Paginated transaction history with a type filter and description search.
 *
 * Search is client-side by necessity: the API exposes no text-search parameter,
 * so it filters the pages already loaded. That is honest but partial — a match
 * on page 5 is invisible until page 5 is reached — which is why `searchScope`
 * is reported back for the UI to say so rather than implying a full-corpus
 * search. Filtering by type *is* server-side, so it always covers everything.
 */
export function useTransactions({ type = null } = {}) {
  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState("");
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
    [type],
  );

  // A changed filter restarts from page 1 rather than appending to stale rows.
  useEffect(() => {
    setLoading(true);
    setRows([]);
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

  const trimmed = query.trim().toLowerCase();

  const visible = useMemo(() => {
    if (!trimmed) {
      return rows;
    }
    // Description first, then the category and account names — all three are
    // what someone would actually remember about a transaction.
    return rows.filter((row) =>
      [row.description, row.category?.name, row.account?.name]
        .filter(Boolean)
        .some((field) => String(field).toLowerCase().includes(trimmed)),
    );
  }, [rows, trimmed]);

  return {
    transactions: visible,
    query,
    setQuery,
    isSearching: Boolean(trimmed),
    /** How much of the corpus the client-side search actually covered. */
    searchScope: { loaded: rows.length, total },
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
