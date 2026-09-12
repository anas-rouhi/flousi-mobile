import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { Card, CardHeader, CardHeaderMeta } from "../ui/Card";
import { colors, fontSizes, radii, spacing } from "../../constants/theme";

/** Arabic label per account type, matching the API's enum. */
const TYPE_LABELS = {
  cash: "كاش",
  bank: "بنك",
  credit_card: "بطاقة",
  savings: "توفير",
  other: "أخرى",
};

/**
 * Horizontal strip of the user's accounts with their balances, ending in an
 * "add account" chip.
 *
 * Balances use the API's `balance_formatted` string, so the row never does its
 * own centime division.
 */
export default function AccountsCarousel({
  accounts = [],
  loading = false,
  selectedId = null,
  onSelect,
  onAddAccount,
}) {
  return (
    <Card>
      <CardHeader
        title="الحسابات"
        meta={
          accounts.length ? (
            <CardHeaderMeta>{accounts.length} حساب</CardHeaderMeta>
          ) : null
        }
      />

      {loading && accounts.length === 0 ? (
        <ActivityIndicator color={colors.primary} size="small" />
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.row}
        >
          {accounts.map((account) => {
            const active = account.id === selectedId;
            const accent = account.color || colors.primary;

            return (
              <TouchableOpacity
                key={account.id}
                style={[
                  styles.tile,
                  active && { borderColor: accent, backgroundColor: colors.primarySoft },
                ]}
                onPress={() => onSelect?.(account)}
                activeOpacity={0.8}
              >
                <View style={styles.tileTop}>
                  <View style={[styles.dot, { backgroundColor: accent }]} />
                  <Text style={styles.tileType}>
                    {TYPE_LABELS[account.type] || TYPE_LABELS.other}
                  </Text>
                </View>
                <Text style={styles.tileName} numberOfLines={1}>
                  {account.name}
                </Text>
                <Text style={styles.tileBalance} numberOfLines={1}>
                  {account.balance_formatted}
                </Text>
              </TouchableOpacity>
            );
          })}

          {/* Always last, so the gesture to reach it is the same every time. */}
          <TouchableOpacity
            style={styles.addTile}
            onPress={onAddAccount}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="زيد حساب جديد"
          >
            <Text style={styles.addIcon}>＋</Text>
            <Text style={styles.addLabel}>زيد حساب</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row-reverse", paddingLeft: spacing.xs },

  tile: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: 14,
    marginLeft: spacing.sm,
    minWidth: 148,
    alignItems: "flex-end",
  },
  tileTop: {
    flexDirection: "row-reverse",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginLeft: 6 },
  tileType: {
    fontSize: fontSizes.caption,
    fontWeight: "600",
    color: colors.textMuted,
    letterSpacing: 0.3,
  },
  tileName: {
    fontSize: fontSizes.body,
    fontWeight: "600",
    color: colors.text,
    textAlign: "right",
  },
  tileBalance: {
    fontSize: fontSizes.bodyLarge,
    fontWeight: "bold",
    color: colors.primary,
    marginTop: spacing.xs,
    textAlign: "right",
  },

  addTile: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.primaryBorder,
    borderRadius: radii.lg,
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
    marginLeft: spacing.sm,
    minWidth: 110,
    alignItems: "center",
    justifyContent: "center",
  },
  addIcon: {
    fontSize: 22,
    color: colors.primary,
    fontWeight: "bold",
    lineHeight: 26,
  },
  addLabel: {
    fontSize: fontSizes.meta,
    fontWeight: "600",
    color: colors.primary,
    marginTop: 2,
  },
});
