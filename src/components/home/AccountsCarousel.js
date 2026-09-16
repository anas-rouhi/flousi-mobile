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
import { fontSizes, radii, spacing } from "../../constants/theme";
import { useTheme, useThemedStyles } from "../../context/ThemeContext";
import { useI18n } from "../../i18n";
import { ltr } from "../../utils/bidi";

/** Account types with a label under `accounts.types`, matching the API's enum. */
const KNOWN_TYPES = ["cash", "bank", "credit_card", "savings", "other"];

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
  const { colors } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { t } = useI18n();
  return (
    <Card>
      <CardHeader
        title={t("accounts.title")}
        meta={
          accounts.length ? (
            <CardHeaderMeta>
              {t("common.accounts_count", { count: accounts.length })}
            </CardHeaderMeta>
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
                    {t(
                      `accounts.types.${
                        KNOWN_TYPES.includes(account.type) ? account.type : "other"
                      }`,
                    )}
                  </Text>
                </View>
                <Text style={styles.tileName} numberOfLines={1}>
                  {account.name}
                </Text>
                <Text style={styles.tileBalance} numberOfLines={1}>
                  {ltr(account.balance_formatted)}
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
            accessibilityLabel={t("accounts.add_a11y")}
          >
            <Text style={styles.addIcon}>＋</Text>
            <Text style={styles.addLabel}>{t("accounts.add")}</Text>
          </TouchableOpacity>
        </ScrollView>
      )}
    </Card>
  );
}

const createStyles = (colors) =>
  StyleSheet.create({
  row: { flexDirection: "row", paddingStart: spacing.xs },

  tile: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: 14,
    marginStart: spacing.sm,
    minWidth: 148,
    alignItems: "flex-end",
  },
  tileTop: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  dot: { width: 8, height: 8, borderRadius: 4, marginStart: 6 },
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
    textAlign: "auto",
  },
  tileBalance: {
    fontSize: fontSizes.bodyLarge,
    fontWeight: "bold",
    color: colors.primary,
    marginTop: spacing.xs,
    textAlign: "auto",
  },

  addTile: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.primaryBorder,
    borderRadius: radii.lg,
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
    marginStart: spacing.sm,
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
