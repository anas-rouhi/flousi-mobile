import React from "react";
import {
  View,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import {
  ThemeProvider,
  useTheme,
  useThemedStyles,
} from "./src/context/ThemeContext";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import ErrorBoundary from "./src/components/common/ErrorBoundary";
import WebShell from "./src/components/common/WebShell";
import { AppLockProvider } from "./src/context/AppLockContext";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { LocaleProvider, useLocale } from "./src/context/LocaleContext";
import {
  ServerConnectProvider,
  useServerConnect,
} from "./src/context/ServerConnectContext";
import TabNavigator from "./src/navigation/TabNavigator";
import LoginScreen from "./src/screens/LoginScreen";
import ForgotPasswordScreen from "./src/screens/ForgotPasswordScreen";
import ResetPasswordScreen from "./src/screens/ResetPasswordScreen";
import OnboardingScreen from "./src/screens/OnboardingScreen";
import RegisterScreen from "./src/screens/RegisterScreen";

const Stack = createNativeStackNavigator();

/**
 * The browser tab keeps the brand title on every screen. Without a formatter
 * React Navigation renames the tab after each route ("Home", "Login"…).
 */
const WEB_TITLE = "FLOUSI — فين مشات فلوسي؟";
const documentTitle = { formatter: () => WEB_TITLE };

/**
 * Deep links, used only by the password reset email so far.
 *
 * React Navigation handles both entry points from this one declaration: a cold
 * start reads the launch URL, and a link arriving while the app is already open
 * is routed the same way. It also parses `?token=…&email=…` straight into the
 * screen's route params, so no screen has to touch Linking.
 *
 * Both prefixes are accepted: `flousi://` works today, and the https form is
 * ready for when the domain is set up to hand its links to the app.
 */
const linking = {
  prefixes: ["flousi://", "https://app.flousi.ma"],
  config: {
    screens: {
      ResetPassword: "reset-password",
    },
  },
};

/**
 * The authentication gate.
 *
 * The dashboard is mounted only while a token exists, so there is no route a
 * signed-out user can reach it through — signing out unmounts it rather than
 * navigating away from it. Swapping the whole stack also means React Navigation
 * animates the transition for us in both directions.
 */
function RootNavigator() {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { isAuthenticated, booting, onboarded, completeOnboarding } = useAuth();
  // Bumped when the API host changes, so every screen remounts and refetches.
  const { epoch } = useServerConnect();

  if (booting) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack.Navigator
      key={epoch}
      // A returning user who has already read the pitch lands straight on
      // Login, and can still reach the presentation from the link there.
      initialRouteName={
        isAuthenticated ? "Home" : onboarded ? "Login" : "Presentation"
      }
      screenOptions={{ headerShown: false, animation: "slide_from_right" }}
    >
      {isAuthenticated ? (
        <>
          <Stack.Screen name="Home" component={TabNavigator} />
          {/* Also reachable while signed in: a reset link may be opened on a
              device that still holds a session, and the link must not dead-end. */}
          <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="Presentation">
            {({ navigation }) => (
              <OnboardingScreen
                onCreateAccount={() => {
                  completeOnboarding();
                  navigation.navigate("Register");
                }}
                onLogin={() => {
                  completeOnboarding();
                  navigation.navigate("Login");
                }}
              />
            )}
          </Stack.Screen>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen
            name="ForgotPassword"
            component={ForgotPasswordScreen}
          />
          <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

function ThemedApp() {
  const { colors, isDark } = useTheme();
  const { ready, wantsRTL } = useLocale();

  // Nothing mounts until the persisted language has been read, so the
  // navigation tree is never built against an unknown direction. The root
  // view's `direction` style (Yoga) is what actually flips layout: it cascades
  // through every child and works even where `I18nManager.forceRTL` cannot.
  if (!ready) {
    return (
      <View style={[styles.boot, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const navigationTheme = {
    dark: isDark,
    colors: {
      primary: colors.primary,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      notification: colors.danger,
    },
    // React Navigation 7 expects a font map; the app uses system faces.
    fonts: {
      regular: { fontFamily: "System", fontWeight: "400" },
      medium: { fontFamily: "System", fontWeight: "500" },
      bold: { fontFamily: "System", fontWeight: "700" },
      heavy: { fontFamily: "System", fontWeight: "900" },
    },
  };

  return (
    <View style={[styles.root, { direction: wantsRTL ? "rtl" : "ltr" }]}>
      <AuthProvider>
        {/* Inverted against the ground, so icons stay legible in both themes. */}
        <StatusBar style={isDark ? "light" : "dark"} />
        {/* Dev-only prompt to retarget the API when the LAN address changes. */}
        <ServerConnectProvider>
          {/* Face ID / fingerprint gate; covers the navigator and any open sheet. */}
          <AppLockProvider>
            <NavigationContainer
              theme={navigationTheme}
              linking={linking}
              documentTitle={documentTitle}
            >
              <RootNavigator />
            </NavigationContainer>
          </AppLockProvider>
        </ServerConnectProvider>
      </AuthProvider>
    </View>
  );
}

export default function App() {
  return (
    // Outside every provider, so a provider that throws is caught too.
    <ErrorBoundary>
      <SafeAreaProvider>
        <ThemeProvider>
          {/* Desktop browsers get a centred column; elsewhere it renders nothing. */}
          <WebShell>
            {/* Locale sits inside Theme so directional styling can read themes. */}
            <LocaleProvider>
              <ThemedApp />
            </LocaleProvider>
          </WebShell>
        </ThemeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

/** Pre-theme sheet, used while the locale bootstrap is still running. */
const styles = StyleSheet.create({
  boot: { flex: 1, alignItems: "center", justifyContent: "center" },
  root: { flex: 1 },
});

const createStyles = (colors) =>
  StyleSheet.create({
    center: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: colors.background,
      padding: 24,
    },
  });
