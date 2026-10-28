/* One UMS: no payload caching; authorization is checked before displaying push. */
self.addEventListener("install", (event) =>
  event.waitUntil(self.skipWaiting()),
);
self.addEventListener("activate", (event) =>
  event.waitUntil(self.clients.claim()),
);
self.addEventListener("push", (event) =>
  event.waitUntil(
    (async () => {
      try {
        const incoming = event.data?.json();
        if (
          !incoming ||
          typeof incoming.id !== "string" ||
          typeof incoming.token !== "string" ||
          !/^[a-f0-9-]{36}$/i.test(incoming.id)
        )
          return;
        const response = await fetch(
          `/api/push/deliveries/${encodeURIComponent(incoming.id)}`,
          {
            credentials: "same-origin",
            cache: "no-store",
            headers: { "X-Push-Token": incoming.token },
          },
        );
        if (!response.ok) return;
        const notification = await response.json();
        const url = new URL(notification.url, self.location.origin);
        if (url.origin !== self.location.origin) return;
        await self.registration.showNotification(notification.title, {
          body: notification.body,
          tag: notification.tag,
          data: { url: url.pathname + url.search },
          icon: "/ums-icon.svg",
          badge: "/ums-icon.svg",
        });
        await fetch(
          `/api/push/deliveries/${encodeURIComponent(incoming.id)}/receipt`,
          {
            method: "POST",
            credentials: "same-origin",
            headers: {
              "Content-Type": "application/json",
              "X-Requested-With": "MessagingApp",
            },
            body: JSON.stringify({ token: incoming.token }),
          },
        );
      } catch {
        /* Push service acceptance is not treated as browser display. */
      }
    })(),
  ),
);
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const url = new URL(
        event.notification.data?.url ?? "/dashboard",
        self.location.origin,
      );
      if (url.origin !== self.location.origin) return;
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const existing = windows.find(
        (client) => new URL(client.url).origin === self.location.origin,
      );
      if (existing) {
        await existing.navigate(url.href);
        await existing.focus();
      } else await self.clients.openWindow(url.href);
    })(),
  );
});
