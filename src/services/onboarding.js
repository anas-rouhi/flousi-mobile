import * as SecureStore from "../platform/storage";

/**
 * Whether the user has already seen the pre-auth presentation screen.
 *
 * Kept in SecureStore rather than AsyncStorage purely so the app keeps a single
 * storage dependency — the one already holding `user_token`. Nothing here is
 * sensitive, so every read and write degrades to "not onboarded" instead of
 * throwing: a device that refuses the keychain should still reach the app.
 */
const ONBOARDING_KEY = "onboarding_completed";

export async function hasCompletedOnboarding() {
  try {
    return (await SecureStore.getItemAsync(ONBOARDING_KEY)) === "true";
  } catch (error) {
    console.log("Onboarding flag read failed:", error.message);
    return false;
  }
}

export async function markOnboardingCompleted() {
  try {
    await SecureStore.setItemAsync(ONBOARDING_KEY, "true");
  } catch (error) {
    // Worst case the user sees the intro once more on next launch.
    console.log("Onboarding flag write failed:", error.message);
  }
}

/** Exposed for a "replay the intro" affordance or manual QA. */
export async function resetOnboarding() {
  try {
    await SecureStore.deleteItemAsync(ONBOARDING_KEY);
  } catch (error) {
    console.log("Onboarding flag reset failed:", error.message);
  }
}
