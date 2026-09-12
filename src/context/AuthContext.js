import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { isRetryableError } from "../services/api";
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
        if (isRetryableError(error)) {
          // Offline or a cold backend is not proof of a bad token — keep the
          // session and let the dashboard's own retry surface the problem.
          console.log("Could not verify session while offline, keeping it.");
        } else {
          // A real rejection (401/403) means the stored token is dead.
          console.log("Stored token rejected, signing out.");
          await clearSession();
          if (active) {
            setToken(null);
            setUser(null);
          }
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
      completeOnboarding,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
