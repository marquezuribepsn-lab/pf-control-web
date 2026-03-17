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
