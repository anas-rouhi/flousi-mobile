import React from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { colors } from "./src/constants/theme";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import TabNavigator from "./src/navigation/TabNavigator";
import LoginScreen from "./src/screens/LoginScreen";
import OnboardingScreen from "./src/screens/OnboardingScreen";
import RegisterScreen from "./src/screens/RegisterScreen";

const Stack = createNativeStackNavigator();

/**
 * The authentication gate.
 *
 * The dashboard is mounted only while a token exists, so there is no route a
 * signed-out user can reach it through — signing out unmounts it rather than
 * navigating away from it. Swapping the whole stack also means React Navigation
 * animates the transition for us in both directions.
 */
function RootNavigator() {
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
        <Stack.Screen name="Home" component={TabNavigator} />
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
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <NavigationContainer>
          <RootNavigator />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.surface,
  },
});
