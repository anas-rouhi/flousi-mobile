import React from "react";
import { Text, StyleSheet } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { fontSizes } from "../constants/theme";
import { useTheme, useThemedStyles } from "../context/ThemeContext";
import { useI18n } from "../i18n";
import { selectionFeedback } from "../utils/haptics";
import AnalyticsScreen from "../screens/AnalyticsScreen";
import GoalsScreen from "../screens/GoalsScreen";
import HomeScreen from "../screens/HomeScreen";
import SettingsScreen from "../screens/SettingsScreen";
import TransactionsScreen from "../screens/TransactionsScreen";

const Tab = createBottomTabNavigator();

/**
 * Emoji stand in for an icon font: no vector icon package is installed, and
 * the seeded Lucide names the API uses do not map onto one. A glyph needs no
 * font loading and renders identically on both platforms.
 */
function TabIcon({ glyph, focused }) {
  const styles = useThemedStyles(createStyles);
  return (
    <Text style={[styles.icon, focused && styles.iconFocused]}>{glyph}</Text>
  );
}

/** `labelKey` is resolved at render, so a language switch relabels the bar. */
const TABS = [
  { name: "Home", labelKey: "tabs.home", glyph: "🏠", component: HomeScreen },
  {
    name: "Transactions",
    labelKey: "tabs.transactions",
    glyph: "📜",
    component: TransactionsScreen,
  },
  {
    name: "Analytics",
    labelKey: "tabs.analytics",
    glyph: "📊",
    component: AnalyticsScreen,
  },
  {
    name: "Goals",
    labelKey: "tabs.goals",
    glyph: "🎯",
    component: GoalsScreen,
  },
  {
    name: "Settings",
    labelKey: "tabs.settings",
    glyph: "⚙️",
    component: SettingsScreen,
  },
];

/**
 * The authenticated shell.
 *
 * Tab order is deliberately left as declared rather than reversed for RTL:
 * React Navigation reverses it automatically when the app is in RTL mode, and
 * hand-reversing here would double-flip it. Each screen keeps its own header,
 * so the navigator shows none.
 *
 * The "+" action lives on the Home and Transactions screens rather than in the
 * bar itself, so each one refreshes its own data after a save.
 */
export default function TabNavigator() {
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { t } = useI18n();
  return (
    <Tab.Navigator
      // Fires on the press itself, including a press on the active tab, which
      // is what makes the bar feel responsive rather than only the switch.
      screenListeners={{ tabPress: () => selectionFeedback() }}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarStyle: styles.bar,
        tabBarLabelStyle: styles.label,
        tabBarItemStyle: styles.item,
      }}
    >
      {TABS.map(({ name, labelKey, glyph, component }) => (
        <Tab.Screen
          key={name}
          name={name}
          component={component}
          options={{
            title: t(labelKey),
            tabBarIcon: ({ focused }) => (
              <TabIcon glyph={glyph} focused={focused} />
            ),
          }}
        />
      ))}
    </Tab.Navigator>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
  bar: {
    backgroundColor: colors.tabBar,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    height: 62,
    paddingBottom: 8,
    paddingTop: 6,
  },
  item: { paddingVertical: 2 },
  label: { fontSize: fontSizes.caption, fontWeight: "600" },
  icon: { fontSize: 19, opacity: 0.55 },
  // Emoji ignore tintColor, so focus is carried by opacity and scale instead.
  iconFocused: { opacity: 1, fontSize: 21 },
});
