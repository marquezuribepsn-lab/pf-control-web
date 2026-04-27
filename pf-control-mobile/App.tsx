import { StatusBar } from "expo-status-bar";
import { createElement, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

const PRODUCTION_URL = "https://pf-control.com";
const WEBVIEW_CACHE_TAG = "alumno-v2-20260425-ultra-max";
const MAX_PERFORMANCE_MODE = true;
const MAX_PERFORMANCE_QUERY_FLAGS: Record<string, string> = {
  pfperf: "1",
  pfmax: "1",
  pffluid: "1",
};

const MOBILE_SCROLL_HINT_SCRIPT = `
(() => {
  try {
    if (window.__PF_SCROLL_HINT_INSTALLED__) {
      true;
      return;
    }

    window.__PF_SCROLL_HINT_INSTALLED__ = true;
    const root = document.documentElement;
    if (!root) {
      true;
      return;
    }

    root.classList.add("pf-mobile-webview");
    root.classList.add("pf-mobile-fluid");
    root.classList.add("pf-mobile-maxperf");

    const styleId = "pf-mobile-maxperf-style";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = [
        "html.pf-mobile-maxperf, html.pf-mobile-maxperf body { scroll-behavior: auto !important; }",
        "html.pf-mobile-maxperf *, html.pf-mobile-maxperf *::before, html.pf-mobile-maxperf *::after { transition: none !important; animation: none !important; }",
        "html.pf-mobile-maxperf :where([class*=\\\"shadow\\\"], [style*=\\\"box-shadow\\\"], [class*=\\\"backdrop-blur\\\"]) { box-shadow: none !important; backdrop-filter: none !important; }",
        "html.pf-mobile-maxperf.pf-mobile-webview, html.pf-mobile-maxperf.pf-mobile-webview body, html.pf-mobile-maxperf.pf-mobile-webview .pf-training-shell, html.pf-mobile-maxperf.pf-mobile-webview .pf-training-shell main, html.pf-mobile-maxperf.pf-mobile-webview .pf-alumno-main, html.pf-mobile-maxperf.pf-mobile-webview .pf-alumno-main.pf-alumno-v2, html.pf-mobile-maxperf.pf-mobile-webview .pf-alumno-v2, html.pf-mobile-maxperf.pf-mobile-webview .pf-alumno-stage, html.pf-mobile-maxperf.pf-mobile-webview .pf-a2-shell, html.pf-mobile-maxperf.pf-mobile-webview .pf-a2-dock { background-color: #081a2d !important; background-image: none !important; }",
        "html.pf-mobile-maxperf.pf-mobile-webview .pf-alumno-v2, html.pf-mobile-maxperf.pf-mobile-webview .pf-alumno-main.pf-alumno-v2 { padding-bottom: calc(10px + env(safe-area-inset-bottom)) !important; }",
      ].join("\\n");
      (document.head || document.documentElement).appendChild(style);

      const ensureStyleLast = () => {
        if (style.parentNode) {
          style.parentNode.appendChild(style);
        }
      };

      requestAnimationFrame(ensureStyleLast);
      setTimeout(ensureStyleLast, 400);
      setTimeout(ensureStyleLast, 1200);
    }

    true;
  } catch (_error) {
    true;
  }
})();
`;

function withCacheBust(url: string, refreshSeed: number): string {
  try {
    const parsed = new URL(url);
    parsed.searchParams.set("pfv", WEBVIEW_CACHE_TAG);
    parsed.searchParams.set("pfrefresh", String(refreshSeed));

    if (MAX_PERFORMANCE_MODE) {
      Object.entries(MAX_PERFORMANCE_QUERY_FLAGS).forEach(([key, value]) => {
        parsed.searchParams.set(key, value);
      });
    }

    return parsed.toString();
  } catch {
    return url;
  }
}

export default function App() {
  const [webViewKey, setWebViewKey] = useState(0);
  const [refreshSeed, setRefreshSeed] = useState(() => Date.now());
  const [webError, setWebError] = useState("");
  const isWeb = Platform.OS === "web";

  const forceRefresh = () => {
    setRefreshSeed(Date.now());
    setWebViewKey((prev) => prev + 1);
  };

  const activeUrl = useMemo(() => {
    return withCacheBust(PRODUCTION_URL, refreshSeed);
  }, [refreshSeed]);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.header}>
          <View style={styles.headerTopRow}>
            <View style={styles.headerTopText}>
              <Text style={styles.headerTitle}>PF Control</Text>
              <Text style={styles.headerSubtitle}>Vista app</Text>
            </View>
            <View style={styles.headerTopActions}>
              <Pressable style={styles.refreshGhostButton} onPress={forceRefresh}>
                <Text style={styles.refreshGhostButtonText}>Refrescar</Text>
              </Pressable>
            </View>
          </View>
          {webError ? <Text style={styles.errorText}>{webError}</Text> : null}
        </View>

        {isWeb ? (
          <View style={styles.webview}>
            {createElement("iframe" as any, {
              key: `${webViewKey}`,
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
            key={`${webViewKey}`}
            source={{ uri: activeUrl }}
            style={styles.webview}
            startInLoadingState
            cacheEnabled={false}
            incognito={false}
            onLoadStart={() => setWebError("")}
            onError={() => setWebError("No se pudo cargar la URL. Revisa la direccion local y la red.")}
            renderLoading={() => (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color="#73e2bf" />
                <Text style={styles.loadingText}>Cargando plataforma...</Text>
              </View>
            )}
            setSupportMultipleWindows={false}
            javaScriptEnabled
            domStorageEnabled
            nestedScrollEnabled
            cacheMode="LOAD_NO_CACHE"
            setBuiltInZoomControls={false}
            setDisplayZoomControls={false}
            showsHorizontalScrollIndicator={false}
            showsVerticalScrollIndicator={false}
            bounces={false}
            allowsBackForwardNavigationGestures={false}
            allowsInlineMediaPlayback={false}
            mediaPlaybackRequiresUserAction
            injectedJavaScriptBeforeContentLoaded={MOBILE_SCROLL_HINT_SCRIPT}
            pullToRefreshEnabled={false}
            overScrollMode="never"
            androidLayerType="software"
            androidHardwareAccelerationDisabled
          />
        )}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#05070a",
  },
  header: {
    paddingHorizontal: 10,
    paddingTop: 1,
    paddingBottom: 1,
    borderBottomWidth: 0,
    backgroundColor: "#05070a",
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  headerTopText: {
    minWidth: 0,
    paddingVertical: 1,
  },
  headerTopActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  headerTitle: {
    color: "#f4f8fc",
    fontSize: 13,
    fontWeight: "800",
  },
  headerSubtitle: {
    marginTop: 0,
    color: "#8fa8c1",
    fontSize: 8,
    fontWeight: "700",
  },
  refreshGhostButton: {
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(146,190,255,0.38)",
    backgroundColor: "rgba(11,17,27,0.82)",
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  refreshGhostButtonText: {
    color: "#d8e5f4",
    fontSize: 8,
    fontWeight: "800",
  },
  errorText: {
    marginTop: 4,
    color: "#fca5a5",
    fontSize: 10,
    fontWeight: "600",
  },
  webview: {
    flex: 1,
    backgroundColor: "#05070a",
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
    borderColor: "rgba(146,190,255,0.3)",
    backgroundColor: "rgba(7,12,19,0.9)",
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
    borderColor: "rgba(166,237,218,0.7)",
    backgroundColor: "rgba(115,226,191,0.22)",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  webHintButtonText: {
    color: "#ecfff7",
    fontSize: 11,
    fontWeight: "800",
  },
  loadingOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#05070a",
    gap: 10,
  },
  loadingText: {
    color: "#d9e8f8",
    fontSize: 14,
    fontWeight: "700",
  },
});
