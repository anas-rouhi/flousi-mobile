import React from "react";
import { Text, StyleSheet } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { colors, fontSizes } from "../constants/theme";
import AnalyticsScreen from "../screens/AnalyticsScreen";
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
  return (
    <Text style={[styles.icon, focused && styles.iconFocused]}>{glyph}</Text>
  );
}

const TABS = [
  { name: "Home", label: "الرئيسية", glyph: "🏠", component: HomeScreen },
  {
    name: "Transactions",
    label: "العمليات",
    glyph: "📜",
    component: TransactionsScreen,
  },
  {
    name: "Analytics",
    label: "الإحصائيات",
    glyph: "📊",
    component: AnalyticsScreen,
  },
  {
    name: "Settings",
    label: "الإعدادات",
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
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarStyle: styles.bar,
        tabBarLabelStyle: styles.label,
        tabBarItemStyle: styles.item,
      }}
    >
      {TABS.map(({ name, label, glyph, component }) => (
        <Tab.Screen
          key={name}
          name={name}
          component={component}
          options={{
            title: label,
            tabBarIcon: ({ focused }) => (
              <TabIcon glyph={glyph} focused={focused} />
            ),
          }}
        />
      ))}
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
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
