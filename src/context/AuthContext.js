import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Alert } from "react-native";
import { t } from "../i18n/store";
import {
  clearSession,
  fetchMe,
  getCachedUser,
  getToken,
  login as loginRequest,
  logout as logoutRequest,
  register as registerRequest,
} from "../services/auth";
import {
  hasCompletedOnboarding,
  markOnboardingCompleted,
} from "../services/onboarding";
import { onUnauthorized } from "../services/sessionEvents";

const AuthContext = createContext(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside <AuthProvider>");
  }
  return context;
}

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [onboarded, setOnboarded] = useState(true);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      const [storedToken, seenIntro] = await Promise.all([
        getToken(),
        hasCompletedOnboarding(),
      ]);

      if (!active) {
        return;
      }
      setOnboarded(seenIntro);

      if (!storedToken) {
        setBooting(false);
        return;
      }

      // Greet the user from cache immediately; /me then confirms the token.
      setUser(await getCachedUser());
      setToken(storedToken);

      try {
        const fresh = await fetchMe();
        if (active && fresh) {
          setUser(fresh);
        }
      } catch (error) {
        const status = error?.response?.status;

        // Only an explicit rejection proves the token is dead. Anything else —
        // offline, a cold backend, a 500 from a half-migrated database — is a
        // statement about the server, not the credentials, so the session is
        // kept and the dashboard's own retry surfaces the problem.
        if (status === 401 || status === 403) {
          console.log("Stored token rejected, signing out.");
          await clearSession();
          if (active) {
            setToken(null);
            setUser(null);
          }
        } else {
          console.log(
            "Could not verify session (",
            status ?? error?.code ?? "network",
            ") - keeping it.",
          );
        }
      } finally {
        if (active) {
          setBooting(false);
        }
      }
    };

    bootstrap();
    return () => {
      active = false;
    };
  }, []);

  /**
   * A 401 on any authenticated request means the stored token is dead — most
   * often revoked from another device or wiped with the backend's database.
   * Clearing the session here is all the "redirect" that is needed: the
   * navigator's screen set is derived from `isAuthenticated`, so the dashboard
   * unmounts and Login takes its place.
   */
  const tokenRef = useRef(null);
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  useEffect(() => {
    return onUnauthorized(async ({ url } = {}) => {
      console.log("Token rejected by", url || "the API", "- signing out.");
      // Several requests can fail on the same dead token at once; only the
      // first one, while a session is still held, tells the user why they
      // were sent back to Login.
      const hadSession = Boolean(tokenRef.current);
      tokenRef.current = null;
      await clearSession();
      setToken(null);
      setUser(null);
      if (hadSession) {
        Alert.alert(t("session.expired_title"), t("session.expired_body"), [
          { text: t("common.ok") },
        ]);
      }
    });
  }, []);

  /**
   * Serialises every sign-in/sign-up attempt.
   *
   * A second tap while one is in flight joins the pending promise instead of
   * firing another request — two concurrent POST /auth/register calls would
   * both occupy the 30s budget, and the loser would come back as "email already
   * taken" against the account the winner just created.
   */
  const pendingAuth = useRef(null);

  const runAuth = useCallback(async (operation) => {
    if (pendingAuth.current) {
      return pendingAuth.current;
    }

    const attempt = (async () => {
      // `operation` resolves only after the token is written AND verified, so
      // by this line an authenticated request is guaranteed to carry it.
      const { user: nextUser, token: nextToken } = await operation();
      // Committed together: React batches these into one render, so there is no
      // intermediate state where the app is authenticated but has no profile.
      setUser(nextUser);
      setToken(nextToken);
      return nextUser;
    })();

    pendingAuth.current = attempt;
    try {
      return await attempt;
    } finally {
      // Cleared on failure too, so a timeout never wedges the gate shut.
      pendingAuth.current = null;
    }
  }, []);

  const signIn = useCallback(
    (credentials) => runAuth(() => loginRequest(credentials)),
    [runAuth],
  );

  const signUp = useCallback(
    (details) => runAuth(() => registerRequest(details)),
    [runAuth],
  );

  const signOut = useCallback(async () => {
    await logoutRequest();
    setToken(null);
    setUser(null);
  }, []);

  /** Commits a profile the API just returned (language, currency, timezone). */
  const applyUser = useCallback((nextUser) => {
    if (nextUser) {
      setUser(nextUser);
    }
  }, []);

  /**
   * Drops the session after the account itself has been deleted server-side.
   *
   * No logout call: the token died with the account, and POSTing to
   * /auth/logout would only earn a 401. Clearing the token is the whole
   * "redirect" — the navigator's screen set is derived from it, so the
   * dashboard unmounts and the signed-out stack takes its place.
   */
  const forgetSession = useCallback(async () => {
    tokenRef.current = null;
    await clearSession();
    setToken(null);
    setUser(null);
  }, []);

  /**
   * Re-reads the profile, e.g. after the API host changed. A 401 is handled by
   * the interceptor's sign-out; any other failure is just reported.
   */
  const refreshUser = useCallback(async () => {
    if (!tokenRef.current) {
      return null;
    }
    const fresh = await fetchMe();
    if (fresh) {
      setUser(fresh);
    }
    return fresh;
  }, []);

  /** Called when the user leaves the landing page, so it is not forced again. */
  const completeOnboarding = useCallback(async () => {
    setOnboarded(true);
    await markOnboardingCompleted();
  }, []);

  const value = useMemo(
    () => ({
      // The single source of truth for the navigation gate.
      isAuthenticated: Boolean(token),
      user,
      booting,
      onboarded,
      signIn,
      signUp,
      signOut,
      applyUser,
      forgetSession,
      refreshUser,
      completeOnboarding,
    }),
    [
      token,
      user,
      booting,
      onboarded,
      signIn,
      signUp,
      signOut,
      applyUser,
      forgetSession,
      refreshUser,
      completeOnboarding,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
