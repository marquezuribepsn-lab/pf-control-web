import { StatusBar } from "expo-status-bar";
import { createElement, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
const WEBVIEW_CACHE_TAG = "alumno-v2-20260504-nutricion-actions";
const MAX_PERFORMANCE_MODE = true;
const MAX_PERFORMANCE_QUERY_FLAGS: Record<string, string> = {
  pfperf: "1",
  pfmax: "1",
  pffluid: "1",
};

const MAX_PERFORMANCE_FLAG_KEYS = Object.keys(MAX_PERFORMANCE_QUERY_FLAGS);
const WEBVIEW_CACHE_QUERY_KEYS = ["pfv", "pfrefresh", ...MAX_PERFORMANCE_FLAG_KEYS];
const WEBVIEW_MIN_BRANDED_LOADING_MS = 1800;
const WEBVIEW_MAX_BRANDED_LOADING_MS = 6000;
const PRODUCTION_HOSTNAME = (() => {
  try {
    return new URL(PRODUCTION_URL).hostname;
  } catch {
    return "";
  }
})();

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

    const killHardReloadSplash = () => {
      try {
        const splash = document.getElementById("pf-hard-reload-splash");
        if (splash && splash.parentNode) {
          splash.parentNode.removeChild(splash);
        }
      } catch (_error) {
        true;
      }
    };
    killHardReloadSplash();
    setTimeout(killHardReloadSplash, 0);
    setTimeout(killHardReloadSplash, 200);
    setTimeout(killHardReloadSplash, 800);
    setTimeout(killHardReloadSplash, 1800);
    if (typeof MutationObserver === "function") {
      try {
        const observer = new MutationObserver(killHardReloadSplash);
        observer.observe(document, { childList: true, subtree: true });
        setTimeout(() => {
          try {
            observer.disconnect();
          } catch (_error) {
            true;
          }
        }, 4000);
      } catch (_error) {
        true;
      }
    }

    const postCurrentRoute = () => {
      try {
        if (window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === "function") {
          window.ReactNativeWebView.postMessage(
            JSON.stringify({
              type: "pf-route",
              href: String(window.location.href || ""),
            })
          );
        }
      } catch (_error) {
        true;
      }
    };

    const hookHistoryMethod = (methodName) => {
      try {
        const historyRef = window.history;
        if (!historyRef) {
          return;
        }

        const original = historyRef[methodName];
        if (typeof original !== "function") {
          return;
        }

        const wrappedFlag = "__PF_ROUTE_HOOK_" + methodName + "__";
        if (window[wrappedFlag]) {
          return;
        }

        window[wrappedFlag] = true;

        historyRef[methodName] = function (...args) {
          const result = original.apply(this, args);
          setTimeout(postCurrentRoute, 0);
          return result;
        };
      } catch (_error) {
        true;
      }
    };

    hookHistoryMethod("pushState");
    hookHistoryMethod("replaceState");

    window.addEventListener("popstate", postCurrentRoute, { passive: true });
    window.addEventListener("hashchange", postCurrentRoute, { passive: true });

    setTimeout(postCurrentRoute, 0);

    const styleId = "pf-mobile-maxperf-style";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = [
        "html.pf-mobile-maxperf, html.pf-mobile-maxperf body { scroll-behavior: auto !important; }",
        "html.pf-mobile-maxperf *:not(#pf-hard-reload-splash), html.pf-mobile-maxperf *::before, html.pf-mobile-maxperf *::after { transition: none !important; animation: none !important; }",
        "html.pf-mobile-maxperf #pf-hard-reload-splash { display: none !important; }",
        "html.pf-mobile-maxperf :where([class*=\\\"shadow\\\"], [style*=\\\"box-shadow\\\"], [class*=\\\"backdrop-blur\\\"]) { box-shadow: none !important; backdrop-filter: none !important; }",
        "html.pf-mobile-maxperf.pf-mobile-webview, html.pf-mobile-maxperf.pf-mobile-webview body, html.pf-mobile-maxperf.pf-mobile-webview .pf-training-shell, html.pf-mobile-maxperf.pf-mobile-webview .pf-training-shell main, html.pf-mobile-maxperf.pf-mobile-webview .pf-alumno-main, html.pf-mobile-maxperf.pf-mobile-webview .pf-alumno-main.pf-alumno-v2, html.pf-mobile-maxperf.pf-mobile-webview .pf-alumno-v2, html.pf-mobile-maxperf.pf-mobile-webview .pf-alumno-stage, html.pf-mobile-maxperf.pf-mobile-webview .pf-a2-shell, html.pf-mobile-maxperf.pf-mobile-webview .pf-a2-dock { background-color: #0d1219 !important; background-image: none !important; }",
        "html.pf-mobile-maxperf.pf-mobile-webview .pf-alumno-v2, html.pf-mobile-maxperf.pf-mobile-webview .pf-alumno-main.pf-alumno-v2 { padding-bottom: calc(10px + env(safe-area-inset-bottom)) !important; }",
        "html.pf-mobile-maxperf.pf-mobile-webview .pf-a4-nutrition-plan-quick-row { display: grid !important; grid-template-columns: 1fr !important; gap: 0.48rem !important; margin-top: 0.75rem !important; }",
        "html.pf-mobile-maxperf.pf-mobile-webview .pf-a4-nutrition-plan-action-btn-quick { width: 100% !important; min-height: 38px !important; opacity: 1 !important; visibility: visible !important; }",
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

function buildInPlaceRefreshScript(refreshSeed: number): string {
  const serializedCacheTag = JSON.stringify(WEBVIEW_CACHE_TAG);
  const serializedSeed = JSON.stringify(String(refreshSeed));
  const serializedFlags = JSON.stringify(
    MAX_PERFORMANCE_MODE ? MAX_PERFORMANCE_QUERY_FLAGS : {}
  );

  return `
(() => {
  try {
    const parsed = new URL(String(window.location.href || ""));
    parsed.searchParams.set("pfv", ${serializedCacheTag});
    parsed.searchParams.set("pfrefresh", ${serializedSeed});

    const flags = ${serializedFlags};
    Object.keys(flags).forEach((key) => {
      parsed.searchParams.set(key, String(flags[key]));
    });

    const nextUrl = parsed.toString();

    if (window.ReactNativeWebView && typeof window.ReactNativeWebView.postMessage === "function") {
      window.ReactNativeWebView.postMessage(
        JSON.stringify({
          type: "pf-route",
          href: nextUrl,
        })
      );
    }

    window.location.replace(nextUrl);
  } catch (_error) {
    window.location.reload();
  }

  true;
})();
`;
}

function normalizeWebViewRouteUrl(rawUrl: string): string | null {
  const normalizedRaw = String(rawUrl || "").trim();
  if (!normalizedRaw) {
    return null;
  }

  try {
    const parsed = new URL(normalizedRaw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    if (PRODUCTION_HOSTNAME && parsed.hostname !== PRODUCTION_HOSTNAME) {
      return null;
    }

    WEBVIEW_CACHE_QUERY_KEYS.forEach((key) => {
      parsed.searchParams.delete(key);
    });

    return parsed.toString();
  } catch {
    return null;
  }
}

export default function App() {
  const [webViewKey, setWebViewKey] = useState(0);
  const [refreshSeed, setRefreshSeed] = useState(() => Date.now());
  const [webError, setWebError] = useState("");
  const [baseUrl, setBaseUrl] = useState(PRODUCTION_URL);
  const [showBrandedLoading, setShowBrandedLoading] = useState(true);
  const loadingStartedAtRef = useRef<number>(Date.now());
  const loadingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadingHardTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const webViewRef = useRef<any>(null);
  const isWeb = Platform.OS === "web";

  const clearLoadingTimer = useCallback(() => {
    if (loadingTimerRef.current !== null) {
      clearTimeout(loadingTimerRef.current);
      loadingTimerRef.current = null;
    }
  }, []);

  const clearHardLoadingTimer = useCallback(() => {
    if (loadingHardTimerRef.current !== null) {
      clearTimeout(loadingHardTimerRef.current);
      loadingHardTimerRef.current = null;
    }
  }, []);

  const beginBrandedLoading = useCallback(() => {
    clearLoadingTimer();
    clearHardLoadingTimer();
    loadingStartedAtRef.current = Date.now();
    setShowBrandedLoading(true);
    loadingHardTimerRef.current = setTimeout(() => {
      loadingHardTimerRef.current = null;
      clearLoadingTimer();
      setShowBrandedLoading(false);
    }, WEBVIEW_MAX_BRANDED_LOADING_MS);
  }, [clearHardLoadingTimer, clearLoadingTimer]);

  const endBrandedLoading = useCallback(() => {
    const elapsedMs = Date.now() - loadingStartedAtRef.current;
    const remainingMs = Math.max(0, WEBVIEW_MIN_BRANDED_LOADING_MS - elapsedMs);

    clearLoadingTimer();
    clearHardLoadingTimer();

    if (remainingMs === 0) {
      setShowBrandedLoading(false);
      return;
    }

    loadingTimerRef.current = setTimeout(() => {
      loadingTimerRef.current = null;
      setShowBrandedLoading(false);
    }, remainingMs);
  }, [clearHardLoadingTimer, clearLoadingTimer]);

  useEffect(() => {
    const safetyTimer = setTimeout(() => {
      setShowBrandedLoading(false);
    }, WEBVIEW_MAX_BRANDED_LOADING_MS);

    return () => {
      clearTimeout(safetyTimer);
      clearLoadingTimer();
      clearHardLoadingTimer();
    };
  }, [clearHardLoadingTimer, clearLoadingTimer]);

  const forceRefresh = () => {
    const nextRefreshSeed = Date.now();
    beginBrandedLoading();

    if (!isWeb && webViewRef.current && typeof webViewRef.current.injectJavaScript === "function") {
      webViewRef.current.injectJavaScript(buildInPlaceRefreshScript(nextRefreshSeed));
      return;
    }

    setRefreshSeed(nextRefreshSeed);
    setWebViewKey((prev) => prev + 1);
  };

  const rememberCurrentUrl = useCallback((rawUrl: string) => {
    const normalizedUrl = normalizeWebViewRouteUrl(rawUrl);
    if (!normalizedUrl) {
      return;
    }

    setBaseUrl((previous) => (previous === normalizedUrl ? previous : normalizedUrl));
  }, []);

  const handleWebViewMessage = useCallback(
    (rawMessage: string) => {
      const payload = String(rawMessage || "").trim();
      if (!payload) {
        return;
      }

      try {
        const parsed = JSON.parse(payload);
        if (parsed && typeof parsed === "object" && parsed.type === "pf-route") {
          rememberCurrentUrl(String(parsed.href || ""));
          return;
        }
      } catch {
        // Ignore JSON parse errors and fallback to raw payload handling.
      }

      rememberCurrentUrl(payload);
    },
    [rememberCurrentUrl]
  );

  const activeUrl = useMemo(() => {
    return withCacheBust(baseUrl, refreshSeed);
  }, [baseUrl, refreshSeed]);

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
          <View style={styles.webviewContainer}>
            {createElement("iframe" as any, {
              key: `${webViewKey}`,
              src: activeUrl,
              style: {
                width: "100%",
                height: "100%",
                border: "0",
                backgroundColor: "#020617",
                opacity: showBrandedLoading ? 0 : 1,
              },
              onLoad: () => {
                setWebError("");
                endBrandedLoading();
              },
              onError: () => {
                setWebError("No se pudo cargar la URL dentro del panel.");
                endBrandedLoading();
              },
            })}

            <View style={styles.webHintBar}>
              <Text style={styles.webHintText}>Si no carga en panel, abri en pestaña nueva.</Text>
              <Pressable style={styles.webHintButton} onPress={() => Linking.openURL(activeUrl)}>
                <Text style={styles.webHintButtonText}>Abrir</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.webviewContainer}>
            <WebView
              ref={webViewRef}
              key={`${webViewKey}`}
              source={{ uri: activeUrl }}
              style={[styles.webview, showBrandedLoading ? styles.webviewMasked : null]}
              cacheEnabled={true}
              incognito={false}
              onLoadStart={() => {
                setWebError("");
              }}
              onLoadEnd={endBrandedLoading}
              onNavigationStateChange={(navigationState) => {
                rememberCurrentUrl(String(navigationState.url || ""));
              }}
              onShouldStartLoadWithRequest={(request) => {
                rememberCurrentUrl(String(request.url || ""));
                return true;
              }}
              onMessage={(event) => {
                handleWebViewMessage(String(event.nativeEvent.data || ""));
              }}
              onError={() => {
                setWebError("No se pudo cargar la URL. Revisa la direccion local y la red.");
                endBrandedLoading();
              }}
              setSupportMultipleWindows={false}
              javaScriptEnabled
              domStorageEnabled
              nestedScrollEnabled
              cacheMode="LOAD_DEFAULT"
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
          </View>
        )}

        {showBrandedLoading ? (
          <View style={styles.loadingOverlay} pointerEvents="none">
            <View style={styles.loadingLogoWrap}>
              <View style={styles.loadingLogoCore}>
                <Text style={styles.loadingLogoText}>PF</Text>
              </View>
            </View>
            <Text style={styles.loadingBrand}>PF Control</Text>
            <ActivityIndicator size="small" color="#73e2bf" />
            <Text style={styles.loadingText}>Cargando plataforma...</Text>
          </View>
        ) : null}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0d1219",
  },
  header: {
    paddingHorizontal: 10,
    paddingTop: 1,
    paddingBottom: 1,
    borderBottomWidth: 0,
    backgroundColor: "#0d1219",
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
    backgroundColor: "#0d1219",
  },
  webviewMasked: {
    opacity: 0,
  },
  webviewContainer: {
    flex: 1,
    backgroundColor: "#0d1219",
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
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0d1219",
    gap: 8,
    zIndex: 5,
  },
  loadingLogoWrap: {
    width: 66,
    height: 66,
    borderRadius: 33,
    borderWidth: 2,
    borderColor: "rgba(115,226,191,0.42)",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingLogoCore: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(146,190,255,0.58)",
    backgroundColor: "rgba(9,16,26,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingLogoText: {
    color: "#ecfff7",
    fontSize: 14,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  loadingBrand: {
    color: "#9db4cd",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.9,
    textTransform: "uppercase",
  },
  loadingText: {
    color: "#d9e8f8",
    fontSize: 13,
    fontWeight: "700",
  },
});
