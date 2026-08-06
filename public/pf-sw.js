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
      // El push puede indicar a donde ir (ej. el aviso de racha abre el inicio
      // del alumno). Si no lo indica, se abre la raiz como antes.
      const destino = (event.notification.data && event.notification.data.url) || "/";
      const existing = windowClients.find((client) => "focus" in client);
      if (existing) {
        if ("navigate" in existing && destino !== "/") {
          return existing.focus().then((c) => (c && c.navigate ? c.navigate(destino) : c));
        }
        return existing.focus();
      }
      return clients.openWindow(destino);
    })
  );
});
