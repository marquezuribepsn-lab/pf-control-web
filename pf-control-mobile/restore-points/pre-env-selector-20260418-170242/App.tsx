import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { WebView } from "react-native-webview";

const WEB_APP_URL = "https://pf-control.com";

export default function App() {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>PF Control</Text>
        <Text style={styles.headerSubtitle}>Vista app</Text>
      </View>

      <WebView
        source={{ uri: WEB_APP_URL }}
        style={styles.webview}
        startInLoadingState
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
  webview: {
    flex: 1,
    backgroundColor: "#020617",
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
