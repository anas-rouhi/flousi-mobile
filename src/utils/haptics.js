import { Platform } from "react-native";
import * as Haptics from "expo-haptics";

/**
 * Tactile feedback.
 *
 * Every call is fire-and-forget and swallows its own failure: haptics are
 * unavailable on web, absent on many Android devices and silent in the iOS
 * simulator, and none of that is a reason to interrupt what the user was
 * doing. Nothing here is ever awaited on a UI path.
 *
 * Kept deliberately small — one function per *meaning*, not per API call — so
 * the vocabulary stays consistent: a tap feels the same everywhere in the app.
 */
const supported = Platform.OS === "ios" || Platform.OS === "android";

function fire(run) {
  if (!supported) {
    return;
  }
  try {
    run()?.catch?.(() => {});
  } catch {
    // Older devices without a haptic engine throw synchronously.
  }
}

/** A button, a FAB, a chip: the lightest confirmation that a press landed. */
export function tapFeedback() {
  fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

/** Moving between things — tabs, segments, filters. */
export function selectionFeedback() {
  fire(() => Haptics.selectionAsync());
}

/** Something was saved. Heavier than a tap because it reports an outcome. */
export function successFeedback() {
  fire(() =>
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  );
}

/** A destructive action being committed (deleting a record). */
export function destructiveFeedback() {
  fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
}

/** Something failed. Used sparingly: a buzz on every validation slip nags. */
export function errorFeedback() {
  fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error));
}
