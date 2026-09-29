import React from "react";
import { Modal as RNModal, StyleSheet, View } from "react-native";
import { APP_MAX_WIDTH } from "./layout";

/**
 * In the browser, react-native-web portals a Modal to <body> and stretches it
 * over the whole window — on a desktop monitor a bottom sheet would span
 * 1900px while the app sits in a 480px column. This wrapper re-centres the
 * modal's content in a column of the same width, so a sheet rises inside the
 * app exactly as it does on a phone. On a phone-sized window the column is
 * simply the full width.
 */
export default function Modal({ children, ...props }) {
  return (
    <RNModal {...props}>
      <View style={styles.frame} pointerEvents="box-none">
        <View style={styles.column}>{children}</View>
      </View>
    </RNModal>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, alignItems: "center" },
  column: { flex: 1, width: "100%", maxWidth: APP_MAX_WIDTH },
});
