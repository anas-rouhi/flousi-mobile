import React from "react";
import {
  Appearance,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { palettes } from "../../constants/theme";
import { t } from "../../i18n/store";

/**
 * The last line of defence.
 *
 * Without this, one render-time exception unmounts the whole tree and leaves a
 * blank screen in a production build — a crash the user can only escape by
 * force-quitting. Here the error is caught, stated plainly, and retried: the
 * children are remounted under a new key, which re-runs whatever failed.
 *
 * It sits *outside* every provider in App.js so it still works when the thing
 * that threw is a provider. That rules out the theme and locale hooks, so the
 * palette is read straight from `Appearance` and the copy from the translation
 * store, which is a plain module and needs no React context.
 */
export default class ErrorBoundary extends React.Component {
  state = { error: null, attempt: 0 };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // No crash reporter is installed yet; this is what a developer sees in the
    // Metro log, and where Sentry's captureException would go.
    console.log("Unhandled error:", error?.message, info?.componentStack);
  }

  retry = () => {
    this.setState((current) => ({ error: null, attempt: current.attempt + 1 }));
  };

  render() {
    const { error, attempt } = this.state;

    if (!error) {
      // The key is what makes "retry" a real remount rather than a no-op.
      return <React.Fragment key={attempt}>{this.props.children}</React.Fragment>;
    }

    const colors =
      Appearance.getColorScheme() === "dark" ? palettes.dark : palettes.light;

    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Text style={styles.glyph}>⚠️</Text>
          <Text style={[styles.title, { color: colors.text }]}>
            {t("common.unexpected_error_title")}
          </Text>
          <Text style={[styles.body, { color: colors.textSecondary }]}>
            {t("common.unexpected_error_body")}
          </Text>

          {__DEV__ && error?.message ? (
            <Text style={[styles.detail, { color: colors.textFaint }]}>
              {error.message}
            </Text>
          ) : null}

          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.primary }]}
            onPress={this.retry}
            activeOpacity={0.85}
            accessibilityRole="button"
          >
            <Text style={[styles.buttonText, { color: colors.onPrimary }]}>
              {t("common.retry")}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }
}

/** Plain sheet: the themed helpers are hooks, and this is a class on purpose. */
const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },
  glyph: { fontSize: 40, marginBottom: 14 },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
  },
  body: {
    fontSize: 15,
    lineHeight: 23,
    textAlign: "center",
    marginTop: 10,
  },
  detail: {
    fontSize: 12,
    textAlign: "center",
    marginTop: 14,
  },
  button: {
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 34,
    marginTop: 26,
  },
  buttonText: { fontSize: 16, fontWeight: "bold" },
});
