// Service Worker for Ciseau Noir push notifications
// VERSION 3 — force update on mobile (Melynda agenda live push)
const SW_VERSION = "v3-2026-05-27";

// Force le nouveau SW à prendre le contrôle immédiatement (au lieu d'attendre la fermeture de tous les onglets)
self.addEventListener("install", function (event) {
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  // Prend le contrôle de tous les clients ouverts (force reload data)
  event.waitUntil(
    (async () => {
      await self.clients.claim();
      // Notifier tous les clients ouverts qu'une nouvelle version est active
      const clients = await self.clients.matchAll({ type: "window" });
      clients.forEach(client => client.postMessage({ type: "SW_UPDATED", version: SW_VERSION }));
    })()
  );
});

self.addEventListener("push", function (event) {
  let data = { title: "Ciseau Noir", body: "Vous avez une notification.", url: "/" };

  if (event.data) {
    try {
      data = Object.assign(data, event.data.json());
    } catch (e) {
      data.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: "/favicon.ico",
      badge: "/favicon.ico",
      data: { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  const url = event.notification.data?.url || "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clientList) {
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
