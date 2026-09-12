import React, { useEffect, useRef, useState } from "react";
import {
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { isRetryableError } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { describeAuthError } from "../services/auth";

const BRAND = "#0A5C36";

export default function LoginScreen({ navigation }) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  // Same guards as registration: reject a second tap before `loading` commits,
  // and never set state after the navigator has unmounted this screen.
  const submittingRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    [],
  );

  const handleLogin = async () => {
    if (submittingRef.current) {
      return;
    }

    if (!email.trim() || !password) {
      setError("عفاك دخل الإيميل وكلمة السر");
      return;
    }

    submittingRef.current = true;
    setLoading(true);
    setError(null);
    try {
      // Resolves once the token is stored and verified; the context then flips
      // to authenticated and the navigator swaps in the dashboard.
      await signIn({ email: email.trim(), password });
    } catch (err) {
      console.log("Login error:", err.response?.data || err.message);
      if (mountedRef.current) {
        setError(
          isRetryableError(err)
            ? "الاتصال طوّل بزاف، عاود المحاولة"
            : describeAuthError(err),
        );
      }
    } finally {
      submittingRef.current = false;
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.brand}>FLOUSI</Text>
          <Text style={styles.title}>تسجيل الدخول</Text>
          <Text style={styles.subtitle}>مرحبا بيك من جديد</Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Text style={styles.label}>الإيميل</Text>
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor="#B2BEC3"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            editable={!loading}
          />

          <Text style={styles.label}>كلمة السر</Text>
          <TextInput
            style={styles.input}
            placeholder="••••••••"
            placeholderTextColor="#B2BEC3"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
            editable={!loading}
            onSubmitEditing={handleLogin}
            returnKeyType="go"
          />

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>دخول • Login</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkRow}
            onPress={() => navigation.navigate("Register")}
            disabled={loading}
          >
            <Text style={styles.linkMuted}>ما عندكش حساب؟ </Text>
            <Text style={styles.link}>إنشاء حساب جديد</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => navigation.navigate("Presentation")}
            disabled={loading}
          >
            <Text style={styles.linkSecondary}>شوف شنو كاين فـ FLOUSI</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: "center", padding: 24 },

  brand: {
    fontSize: 22,
    fontWeight: "bold",
    color: BRAND,
    letterSpacing: 3,
    textAlign: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#2C3E50",
    textAlign: "center",
    marginTop: 18,
  },
  subtitle: {
    fontSize: 14,
    color: "#95A5A6",
    textAlign: "center",
    marginTop: 6,
    marginBottom: 24,
  },

  error: {
    backgroundColor: "#FDECEA",
    color: "#C0392B",
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    textAlign: "center",
    marginBottom: 16,
  },

  label: {
    fontSize: 13,
    fontWeight: "600",
    color: "#7F8C8D",
    textAlign: "right",
    marginBottom: 6,
  },
  input: {
    backgroundColor: "#F8F9FA",
    borderWidth: 1,
    borderColor: "#E4E9EC",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    color: "#2C3E50",
    marginBottom: 16,
    textAlign: "right",
  },

  button: {
    backgroundColor: BRAND,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 6,
  },
  buttonDisabled: { opacity: 0.7 },
  buttonText: { color: "#FFFFFF", fontSize: 16, fontWeight: "bold" },

  linkRow: {
    flexDirection: "row-reverse",
    justifyContent: "center",
    marginTop: 22,
  },
  linkMuted: { fontSize: 14, color: "#95A5A6" },
  link: { fontSize: 14, color: BRAND, fontWeight: "bold" },
  linkSecondary: {
    fontSize: 13,
    color: "#B2BEC3",
    textAlign: "center",
    marginTop: 16,
  },
});
