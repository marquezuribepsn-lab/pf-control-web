const STATIC_CACHE = "pf-control-static-v4";
const RUNTIME_CACHE = "pf-control-runtime-v4";
const SYNC_CACHE = "pf-control-sync-v4";

const CORE_OFFLINE_ROUTES = [
  "/",
  "/sesiones",
  "/semana",
  "/plantel",
  "/clientes",
  "/ejercicios",
  "/asistencias",
  "/registros",
  "/equipos",
  "/deportes",
  "/categorias",
  "/nueva-sesion",
  "/configuracion",
  "/cuenta",
  "/alumno/inicio",
  "/alumno/rutina",
  "/alumno/nutricion",
  "/alumno/medidas",
  "/alumno/progreso",
  "/auth/login",
  "/favicon.ico",
  "/pf-control-launcher.html",
  "/offline.html",
];

const VOLATILE_QUERY_PARAMS = new Set([
  "_rsc",
  "_data",
  "__nextLocale",
  "__nextDefaultLocale",
  "__nextInferredLocaleFromDefault",
  "ts",
]);

function isNavigationRequest(request) {
  return request.mode === "navigate" || request.destination === "document";
}

function isRscRequest(request, url) {
  return (
    request.headers.get("RSC") === "1" ||
    request.headers.has("Next-Router-State-Tree") ||
    request.headers.has("Next-Router-Prefetch") ||
    url.searchParams.has("_rsc")
  );
}

function isSensitiveNavigation(url) {
  const path = String(url.pathname || "").toLowerCase();
  return path.startsWith("/admin") || path.startsWith("/cuenta");
}

function getCacheKey(request) {
  const url = new URL(request.url);
  const keyUrl = new URL(url.pathname, self.location.origin);

  const filteredParams = [];
  for (const [name, value] of url.searchParams.entries()) {
    if (!VOLATILE_QUERY_PARAMS.has(name)) {
      filteredParams.push([name, value]);
    }
  }

  filteredParams.sort(([left], [right]) => left.localeCompare(right));
  for (const [name, value] of filteredParams) {
    keyUrl.searchParams.append(name, value);
  }

  if (isNavigationRequest(request)) {
    keyUrl.searchParams.set("__pf_sw_format", "document");
    return keyUrl.toString();
  }

  if (isRscRequest(request, url)) {
    keyUrl.searchParams.set("__pf_sw_format", "rsc");
    return keyUrl.toString();
  }

  return keyUrl.toString();
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      await Promise.allSettled(
        CORE_OFFLINE_ROUTES.map(async (path) => {
          try {
            const response = await fetch(path, { cache: "no-store" });
            if (response && response.ok) {
              await cache.put(path, response.clone());
            }
          } catch {
            // si un recurso falla, seguimos precacheando el resto
          }
        })
      );
    })()
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  const allowedCaches = [STATIC_CACHE, RUNTIME_CACHE, SYNC_CACHE];

  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => !allowedCaches.includes(key)).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event?.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

async function putInCache(cacheName, request, response) {
  if (!response || response.status !== 200) {
    return response;
  }

  const url = new URL(request.url);
  if (isNavigationRequest(request) && isSensitiveNavigation(url)) {
    return response;
  }

  try {
    const cache = await caches.open(cacheName);
    await cache.put(getCacheKey(request), response.clone());
  } catch {
    // evitar fallos del SW por errores de cache puntuales
  }

  return response;
}

async function matchFromCache(cacheName, request) {
  const cache = await caches.open(cacheName);
  const normalized = await cache.match(getCacheKey(request));
  if (normalized) {
    return normalized;
  }
  return cache.match(request);
}

async function networkFirst(request, cacheName) {
  try {
    const networkResponse = await fetch(request);
    await putInCache(cacheName, request, networkResponse);
    return networkResponse;
  } catch {
    const cached = await matchFromCache(cacheName, request);
    if (cached) {
      return cached;
    }
    throw new Error("offline");
  }
}

async function cacheFirst(request, cacheName) {
  const cached = await matchFromCache(cacheName, request);
  if (cached) {
    return cached;
  }

  const networkResponse = await fetch(request);
  await putInCache(cacheName, request, networkResponse);
  return networkResponse;
}

async function staleWhileRevalidate(request, cacheName) {
  const cached = await matchFromCache(cacheName, request);

  const networkPromise = fetch(request)
    .then((networkResponse) => putInCache(cacheName, request, networkResponse))
    .catch(() => null);

  if (cached) {
    return cached;
  }

  const networkResponse = await networkPromise;
  if (networkResponse) {
    return networkResponse;
  }

  throw new Error("offline");
}

self.addEventListener("fetch", (event) => {
  const request = event.request;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (isNavigationRequest(request)) {
    const isSensitive = isSensitiveNavigation(url);
    event.respondWith(
      networkFirst(request, RUNTIME_CACHE).catch(async () => {
        if (!isSensitive) {
          const cachedPage = await matchFromCache(RUNTIME_CACHE, request);
          if (cachedPage) {
            return cachedPage;
          }
        }

        const staticCache = await caches.open(STATIC_CACHE);
        if (!isSensitive) {
          const home = await staticCache.match("/");
          if (home) {
            return home;
          }
        }

        const offlinePage = await staticCache.match("/offline.html");
        if (offlinePage) {
          return offlinePage;
        }

        return new Response("Modo sin conexion activo", {
          status: 200,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      })
    );
    return;
  }

  if (url.pathname.startsWith("/api/sync/")) {
    event.respondWith(networkFirst(request, SYNC_CACHE));
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    return;
  }

  if (
    url.pathname.startsWith("/_next/static/") ||
    /\.(?:css|js|png|jpg|jpeg|webp|gif|svg|ico|woff2?)$/i.test(url.pathname)
  ) {
    event.respondWith(cacheFirst(request, RUNTIME_CACHE));
    return;
  }

  event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
});

self.addEventListener("push", (event) => {
  let payload = { title: "PF Control", body: "Tenes una nueva notificacion." };

  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      payload = { title: "PF Control", body: event.data.text() };
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title || "PF Control", {
      body: payload.body || "Cambio registrado",
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      data: payload,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      const existing = windowClients.find((client) => "focus" in client);
      if (existing) {
        return existing.focus();
      }
      return clients.openWindow("/");
    })
  );
});
