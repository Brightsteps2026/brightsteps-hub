// BrightSteps Hub service worker: shows phone notifications (push) and opens
// the Hub when one is tapped. It does not store the Hub for offline use.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) { data = { title: "BrightSteps Hub", body: event.data ? event.data.text() : "" }; }
  event.waitUntil(
    self.registration.showNotification(data.title || "BrightSteps Hub", (() => {
      // School bus "5 minutes away" / urgent alerts: ring and vibrate, and stay on screen until seen
      const busAlert = String(data.url || "").includes("alert=bus");
      return {
        body: data.body || "",
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        tag: busAlert ? "bus-" + Date.now() : data.tag,
        renotify: busAlert,
        silent: false,
        requireInteraction: busAlert,
        vibrate: busAlert ? [400, 150, 400, 150, 400] : [200],
        data: { url: data.url || "/" }
      };
    })())
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of all) {
      if (c.url.startsWith(self.location.origin)) {
        await c.focus();
        c.postMessage({ type: "bs-push-open", url });
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});
