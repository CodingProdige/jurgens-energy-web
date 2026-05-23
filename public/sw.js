self.addEventListener("push", (event) => {
  if (!event.data) {
    return;
  }

  const payload = event.data.json();
  const title = payload.title || "Piessang";
  const options = {
    badge: "/brand/favicon-for-public/web-app-manifest-192x192.png",
    body: payload.body || "",
    data: {
      url: payload.url || "/",
    },
    icon: payload.icon || "/brand/favicon-for-public/web-app-manifest-192x192.png",
    tag: payload.tag || "piessang-notification",
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl = new URL(event.notification.data?.url || "/", self.location.origin);

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client && client.url === targetUrl.href) {
          return client.focus();
        }
      }

      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl.href);
      }

      return undefined;
    }),
  );
});
