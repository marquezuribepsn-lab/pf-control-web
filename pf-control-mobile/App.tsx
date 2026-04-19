import { StatusBar } from "expo-status-bar";
import { createElement, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { WebView } from "react-native-webview";

const PRODUCTION_URL = "https://pf-control.com";
const DEFAULT_LOCAL_URL = "http://192.168.0.25:3000";

type EnvironmentMode = "production" | "local";

function normalizeHttpUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
}

export default function App() {
  const [environment, setEnvironment] = useState<EnvironmentMode>("production");
  const [localUrlInput, setLocalUrlInput] = useState(DEFAULT_LOCAL_URL);
  const [webViewKey, setWebViewKey] = useState(0);
  const [webError, setWebError] = useState("");
  const isWeb = Platform.OS === "web";

  const activeUrl = useMemo(() => {
    if (environment === "production") return PRODUCTION_URL;
    return normalizeHttpUrl(localUrlInput) || PRODUCTION_URL;
  }, [environment, localUrlInput]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>PF Control</Text>
        <Text style={styles.headerSubtitle}>Vista app</Text>

        <View style={styles.modeRow}>
          <Pressable
            onPress={() => setEnvironment("production")}
            style={[styles.modeButton, environment === "production" && styles.modeButtonActive]}
          >
            <Text style={[styles.modeButtonText, environment === "production" && styles.modeButtonTextActive]}>
              Produccion
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setEnvironment("local")}
            style={[styles.modeButton, environment === "local" && styles.modeButtonActive]}
          >
            <Text style={[styles.modeButtonText, environment === "local" && styles.modeButtonTextActive]}>
              Local
            </Text>
          </Pressable>
        </View>

        {environment === "local" ? (
          <View style={styles.localRow}>
            <TextInput
              value={localUrlInput}
              onChangeText={setLocalUrlInput}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              placeholder="http://192.168.0.25:3000"
              placeholderTextColor="#64748b"
              style={styles.localInput}
            />
            <Pressable style={styles.reloadButton} onPress={() => setWebViewKey((prev) => prev + 1)}>
              <Text style={styles.reloadButtonText}>Abrir</Text>
            </Pressable>
          </View>
        ) : null}

        <Text style={styles.urlText} numberOfLines={1}>
          URL: {activeUrl}
        </Text>
        {webError ? <Text style={styles.errorText}>{webError}</Text> : null}
      </View>

      {isWeb ? (
        <View style={styles.webview}>
          {createElement("iframe" as any, {
            key: `${environment}-${webViewKey}`,
            src: activeUrl,
            style: {
              width: "100%",
              height: "100%",
              border: "0",
              backgroundColor: "#020617",
            },
            onLoad: () => setWebError(""),
            onError: () => setWebError("No se pudo cargar la URL dentro del panel."),
          })}

          <View style={styles.webHintBar}>
            <Text style={styles.webHintText}>Si no carga en panel, abri en pestaña nueva.</Text>
            <Pressable style={styles.webHintButton} onPress={() => Linking.openURL(activeUrl)}>
              <Text style={styles.webHintButtonText}>Abrir</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <WebView
          key={`${environment}-${webViewKey}`}
          source={{ uri: activeUrl }}
          style={styles.webview}
          startInLoadingState
          onLoadStart={() => setWebError("")}
          onError={() => setWebError("No se pudo cargar la URL. Revisa la direccion local y la red.")}
          renderLoading={() => (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#22d3ee" />
              <Text style={styles.loadingText}>Cargando plataforma...</Text>
            </View>
          )}
          setSupportMultipleWindows={false}
          javaScriptEnabled
          domStorageEnabled
          pullToRefreshEnabled
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#020617",
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148,163,184,0.25)",
    backgroundColor: "#0f172a",
  },
  headerTitle: {
    color: "#f8fafc",
    fontSize: 18,
    fontWeight: "800",
  },
  headerSubtitle: {
    marginTop: 2,
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "600",
  },
  modeRow: {
    marginTop: 10,
    flexDirection: "row",
    gap: 8,
  },
  modeButton: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.35)",
    backgroundColor: "rgba(15,23,42,0.85)",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  modeButtonActive: {
    borderColor: "rgba(34,211,238,0.7)",
    backgroundColor: "rgba(6,182,212,0.2)",
  },
  modeButtonText: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "700",
  },
  modeButtonTextActive: {
    color: "#e0f2fe",
  },
  localRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  localInput: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.35)",
    backgroundColor: "#020617",
    color: "#e2e8f0",
    fontSize: 13,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  reloadButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(34,211,238,0.65)",
    backgroundColor: "rgba(6,182,212,0.2)",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  reloadButtonText: {
    color: "#cffafe",
    fontSize: 12,
    fontWeight: "800",
  },
  urlText: {
    marginTop: 8,
    color: "#93c5fd",
    fontSize: 11,
    fontWeight: "600",
  },
  errorText: {
    marginTop: 6,
    color: "#fca5a5",
    fontSize: 11,
    fontWeight: "600",
  },
  webview: {
    flex: 1,
    backgroundColor: "#020617",
  },
  webHintBar: {
    position: "absolute",
    right: 10,
    bottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.35)",
    backgroundColor: "rgba(2,6,23,0.85)",
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  webHintText: {
    color: "#cbd5e1",
    fontSize: 11,
    fontWeight: "600",
  },
  webHintButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(34,211,238,0.65)",
    backgroundColor: "rgba(6,182,212,0.2)",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  webHintButtonText: {
    color: "#cffafe",
    fontSize: 11,
    fontWeight: "800",
  },
  loadingOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#020617",
    gap: 10,
  },
  loadingText: {
    color: "#e2e8f0",
    fontSize: 14,
    fontWeight: "600",
  },
});
