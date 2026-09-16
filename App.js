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
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { LocaleProvider, useLocale } from "./src/context/LocaleContext";
import TabNavigator from "./src/navigation/TabNavigator";
import LoginScreen from "./src/screens/LoginScreen";
import ForgotPasswordScreen from "./src/screens/ForgotPasswordScreen";
import ResetPasswordScreen from "./src/screens/ResetPasswordScreen";
import OnboardingScreen from "./src/screens/OnboardingScreen";
import RegisterScreen from "./src/screens/RegisterScreen";

const Stack = createNativeStackNavigator();

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

  if (booting) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack.Navigator
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
        <NavigationContainer theme={navigationTheme} linking={linking}>
          <RootNavigator />
        </NavigationContainer>
      </AuthProvider>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        {/* Locale sits inside Theme so directional styling can read themes. */}
        <LocaleProvider>
          <ThemedApp />
        </LocaleProvider>
      </ThemeProvider>
    </SafeAreaProvider>
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
